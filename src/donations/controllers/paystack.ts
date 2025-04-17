import { Request, Response } from 'express';
import axios from 'axios';
import { Donation } from '../models/donations.model';
import mongoose from 'mongoose';

export class PaystackController {
  private readonly paystackSecretKey = process.env.PAYSTACK_SECRET_KEY as string;
  private readonly baseURL = 'https://api.paystack.co';

  constructor() {
    this.initializePayment = this.initializePayment.bind(this);
    this.verifyPayment = this.verifyPayment.bind(this);
    this.handleWebhook = this.handleWebhook.bind(this);
  }

  async initializePayment(req: Request, res: Response) {
    try {
      const { amount, email, metadata } = req.body;

      // Check database connection
      if (mongoose.connection.readyState !== 1) {
        throw new Error('Database connection not ready');
      }

      // First initialize payment with Paystack
      const response = await axios.post(
        `${this.baseURL}/transaction/initialize`,
        {
          amount: amount * 100,
          email,
          metadata
        },
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Create donation with timeout handling
      const donation = await Promise.race([
        Donation.create({
          amount,
          email,
          name: metadata.name,
          message: metadata.message,
          reference: response.data.data.reference,
          status: 'pending',
          paymentMethod: 'paystack',
          paymentDetails: response.data.data
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database operation timed out')), 5000)
        )
      ]);

      res.status(200).json(response.data);
    } catch (error: any) {
      console.error('Payment initialization error:', error);
      
      // Send appropriate error response based on error type
      if (error.message === 'Database connection not ready') {
        res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'Database connection issue'
        });
      } else if (error.message === 'Database operation timed out') {
        res.status(504).json({
          error: 'Gateway Timeout',
          message: 'Database operation timed out'
        });
      } else {
        res.status(500).json({
          error: 'Failed to initialize payment',
          message: error.message
        });
      }
    }
  }

  async verifyPayment(req: Request, res: Response) {
    try {
      const { reference } = req.params;

      const response = await axios.get(
        `${this.baseURL}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`
          }
        }
      );

      const { status, data } = response.data;

      if (status && data.status === 'success') {
        // Save donation to database
        await Donation.create({
          amount: data.amount / 100, // Convert back from kobo
          email: data.customer.email,
          name: data.metadata.name,
          message: data.metadata.message,
          reference: data.reference,
          status: 'completed',
          paymentMethod: 'paystack'
        });
      }

      res.status(200).json(response.data);
    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(500).json({
        error: 'Failed to verify payment'
      });
    }
  }

  async handleWebhook(req: Request, res: Response) {
    try {
      const event = req.body;

      // Handle different event types
      switch (event.event) {
        case 'charge.success':
          await Donation.findOneAndUpdate(
            { reference: event.data.reference },
            {
              status: 'completed',
              paymentDetails: event.data
            }
          );
          break;

        case 'charge.failed':
          await Donation.findOneAndUpdate(
            { reference: event.data.reference },
            {
              status: 'failed',
              paymentDetails: event.data
            }
          );
          break;

        case 'transfer.failed':
          await Donation.findOneAndUpdate(
            { reference: event.data.reference },
            {
              status: 'failed',
              paymentDetails: event.data
            }
          );
          break;

        case 'refund.processed':
          await Donation.findOneAndUpdate(
            { reference: event.data.reference },
            {
              status: 'refunded',
              paymentDetails: event.data
            }
          );
          break;

        // Add other event types as needed
      }

      res.sendStatus(200);
    } catch (error) {
      console.error('Webhook handling error:', error);
      res.sendStatus(500);
    }
  }
}