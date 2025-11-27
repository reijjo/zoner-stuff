import { Injectable, Logger } from '@nestjs/common';
import { Saga, ICommand, ofType } from '@nestjs/cqrs';
import { EMPTY, Observable, filter, first, map, mergeMap, race, timer } from 'rxjs';
import { AlarmAcknowledgedEvent } from '../../domain/events/alarm-acknowledged.event';
import { AlarmCreatedEvent } from '../../domain/events/alarm-created.event';
import { NotifyFacilitySupervisorCommand } from '../commands/notify-facility-supervisor.command';

@Injectable()
export class UnacknowledgedAlarmsSaga {
  private readonly logger = new Logger(UnacknowledgedAlarmsSaga.name);

  @Saga()
  start = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(AlarmCreatedEvent),
      mergeMap((alarmCreatedEvent) => {
        const alarmId = alarmCreatedEvent.alarm.id;

        return race(
          events$.pipe(
            ofType(AlarmAcknowledgedEvent),
            filter(
              (alarmAcknowledgedEvent) =>
                alarmAcknowledgedEvent.alarmId === alarmId,
            ),
            first(),
            mergeMap(() => EMPTY),
          ),
          timer(15000).pipe(map(() => alarmCreatedEvent)),
        );
      }),
      map((alarmCreatedEvent) => {
        this.logger.debug(
          `Warning! Alarm "${alarmCreatedEvent.alarm.name}" not acknowledged in 15 seconds!`,
        );

        const facilityId = '54321';
        return new NotifyFacilitySupervisorCommand(facilityId, [
          alarmCreatedEvent.alarm.id,
        ]);
      }),
    );
  };
}
