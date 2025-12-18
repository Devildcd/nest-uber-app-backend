import { Test, TestingModule } from '@nestjs/testing';
import { PrepaidPlansService } from './prepaid-plans.service';

describe('PrepaidPlansService', () => {
  let service: PrepaidPlansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrepaidPlansService],
    }).compile();

    service = module.get<PrepaidPlansService>(PrepaidPlansService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
