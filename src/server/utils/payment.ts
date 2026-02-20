/**
 * Payment Gateway Integration Module
 * Supports Razorpay, and other payment methods
 */

export interface PaymentConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

export interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  customerId?: string;
  description?: string;
  notes?: Record<string, any>;
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, any>;
  created_at: number;
}

export interface PaymentResponse {
  success: boolean;
  message: string;
  paymentId?: string;
  orderId?: string;
  signature?: string;
  error?: string;
}

/**
 * Initialize Razorpay payment order
 */
export const createRazorpayOrder = async (
  config: PaymentConfig,
  order: PaymentOrder
): Promise<RazorpayOrder | null> => {
  try {
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay(config);

    const response = await razorpay.orders.create({
      amount: order.amount * 100, // Convert to paise
      currency: order.currency || 'INR',
      receipt: order.orderId,
      notes: {
        ...order.notes,
        customerId: order.customerId,
        description: order.description,
      },
    });

    return response;
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    return null;
  }
};

/**
 * Verify Razorpay payment signature
 */
export const verifyRazorpaySignature = (
  keySecret: string,
  orderId: string,
  paymentId: string,
  signature: string
): boolean => {
  try {
    const crypto = require('crypto');

    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
};

/**
 * Payment method types
 */
export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  UPI = 'upi',
  CHECK = 'check',
  BANK_TRANSFER = 'bank_transfer',
  RAZORPAY = 'razorpay',
}

/**
 * Payment status types
 */
export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

/**
 * Calculate payment processing fee (if applicable)
 */
export const calculatePaymentFee = (amount: number, method: PaymentMethod): number => {
  const feePercentages: Record<PaymentMethod, number> = {
    [PaymentMethod.CASH]: 0,
    [PaymentMethod.CHECK]: 0.5,
    [PaymentMethod.BANK_TRANSFER]: 1,
    [PaymentMethod.UPI]: 1.1,
    [PaymentMethod.CARD]: 2,
    [PaymentMethod.RAZORPAY]: 1.5,
  };

  const percentage = feePercentages[method] || 0;
  return (amount * percentage) / 100;
};

/**
 * Generate payment reference number
 */
export const generatePaymentReference = (): string => {
  const date = new Date();
  const timestamp = date.getTime();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();

  return `PAY-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${random}`;
};

/**
 * Validate payment information
 */
export const validatePaymentInfo = (method: PaymentMethod, amount: number): { valid: boolean; error?: string } => {
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than 0' };
  }

  // Validate based on payment method
  switch (method) {
    case PaymentMethod.CARD:
      if (amount > 100000) {
        return { valid: false, error: 'Card payment limit exceeded (₹100,000)' };
      }
      break;
    case PaymentMethod.CHECK:
      if (amount < 100) {
        return { valid: false, error: 'Check amount must be at least ₹100' };
      }
      break;
    case PaymentMethod.UPI:
      if (amount > 100000) {
        return { valid: false, error: 'UPI daily limit exceeded (₹100,000)' };
      }
      break;
  }

  return { valid: true };
};

/**
 * Create refund request
 */
export const createRefundRequest = (
  paymentId: string,
  amount: number,
  reason: string
): { refundId: string; status: string; amount: number; reason: string } => {
  return {
    refundId: `REF-${Date.now()}`,
    status: PaymentStatus.PENDING,
    amount,
    reason,
  };
};
