import { Test, TestingModule } from '@nestjs/testing';
import { TripHelpersService } from './trip-helpers.service';

describe('TripHelpersService', () => {
  let service: TripHelpersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TripHelpersService],
    }).compile();

    service = module.get<TripHelpersService>(TripHelpersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
