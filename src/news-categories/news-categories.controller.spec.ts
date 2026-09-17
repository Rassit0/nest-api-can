import { Test, TestingModule } from '@nestjs/testing';
import { NewsCategoriesController } from './news-categories.controller';

describe('NewsCategoriesController', () => {
  let controller: NewsCategoriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsCategoriesController],
    }).compile();

    controller = module.get<NewsCategoriesController>(NewsCategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
