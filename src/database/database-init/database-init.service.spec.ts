import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseInitService } from './database-init.service';

describe('DatabaseInitService', () => {
  let service: DatabaseInitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseInitService],
    }).compile();

    service = module.get<DatabaseInitService>(DatabaseInitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
