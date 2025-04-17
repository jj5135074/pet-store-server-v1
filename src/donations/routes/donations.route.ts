import express from 'express';
import { verifyPaystackWebhook } from '../../middleware/paystack.middleware';
import { PaystackController } from '../controllers/paystack';

const router = express.Router();
const paystackController = new PaystackController();

// Initialize payment
router.post('/payment/initialize', paystackController.initializePayment);

// Verify payment
router.get('/payment/verify/:reference', paystackController.verifyPayment);

// Webhook endpoint for Paystack
router.post('/payment/webhook', verifyPaystackWebhook, paystackController.handleWebhook);

export default router;