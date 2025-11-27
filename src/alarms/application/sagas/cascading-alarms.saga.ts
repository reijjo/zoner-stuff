import { Injectable, Logger } from '@nestjs/common';
import { ICommand, Saga, ofType } from '@nestjs/cqrs';
import {
  Observable,
  bufferTime,
  filter,
  groupBy,
  map,
  mergeMap,
  shareReplay,
} from 'rxjs';
import { AlarmAcknowledgedEvent } from '../../domain/events/alarm-acknowledged.event';
import { AlarmCreatedEvent } from '../../domain/events/alarm-created.event';
import { NotifyFacilitySupervisorCommand } from '../commands/notify-facility-supervisor.command';

@Injectable()
export class CascadingAlarmsSaga {
  private readonly logger = new Logger(CascadingAlarmsSaga.name);

  @Saga()
  start = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(AlarmCreatedEvent),
      groupBy((event) => event.alarm.name),
      mergeMap((groupedEvents$) =>
        groupedEvents$.pipe(
          shareReplay({ bufferSize: 1, refCount: true }),
          bufferTime(5000, null, 3),
        ),
      ),
      filter((events) => {
        const active = events.filter((event) => !event.alarm.isAcknowledged);
        return active.length >= 3;
      }),
      map((events) => {
        this.logger.debug(`Three alarms were triggered during 5 seconds`);
        const facilityId = '54321';

        return new NotifyFacilitySupervisorCommand(
          facilityId,
          events.map((event) => event.alarm.id),
          events[events.length - 1]?.alarm['correlationId'],
        );
      }),
    );
  };
}
