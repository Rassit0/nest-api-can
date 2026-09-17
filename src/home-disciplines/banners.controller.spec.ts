import { Test, TestingModule } from '@nestjs/testing';
import { HomeDisciplinesController } from './homeDisciplines.controller';

describe('HomeDisciplinesController', () => {
  let controller: HomeDisciplinesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HomeDisciplinesController],
    }).compile();

    controller = module.get<HomeDisciplinesController>(HomeDisciplinesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
