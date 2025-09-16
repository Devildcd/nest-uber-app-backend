import { Test, TestingModule } from '@nestjs/testing';
import { CashColletionRecordsController } from './cash_colletion_records.controller';

describe('CashColletionRecordsController', () => {
  let controller: CashColletionRecordsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CashColletionRecordsController],
    }).compile();

    controller = module.get<CashColletionRecordsController>(
      CashColletionRecordsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
