import axios from 'axios';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

export const PAYSTACK_CALLBACK_URL =
  process.env.PAYSTACK_CALLBACK_URL ||
  `${FRONTEND_URL.replace(/\/$/, '')}/payment/callback`;

interface PaystackInitializePayload {
  email: string;
  amount: number; // Amount in kobo
  reference: string;
  callback_url: string;
  metadata?: Record<string, any>;
}

interface PaystackResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface PaystackRefundPayload {
  transaction: string | number;
  amount?: number;
  currency?: string;
  customer_note?: string;
  merchant_note?: string;
}

/**
 * Initialize a Paystack payment transaction
 * @param payload Payment initialization payload
 * @returns Paystack API response
 */
export async function initializepaystack(
  payload: PaystackInitializePayload
): Promise<PaystackResponse> {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured');
  }

  if (PAYSTACK_SECRET_KEY.startsWith('pk_')) {
    throw new Error('Invalid PAYSTACK_SECRET_KEY: appears to be a public key, not secret key');
  }

  try {
    const response = await axios.post<PaystackResponse>(
      'https://api.paystack.co/transaction/initialize',
      payload,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Paystack initialization error:', error.response?.data || error.message);
    throw new Error(
      error.response?.data?.message || 'Failed to initialize Paystack payment'
    );
  }
}

/**
 * Verify a Paystack payment transaction
 * @param reference Payment reference from Paystack
 * @returns Paystack verification response
 */
export async function verifypaystack(reference: string): Promise<PaystackResponse> {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured');
  }

  try {
    const response = await axios.get<PaystackResponse>(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Paystack verification error:', error.response?.data || error.message);
    throw new Error(
      error.response?.data?.message || 'Failed to verify Paystack payment'
    );
  }
}

/**
 * Initiate a Paystack refund request
 */
export async function createPaystackRefund(payload: PaystackRefundPayload): Promise<PaystackResponse> {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured');
  }

  try {
    const response = await axios.post<PaystackResponse>(
      'https://api.paystack.co/refund',
      payload,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Paystack refund error:', error.response?.data || error.message);
    throw new Error(
      error.response?.data?.message || 'Failed to initiate Paystack refund'
    );
  }
}
