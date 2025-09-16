import { Test, TestingModule } from '@nestjs/testing';
import { DriverBalanceController } from './driver_balance.controller';

describe('DriverBalanceController', () => {
  let controller: DriverBalanceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DriverBalanceController],
    }).compile();

    controller = module.get<DriverBalanceController>(DriverBalanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
