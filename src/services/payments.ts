import Stripe from 'stripe';
import { Database } from '../database/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

interface CreatePaymentIntentData {
  amount: number;
  currency?: string;
  orderId: string;
  customerId: string;
  description?: string;
}

class PaymentServiceClass {
  async createPaymentIntent(data: CreatePaymentIntentData) {
    try {
      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100), // Convert to cents
        currency: data.currency || 'usd',
        description: data.description || `Order payment`,
        metadata: {
          orderId: data.orderId,
          customerId: data.customerId,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Update order with payment intent
      await Database.query(
        `UPDATE orders
         SET payment_intent_id = $1, payment_status = 'pending'
         WHERE id = $2`,
        [paymentIntent.id, data.orderId]
      );

      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  async confirmPayment(paymentIntentId: string) {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);

      // Update order payment status
      await Database.query(
        `UPDATE orders
         SET payment_status = 'paid'
         WHERE payment_intent_id = $1`,
        [paymentIntentId]
      );

      return paymentIntent;
    } catch (error) {
      console.error('Error confirming payment:', error);

      // Update order payment status to failed
      await Database.query(
        `UPDATE orders
         SET payment_status = 'failed'
         WHERE payment_intent_id = $1`,
        [paymentIntentId]
      );

      throw error;
    }
  }

  async refundPayment(paymentIntentId: string, amount?: number) {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      // Update order payment status
      await Database.query(
        `UPDATE orders
         SET payment_status = 'refunded'
         WHERE payment_intent_id = $1`,
        [paymentIntentId]
      );

      return refund;
    } catch (error) {
      console.error('Error refunding payment:', error);
      throw error;
    }
  }

  async handleWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.handlePaymentSuccess(paymentIntent);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        await this.handlePaymentFailure(failedPayment);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata.orderId;

    await Database.query(
      `UPDATE orders
       SET payment_status = 'paid', status = 'confirmed'
       WHERE id = $1`,
      [orderId]
    );

    console.log(`Payment succeeded for order ${orderId}`);
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata.orderId;

    await Database.query(
      `UPDATE orders
       SET payment_status = 'failed'
       WHERE id = $1`,
      [orderId]
    );

    console.log(`Payment failed for order ${orderId}`);
  }

  // Phone payment collection (PCI-compliant via Stripe)
  async collectPhonePayment(cardDetails: {
    number: string;
    expMonth: number;
    expYear: number;
    cvc: string;
  }, paymentIntentId: string) {
    try {
      // Create payment method
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: cardDetails.number,
          exp_month: cardDetails.expMonth,
          exp_year: cardDetails.expYear,
          cvc: cardDetails.cvc,
        },
      });

      // Confirm payment intent with payment method
      const confirmedIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethod.id,
      });

      return confirmedIntent;
    } catch (error) {
      console.error('Error collecting phone payment:', error);
      throw error;
    }
  }
}

export const PaymentService = new PaymentServiceClass();
