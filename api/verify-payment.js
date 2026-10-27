import crypto from 'crypto';
import Razorpay from 'razorpay';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan_id) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'Required payment verification parameters are missing.'
      });
    }

    if (!['basic', 'pro', 'max'].includes(plan_id)) {
      return res.status(400).json({
        error: 'invalid_plan',
        message: 'Invalid subscription plan selected.'
      });
    }

    // ── 1. Authenticate user from Supabase JWT ──────────────
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required. Please sign in to activate your subscription.'
      });
    }
    const token = authHeader.slice(7).trim();

    const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid or expired user session. Please sign in again.'
      });
    }

    const userData = await userRes.json();
    const verifiedUserId = userData?.id;
    if (!verifiedUserId) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User identity could not be verified from session.'
      });
    }

    // ── 2. Verify HMAC SHA-256 Signature ────────────────────
    const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest('hex');

    if (digest !== razorpay_signature) {
      return res.status(400).json({
        error: 'invalid_signature',
        message: 'Payment signature verification failed.'
      });
    }

    // ── 3. Fetch Order from Razorpay & Verify Amount/Plan ───
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.fetch(razorpay_order_id);
    if (!order) {
      return res.status(400).json({
        error: 'order_not_found',
        message: 'Could not fetch order from payment gateway.'
      });
    }

    // Official catalog amounts matching api/create-order.js
    const validPrices = {
      basic: { INR: 4900, USD: 99 },
      pro:   { INR: 9900, USD: 199 },
      max:   { INR: 39900, USD: 500 }
    };

    const expectedAmount = validPrices[plan_id]?.[order.currency];
    if (order.amount !== expectedAmount) {
      console.error(`[PAYMENT FRAUD] Order amount (${order.amount} ${order.currency}) does not match plan "${plan_id}" (expected ${expectedAmount})`);
      return res.status(400).json({
        error: 'amount_mismatch',
        message: 'The paid amount does not match the requested subscription plan.'
      });
    }

    // ── 4. Idempotency & Replay Protection Check ────────────
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const adminHeaders = {
      apikey: adminKey,
      Authorization: `Bearer ${adminKey}`,
      'Content-Type': 'application/json'
    };

    // Check if this payment ID was already used
    try {
      const paymentCheckRes = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/payments?razorpay_payment_id=eq.${razorpay_payment_id}&select=id`,
        { headers: adminHeaders }
      );
      if (paymentCheckRes.ok) {
        const existingPayments = await paymentCheckRes.json();
        if (Array.isArray(existingPayments) && existingPayments.length > 0) {
          console.warn(`[PAYMENT REPLAY BLOCKED] Duplicate payment ID: ${razorpay_payment_id}`);
          return res.status(409).json({
            error: 'payment_already_processed',
            message: 'This payment has already been activated.'
          });
        }
      }
    } catch (e) {
      console.warn('[PAYMENT CHECK] Non-fatal check warning:', e.message);
    }

    // Record the payment in audit table
    try {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/payments`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          user_id: verifiedUserId,
          razorpay_payment_id,
          razorpay_order_id,
          plan_id,
          amount: order.amount,
          currency: order.currency
        })
      });
    } catch (e) {
      console.warn('[PAYMENTS TABLE] Could not record payment audit:', e.message);
    }

    // ── 5. Upsert Subscription with Service Role Key ─────────
    let quota = 35;
    if (plan_id === 'pro') quota = 70;
    if (plan_id === 'max') quota = 1000;

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const sub = {
      user_id: verifiedUserId,
      plan_id,
      status: 'active',
      sessions_used: 0,
      quota,
      week_reset_date: nextWeek,
      active_until: nextMonth
    };

    const subUpsertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/subscriptions`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(sub)
    });

    if (!subUpsertRes.ok) {
      const errText = await subUpsertRes.text();
      console.error('[SUPABASE] Failed to upsert subscription:', errText);
      return res.status(500).json({
        error: 'db_error',
        message: 'Payment verified, but failed to update subscription in database.'
      });
    }

    console.log(`[PAYMENT SUCCESS] User ${verifiedUserId} upgraded to ${plan_id} (${quota} workflows/wk)`);
    return res.status(200).json({ success: true, plan_id, quota });

  } catch (error) {
    console.error('Verify Payment Error:', error);
    res.status(500).json({ error: 'Payment verification failed', message: error.message });
  }
}
