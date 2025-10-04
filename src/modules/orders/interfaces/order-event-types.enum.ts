export type DomainEvent = { name: string; payload: Record<string, any> };
export enum OrderEventType {
  CREATED = 'order.created',
  PAID = 'order.paid',
  FAILED = 'order.failed',
  REFUNDED = 'order.refunded',
  CANCELLED = 'order.cancelled',
  STATUS_CHANGED = 'order.status.changed',

  CHARGE_CREATED = 'order.charge.created',
  CHARGE_PROCESSED = 'order.charge.processed',
  CHARGE_FAILED = 'order.charge.failed',

  PAYMENT_INTENT_CREATED = 'order.payment_intent.created',
  PAYMENT_CONFIRMED = 'order.payment.confirmed',
  PAYMENT_FAILED = 'order.payment.failed',
  PAYMENT_REVERSED = 'order.payment.reversed',

  COMMISSION_APPLIED = 'order.commission.applied',
  COMMISSION_REVERSED = 'order.commission.reversed',
  COMMISSION_ADJUSTED = 'order.commission.adjusted',
}
