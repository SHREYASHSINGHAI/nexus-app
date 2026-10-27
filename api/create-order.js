import Razorpay from 'razorpay';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { plan_id } = req.body; // 'basic', 'pro', 'max'
    if (!['basic', 'pro', 'max'].includes(plan_id)) {
      return res.status(400).json({ error: 'invalid_plan', message: 'Invalid subscription plan selected.' });
    }

    // Require authenticated user session
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'You must be signed in to purchase a subscription.'
      });
    }

    const token = authHeader.slice(7).trim();
    const apiKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (process.env.SUPABASE_URL && apiKey) {
      const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${token}`
        }
      });
      if (!userRes.ok) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Your session has expired. Please sign in again.'
        });
      }
    }

    const country = req.headers['x-vercel-ip-country'] || 'US';
    const isIndia = country === 'IN';

    let amount = 0;
    let currency = isIndia ? 'INR' : 'USD';

    if (plan_id === 'basic') {
      amount = isIndia ? 4900 : 99;
    } else if (plan_id === 'pro') {
      amount = isIndia ? 9900 : 199;
    } else if (plan_id === 'max') {
      amount = isIndia ? 39900 : 500;
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount,
      currency,
      receipt: `rcpt_${Date.now()}`,
      notes: {
        plan_id
      }
    };

    const order = await razorpay.orders.create(options);
    
    res.status(200).json({ id: order.id, currency: order.currency, amount: order.amount });
  } catch (error) {
    console.error('Razorpay Order Error:', error);
    if (!process.env.RAZORPAY_KEY_ID) {
      return res.status(500).json({ error: 'Razorpay keys missing from environment.' });
    }
    res.status(500).json({ error: 'Failed to create order', message: error.message });
  }
}
