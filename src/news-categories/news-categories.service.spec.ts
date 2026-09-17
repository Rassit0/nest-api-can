import { Test, TestingModule } from '@nestjs/testing';
import { NewsCategoriesService } from './news-categories.service';

describe('NewsCategoriesService', () => {
  let service: NewsCategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NewsCategoriesService],
    }).compile();

    service = module.get<NewsCategoriesService>(NewsCategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
