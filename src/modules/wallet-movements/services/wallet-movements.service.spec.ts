import { Test, TestingModule } from '@nestjs/testing';
import { WalletMovementsService } from './wallet-movements.service';

describe('WalletMovementsService', () => {
  let service: WalletMovementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletMovementsService],
    }).compile();

    service = module.get<WalletMovementsService>(WalletMovementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
