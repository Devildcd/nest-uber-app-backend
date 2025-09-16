import { Test, TestingModule } from '@nestjs/testing';
import { CashColletionsPointsService } from './cash_colletions_points.service';

describe('CashColletionsPointsService', () => {
  let service: CashColletionsPointsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CashColletionsPointsService],
    }).compile();

    service = module.get<CashColletionsPointsService>(
      CashColletionsPointsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
