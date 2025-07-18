import { Test, TestingModule } from '@nestjs/testing';
import { DriverProfileService } from './driver-profile.service';

describe('DriverProfileService', () => {
  let service: DriverProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DriverProfileService],
    }).compile();

    service = module.get<DriverProfileService>(DriverProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
