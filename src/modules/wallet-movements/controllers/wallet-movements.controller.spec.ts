import { Test, TestingModule } from '@nestjs/testing';
import { WalletMovementsController } from './wallet-movements.controller';

describe('WalletMovementsController', () => {
  let controller: WalletMovementsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletMovementsController],
    }).compile();

    controller = module.get<WalletMovementsController>(
      WalletMovementsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
