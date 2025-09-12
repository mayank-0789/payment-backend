import express from 'express';
import cors from 'cors';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils.js';
dotenv.config();

const app = express();

const ALLOWED_ORIGINS = [
  "https://payment-frontend.vercel.app", // your prod frontend domain (fixed typo)
  "http://localhost:3000",               // dev
  "http://localhost:5173"                // vite dev server
];
const corsOptions = {
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || /\.vercel\.app$/.test(origin)) {
      return cb(null, true);
    }
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));

app.use(express.json());

var instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Razorpay instance is ready to use

app.get('/', (req, res) => {
  res.json({ 
    message: 'Razorpay Payment Server is running!', 
    status: 'success',
    environment: {
      key_id_set: !!process.env.RAZORPAY_KEY_ID,
      key_secret_set: !!process.env.RAZORPAY_KEY_SECRET,
      key_id_prefix: process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.substring(0, 8) + '...' : 'Not set'
    }
  });
});

app.post('/create-order', (req, res) => {  
  console.log('Creating order with credentials:', {
    key_id: process.env.RAZORPAY_KEY_ID ? 'Set' : 'Missing',
    key_secret: process.env.RAZORPAY_KEY_SECRET ? 'Set' : 'Missing'
  });
  
  instance.orders.create({
    amount: 100,
    currency: 'INR',
    receipt: `order_${Date.now()}`,
    notes: {
      description: 'E-commerce purchase'
    }
  }).then((order) => {
    console.log('Order created successfully:', order.id);
    res.json(order);
  }).catch((err) => {
    console.error('Order creation failed:', {
      message: err.message,
      description: err.description,
      code: err.code,
      source: err.source,
      step: err.step,
      reason: err.reason,
      metadata: err.metadata
    });
    res.status(500).json({ 
      error: err.message,
      description: err.description,
      code: err.code
    });
  });
});

app.post('/payment/webhook', async (req, res) => {
  try{
    const webhookSignature = req.headers['x-razorpay-signature'];
    const isValid = validateWebhookSignature(JSON.stringify(req.body), webhookSignature, process.env.RAZORPAY_WEBHOOK_SECRET);
    if(!isValid){
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
    

    //if is valid then update the payment status in the database and make the user paid

    // const paymentDetails = req.body.payload.payment.entity;
    // const payment = await Payment.findOne({ id: paymentDetails.id });
    //payment.status = paymentDetails.status;
    //await payment.save();

    //make the user paid
    // const user = await User.findOne({ email: paymentDetails.email });
    // if(user){
    //   user.paid = true;
    //   await user.save();
    // }
 
    res.status(200).json({ status: 'ok received' });
    console.log('Webhook received and processed successfully');
  } 
  catch(err){
    res.status(500).json({ error: err.message });
  }
});

app.post('/payment/verify', (req, res) => {
  const user = req.user.toJSON();
  console.log(user);
  if (user.paid) {
    return res.json({ ...user });
  }
  return res.json({ ...user });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});