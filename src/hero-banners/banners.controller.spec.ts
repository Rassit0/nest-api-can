import { Test, TestingModule } from '@nestjs/testing';
import { HeroHeroBannersController } from './heroHeroBanners.controller';

describe('HeroHeroBannersController', () => {
  let controller: HeroHeroBannersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HeroHeroBannersController],
    }).compile();

    controller = module.get<HeroHeroBannersController>(HeroHeroBannersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
