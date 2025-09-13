import express from 'express';
import cors from 'cors';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import crypto from 'crypto';
// Removed validateWebhookSignature import - using manual validation instead
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
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    console.log('Webhook received:', {
      signature: webhookSignature ? 'Present' : 'Missing',
      secret: webhookSecret ? 'Set' : 'Missing',
      body: JSON.stringify(req.body).substring(0, 100) + '...'
    });

    // Validate webhook signature
    if (!webhookSignature) {
      console.log('Missing webhook signature');
      return res.status(400).json({ error: 'Missing webhook signature' });
    }

    if (!webhookSecret) {
      console.log('Missing webhook secret in environment');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Manual signature validation (more reliable)
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
    
    console.log('Signature validation:', {
      received: webhookSignature,
      expected: expectedSignature,
      body_length: body.length
    });
    
    if (webhookSignature !== expectedSignature) {
      console.log('Invalid webhook signature - signatures do not match');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    console.log('Webhook signature validated successfully');

    // Process the webhook payload
    const event = req.body.event;
    const payloadData = req.body.payload;

    console.log('Processing webhook event:', event);

    switch (event) {
      case 'payment.captured':
        console.log('Payment captured:', payloadData.payment?.entity?.id);
        // Handle successful payment
        // const paymentDetails = payloadData.payment.entity;
        // Update database, mark user as paid, etc.
        break;
        
      case 'payment.failed':
        console.log('Payment failed:', payloadData.payment?.entity?.id);
        // Handle failed payment
        break;
        
      case 'order.paid':
        console.log('Order paid:', payloadData.order?.entity?.id);
        // Handle order completion
        break;
        
      default:
        console.log('Unhandled webhook event:', event);
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ status: 'ok', event: event });
    console.log('Webhook processed successfully');
  } 
  catch(err){
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/payment/verify', (req, res) => {
  try {
    // This route needs proper authentication middleware
    // For now, let's make it a simple verification endpoint
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    console.log('Payment verification request:', {
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      signature: razorpay_signature ? 'Present' : 'Missing'
    });

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature']
      });
    }

    // Verify payment signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      console.log('Payment verified successfully');
      res.json({ 
        success: true, 
        message: 'Payment verified successfully',
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id
      });
    } else {
      console.log('Payment verification failed');
      res.status(400).json({ 
        success: false, 
        message: 'Payment verification failed' 
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
