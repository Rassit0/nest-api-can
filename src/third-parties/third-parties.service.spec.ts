import { Test, TestingModule } from '@nestjs/testing';
import { ThirdPartiesService } from './third-parties.service';

describe('ThirdPartiesService', () => {
  let service: ThirdPartiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThirdPartiesService],
    }).compile();

    service = module.get<ThirdPartiesService>(ThirdPartiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
