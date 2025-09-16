import { Test, TestingModule } from '@nestjs/testing';
import { DriverBalanceService } from './driver_balance.service';

describe('DriverBalanceService', () => {
  let service: DriverBalanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DriverBalanceService],
    }).compile();

    service = module.get<DriverBalanceService>(DriverBalanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
