import { Test, TestingModule } from '@nestjs/testing';
import { DriverProfileController } from './driver-profiles.controller';

describe('DriverProfilesController', () => {
  let controller: DriverProfileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DriverProfileController],
    }).compile();

    controller = module.get<DriverProfileController>(DriverProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
