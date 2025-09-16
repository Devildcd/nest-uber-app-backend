import { Expose } from 'class-transformer';
import { PaymentType } from '../entities/order.entity';

export class OrderDataDto {
  @Expose()
  id: string;

  @Expose()
  tripId: string;

  @Expose()
  passengerId: string;

  @Expose()
  driverId: string;

  @Expose()
  requestedAmount: string;

  @Expose()
  status: string;

  @Expose()
  paymentType: PaymentType;

  @Expose()
  currency: string;

  @Expose()
  paymentIntentId?: string;

  @Expose()
  paymentGatewayResponse?: Record<string, any>;

  @Expose()
  paymentMethodDetails?: Record<string, any>;

  @Expose()
  failureReason?: string;

  @Expose()
  createdAt?: string;

  @Expose()
  updatedAt?: string;

  @Expose()
  deletedAt?: string;
}
