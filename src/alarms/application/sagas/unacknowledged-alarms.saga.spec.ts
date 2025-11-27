import { Subject, Subscription } from 'rxjs';
import { UnacknowledgedAlarmsSaga } from './unacknowledged-alarms.saga';
import { AlarmCreatedEvent } from '../../domain/events/alarm-created.event';
import { AlarmAcknowledgedEvent } from '../../domain/events/alarm-acknowledged.event';
import { NotifyFacilitySupervisorCommand } from '../commands/notify-facility-supervisor.command';
import type { Alarm } from '../../domain/alarm';

type AlarmLike = {
  id: string;
  name: string;
  severity: { value: string };
  triggeredAt: Date;
  isAcknowledged: boolean;
  items: Array<{ id: string; name: string; type: string }>;
};

jest.mock('../../domain/events/alarm-created.event', () => ({
  AlarmCreatedEvent: class AlarmCreatedEventStub {
    constructor(public readonly alarm: AlarmLike) {}
  },
}));

jest.mock('../../domain/events/alarm-acknowledged.event', () => ({
  AlarmAcknowledgedEvent: class AlarmAcknowledgedEventStub {
    constructor(public readonly alarmId: string) {}
  },
}));

describe('UnacknowledgedAlarmsSaga cases', () => {
  let saga: UnacknowledgedAlarmsSaga;
  let events$: Subject<any>;
  let emittedCommands: NotifyFacilitySupervisorCommand[];
  let subscription: Subscription;

  beforeEach(() => {
    jest.useFakeTimers();
    saga = new UnacknowledgedAlarmsSaga();
    events$ = new Subject();
    emittedCommands = [];
    subscription = saga.start(events$).subscribe((command) => {
      if (command instanceof NotifyFacilitySupervisorCommand) {
        emittedCommands.push(command);
      }
    });
  });

  afterEach(() => {
    subscription.unsubscribe();
    jest.useRealTimers();
  });

  it('ack beats timer', () => {
    const alarm = buildAlarm('alarm-ack', 'Steam Drum');
    events$.next(new AlarmCreatedEvent(alarm));

    jest.advanceTimersByTime(5000);
    events$.next(new AlarmAcknowledgedEvent(alarm.id));
    jest.advanceTimersByTime(15000);

    expect(emittedCommands).toHaveLength(0);
  });

  it('timer wins when ack missing', () => {
    const breachingAlarm = buildAlarm('alarm-breach', 'Contactor Failure');
    const compliantAlarm = buildAlarm('alarm-no-breach', 'Door Sensor');

    events$.next(new AlarmCreatedEvent(breachingAlarm));
    events$.next(new AlarmCreatedEvent(compliantAlarm));

    jest.advanceTimersByTime(7000);
    events$.next(new AlarmAcknowledgedEvent(compliantAlarm.id));

    jest.advanceTimersByTime(8000);

    expect(emittedCommands).toHaveLength(1);
    expect(emittedCommands[0].alarmIds).toEqual([breachingAlarm.id]);
  });
});

function buildAlarm(id: string, name: string): Alarm {
  return {
    id,
    name,
    severity: { value: 'high' },
    triggeredAt: new Date('2024-01-01T00:00:00.000Z'),
    isAcknowledged: false,
    items: [
      {
        id: 'sensor-1',
        name: 'Pressure Sensor',
        type: 'temperature',
      },
    ],
  } as unknown as Alarm;
}
