import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAlarmRepository } from 'src/alarms/application/ports/create-alarm.repository';
import { Alarm } from 'src/alarms/domain/alarm';
import { AlarmMapper } from '../mappers/alarm.mapper';
import { AlarmEntity } from '../entities/alarm-entity';

@Injectable()
export class OrmCreateAlarmRepository implements CreateAlarmRepository {
  constructor(
    @InjectRepository(AlarmEntity)
    private readonly alarmRepository: Repository<AlarmEntity>,
  ) {}

  async save(alarm: Alarm): Promise<Alarm> {
    return AlarmMapper.toDomain(
      await this.alarmRepository.save(AlarmMapper.toPersistence(alarm)),
    );
  }
}
