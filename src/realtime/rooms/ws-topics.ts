export const Rooms = {
  passenger: (passengerId: string) => `passenger:${passengerId}`,
  driver: (driverId: string) => `driver:${driverId}`,
  trip: (tripId: string) => `trip:${tripId}`,
};
