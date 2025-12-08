export type DriverSlimForPassengerDto = {
  id: string;
  name: string | null;
  photoUrl: string | null;
  phoneMasked: string | null; // ej: +53 ••• ••123
  phone: string | null;
  ratingAvg: number | null; // null si aún no implementas ratings
  ratingCount: number | null; // null si aún no implementas ratings
};

export interface PassengerSlimForDriverDto {
  id: string;
  name: string | null;
  photoUrl: string | null;
  phoneMasked: string | null;
}

export type VehicleSlimForPassengerDto = {
  id: string;
  make: string | null;
  model: string | null;
  color: string | null;
  plateNumber: string | null;
};
