import { Injectable } from '@nestjs/common';
import { CreateAlarmRepository } from 'src/alarms/application/ports/create-alarm.repository';
import { Alarm } from 'src/alarms/domain/alarm';
import { AlarmMapper } from '../mappers/alarm.mapper';
import { AlarmEntity } from '../entities/alarm-entity';
import { FindAlarmsRepository } from 'src/alarms/application/ports/find-alarm.repository';
import { UpsertMaterializedAlarmRepository } from 'src/alarms/application/ports/upsert-materialized-alarm.repository';
import { AlarmReadModel } from 'src/alarms/domain/read-models/alarm.read-model';

@Injectable()
export class InMemoryAlarmRepository
  implements
    CreateAlarmRepository,
    FindAlarmsRepository,
    UpsertMaterializedAlarmRepository
{
  private readonly alarms = new Map<string, AlarmEntity>();
  private readonly materializedAlarmViews = new Map<string, AlarmReadModel>();

  async findAll(): Promise<AlarmReadModel[]> {
    return Array.from(this.materializedAlarmViews.values());
  }

  async save(alarm: Alarm): Promise<Alarm> {
    const persistanceModel = AlarmMapper.toPersistence(alarm);
    this.alarms.set(persistanceModel.id, persistanceModel);

    const newEntity = this.alarms.get(persistanceModel.id);
    return AlarmMapper.toDomain(newEntity);
  }

  async upsert(
    alarm: Pick<AlarmReadModel, 'id'> & Partial<AlarmReadModel>,
  ): Promise<void> {
    const existing = this.materializedAlarmViews.get(alarm.id);
    if (existing) {
      const next = {
        ...existing,
        ...alarm,
      };

      if (alarm.isAcknowledged === false) {
        delete next.acknowledgedAt;
      }

      if (alarm.acknowledgedAt && next.isAcknowledged) {
        next.acknowledgedAt = alarm.acknowledgedAt;
      }

      this.materializedAlarmViews.set(alarm.id, next);
      return;
    }

    if (alarm.isAcknowledged === false) {
      delete alarm.acknowledgedAt;
    }
    this.materializedAlarmViews.set(alarm.id, alarm as AlarmReadModel);
  }
}
