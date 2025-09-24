export class TripRequestedEvent {
  constructor(
    public readonly tripId: string,
    public readonly passengerId: string,
    public readonly requestedAt: Date,
  ) {}
}
