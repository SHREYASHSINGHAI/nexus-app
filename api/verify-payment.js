import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id, user_id } = req.body;

    const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest('hex');

    if (digest !== razorpay_signature) {
      return res.status(400).json({ error: 'invalid_signature' });
    }

    let quota = 35;
    if (plan_id === 'pro') quota = 70;
    if (plan_id === 'max') quota = 1000;

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const sub = {
      user_id,
      plan_id,
      status: 'active',
      sessions_used: 0,
      quota,
      week_reset_date: nextWeek,
      active_until: nextMonth
    };

    // Upsert subscription
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/subscriptions`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(sub)
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Verify Payment Error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
}
