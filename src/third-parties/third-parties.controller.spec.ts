import { Test, TestingModule } from '@nestjs/testing';
import { ThirdPartiesController } from './third-parties.controller';

describe('ThirdPartiesController', () => {
  let controller: ThirdPartiesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ThirdPartiesController],
    }).compile();

    controller = module.get<ThirdPartiesController>(ThirdPartiesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
