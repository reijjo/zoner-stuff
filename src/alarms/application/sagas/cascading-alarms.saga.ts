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
  private acknowledgedIds = new Set<string>();

  @Saga()
  start = (events$: Observable<any>): Observable<ICommand> => {
    events$.pipe(ofType(AlarmAcknowledgedEvent)).subscribe((event) => {
      this.acknowledgedIds.add(event.alarmId);
    });

    return events$.pipe(
      ofType(AlarmCreatedEvent),
      groupBy((event) => event.alarm.name),
      mergeMap((groupedEvents$) =>
        groupedEvents$.pipe(
          shareReplay({ bufferSize: 1, refCount: true }),
          bufferTime(5000),
        ),
      ),
      filter((events) => {
        const active = events.filter(
          (event) =>
            !event.alarm.isAcknowledged &&
            !this.acknowledgedIds.has(event.alarm.id),
        );

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
