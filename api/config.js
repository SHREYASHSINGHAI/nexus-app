export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    supabaseUrl:  process.env.SUPABASE_URL,
    supabaseAnon: process.env.SUPABASE_ANON_KEY,
    razorpayKey:  process.env.RAZORPAY_KEY_ID
  });
}
