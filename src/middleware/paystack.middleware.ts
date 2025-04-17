import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export const verifyPaystackWebhook = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash === req.headers['x-paystack-signature']) {
    next();
  } else {
    res.status(400).json({ error: 'Invalid signature' });
  }
};