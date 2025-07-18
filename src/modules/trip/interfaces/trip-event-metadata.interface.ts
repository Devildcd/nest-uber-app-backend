/**
 * Base interface for any TripEvent metadata.
 * Allows flexibility for unexpected or additional fields.
 */
export interface TripEventMetadataBase {
  [key: string]: any;
}

/**
 * Metadata for when a trip is requested.
 */
export interface TripRequestedMetadata extends TripEventMetadataBase {
  requestedBy: string;             // ID or name of who requested
  pickupEstimateMinutes?: number;  // Estimated pickup time in minutes
}

/**
 * Metadata for driver location update events.
 */
export interface DriverLocationUpdateMetadata extends TripEventMetadataBase {
  lat: number;     // Latitude of driver
  lng: number;     // Longitude of driver
  accuracy?: number; // GPS accuracy in meters
}

/**
 * Metadata for payment failed events.
 */
export interface PaymentFailedMetadata extends TripEventMetadataBase {
  reason: string;         // Failure reason code or message
  retryAvailable?: boolean; // Whether passenger can retry payment
}

/**
 * Metadata for payment confirmed events.
 */
export interface PaymentConfirmedMetadata extends TripEventMetadataBase {
  amount: number;           // Amount charged
  currency: string;         // Currency code (e.g., 'USD')
  transactionId?: string;   // External transaction reference
}

export interface PassengerCancelledMetadata extends TripEventMetadataBase {
  reason: string;            // Reason provided by passenger
  penaltyApplied?: boolean;  // Whether a cancellation penalty was applied
}

/**
 * Metadata for driver cancellation events.
 */
export interface DriverCancelledMetadata extends TripEventMetadataBase {
  reason: string;            // Reason provided by driver
  penaltyApplied?: boolean;  // Whether a cancellation penalty was applied
}

/**
 * Metadata for system cancellation events.
 */
export interface SystemCancelledMetadata extends TripEventMetadataBase {
  reason: string;            // System-generated reason code or message
  systemCode?: string;       // Internal cancellation code
}

/**
 * Union type of all specific TripEvent metadata interfaces.
 */
export type ITripEventMetadata =
  | TripRequestedMetadata
  | DriverLocationUpdateMetadata
  | PaymentFailedMetadata
  | PaymentConfirmedMetadata
  | PassengerCancelledMetadata
  | DriverCancelledMetadata
  | SystemCancelledMetadata
  | TripEventMetadataBase; // Fallback for any other metadata
