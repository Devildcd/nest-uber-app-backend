import { Test, TestingModule } from '@nestjs/testing';
import { CashColletionRecordsService } from './cash_colletion_records.service';

describe('CashColletionRecordsService', () => {
  let service: CashColletionRecordsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CashColletionRecordsService],
    }).compile();

    service = module.get<CashColletionRecordsService>(
      CashColletionRecordsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
