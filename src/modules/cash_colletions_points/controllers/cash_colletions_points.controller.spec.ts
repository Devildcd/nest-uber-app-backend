import { Test, TestingModule } from '@nestjs/testing';
import { CashColletionsPointsController } from './cash_colletions_points.controller';

describe('CashColletionsPointsController', () => {
  let controller: CashColletionsPointsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CashColletionsPointsController],
    }).compile();

    controller = module.get<CashColletionsPointsController>(
      CashColletionsPointsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
