import express from 'express';
import cors from 'cors';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils.js';
dotenv.config();

const app = express();


app.use(cors());
app.use(express.json());

var instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Razorpay instance is ready to use

app.get('/', (req, res) => {
  res.json({ message: 'Razorpay Payment Server is running!', status: 'success' });
});

app.post('/create-order', (req, res) => {  
  
  instance.orders.create({
    amount: 10000,
    currency: 'INR',
    receipt: `order_${Date.now()}`,
    notes: {
      description: 'E-commerce purchase'
    }
  }).then((order) => {
    res.json(order);
  }).catch((err) => {
    res.status(500).json({ error: err.message });
  });
});

app.post('/payment/webhook', async (req, res) => {
  try{
    const webhookSignature = req.headers('x-razorpay-signature');
    const isValid = validateWebhookSignature(JSON.stringify(req.body), webhookSignature, process.env.RAZORPAY_WEBHOOK_SECRET);
    if(!isValid){
      res.status(400).json({ error: 'Invalid webhook signature' });
    }
    if(!isValid){
      res.status(400).json({ error: 'Invalid webhook signature' });
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