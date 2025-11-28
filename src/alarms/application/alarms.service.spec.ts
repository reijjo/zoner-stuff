import { Test, TestingModule } from '@nestjs/testing';
import { AlarmsService } from './alarms.service';
import { CqrsModule } from '@nestjs/cqrs';

describe('AlarmsService', () => {
  let service: AlarmsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [AlarmsService],
    }).compile();

    service = module.get<AlarmsService>(AlarmsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
