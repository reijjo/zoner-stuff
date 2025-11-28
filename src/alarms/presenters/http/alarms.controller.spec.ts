import { Test, TestingModule } from '@nestjs/testing';
import { AlarmsController } from './alarms.controller';
import { AlarmsService } from '../../application/alarms.service';
import { CqrsModule } from '@nestjs/cqrs';

describe('AlarmsController', () => {
  let controller: AlarmsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CqrsModule],
      controllers: [AlarmsController],
      providers: [AlarmsService],
    }).compile();

    controller = module.get<AlarmsController>(AlarmsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
