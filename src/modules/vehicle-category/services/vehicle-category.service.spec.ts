import { Test, TestingModule } from '@nestjs/testing';
import { VehicleCategoryService } from './vehicle-category.service';

describe('VehicleCategoryService', () => {
  let service: VehicleCategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VehicleCategoryService],
    }).compile();

    service = module.get<VehicleCategoryService>(VehicleCategoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
