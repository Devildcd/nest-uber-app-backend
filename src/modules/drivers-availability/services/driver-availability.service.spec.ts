import { Test, TestingModule } from '@nestjs/testing';
import { DriverAvailabilityService } from './driver-availability.service';

describe('DriverAvailabilityService', () => {
  let service: DriverAvailabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DriverAvailabilityService],
    }).compile();

    service = module.get<DriverAvailabilityService>(DriverAvailabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
