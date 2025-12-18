import { Test, TestingModule } from '@nestjs/testing';
import { PrepaidPlansController } from './prepaid-plans.controller';

describe('PrepaidPlansController', () => {
  let controller: PrepaidPlansController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrepaidPlansController],
    }).compile();

    controller = module.get<PrepaidPlansController>(PrepaidPlansController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
