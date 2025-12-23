export interface IPrepaidPlan {
  id: string;
  name: string;
  description?: string | null;
  tripsIncluded?: number | null;
  discountPct?: string | null;
  fixedDiscountAmount?: string | null;
  expiresInDays?: number | null;
  price: string;
  currency: string;
  isActive: boolean;
  planFeatures?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}
