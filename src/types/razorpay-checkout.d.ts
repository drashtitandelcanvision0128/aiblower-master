export type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpayOpenOptions = {
  key: string;
  amount?: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; contact?: string; email?: string };
  handler: (response: RazorpayHandlerResponse) => void | Promise<void>;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
};

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOpenOptions) => { open: () => void };
  }
}

export {};
