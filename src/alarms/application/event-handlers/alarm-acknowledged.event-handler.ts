import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { AlarmAcknowledgedEvent } from 'src/alarms/domain/events/alarm-acknowledged.event';
import { SerializedEventPayload } from 'src/shared/domain/interfaces/serializable-event';
import { UpsertMaterializedAlarmRepository } from '../ports/upsert-materialized-alarm.repository';

@EventsHandler(AlarmAcknowledgedEvent)
export class AlarmAcknowledgedEventHandler
  implements IEventHandler<SerializedEventPayload<AlarmAcknowledgedEvent>>
{
  private readonly logger = new Logger(AlarmAcknowledgedEventHandler.name);

  constructor(
    private readonly upsertMaterializedAlarmRepository: UpsertMaterializedAlarmRepository,
  ) {}

  async handle(event: AlarmAcknowledgedEvent) {
    this.logger.log(`Alarm acknowledged event: ${JSON.stringify(event)}`);

    await this.upsertMaterializedAlarmRepository.upsert({
      id: event.alarmId,
      isAcknowledged: true,
      acknowledgedAt: (event as any).acknowledgedAt ?? new Date(),
    });
  }
}
