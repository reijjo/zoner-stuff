import { Subject, Subscription } from 'rxjs';
import { CascadingAlarmsSaga } from './cascading-alarms.saga';
import { AlarmCreatedEvent } from '../../domain/events/alarm-created.event';
import { AlarmAcknowledgedEvent } from '../../domain/events/alarm-acknowledged.event';
import { NotifyFacilitySupervisorCommand } from '../commands/notify-facility-supervisor.command';
import { AlarmAcknowledgedEventHandler } from '../event-handlers/alarm-acknowledged.event-handler';
import { InMemoryAlarmRepository } from '../../infrastructure/persistence/in-memory/repositories/alarm.repository';

type AlarmLike = {
  id: string;
  name: string;
  severity: string;
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

describe('CascadingAlarmsSaga scenarios', () => {
  describe('Escalation stream', () => {
    let saga: CascadingAlarmsSaga;
    let events$: Subject<any>;
    let emitted: NotifyFacilitySupervisorCommand[];
    let subscription: Subscription;

    beforeEach(() => {
      jest.useFakeTimers();
      saga = new CascadingAlarmsSaga();
      events$ = new Subject();
      emitted = [];
      subscription = saga.start(events$).subscribe((command) => {
        emitted.push(command as NotifyFacilitySupervisorCommand);
      });
    });

    afterEach(() => {
      subscription.unsubscribe();
      jest.useRealTimers();
    });

    it('pre-acked batch stays quiet', () => {
      ['a-1', 'a-2', 'a-3'].forEach((id) => {
        events$.next(
          new AlarmCreatedEvent(buildAlarm(id, 'Cooling Fan', true) as any),
        );
      });

      jest.advanceTimersByTime(5000);

      expect(emitted).toHaveLength(0);
    });

    it('midstream signals shut it down', () => {
      ['b-1', 'b-2', 'b-3'].forEach((id) => {
        events$.next(new AlarmCreatedEvent(buildAlarm(id, 'Drill Press') as any));
        events$.next(new AlarmAcknowledgedEvent(id));
      });

      jest.advanceTimersByTime(5000);
      expect(emitted).toHaveLength(0);
    });

    it('triplet without signals escalates once', () => {
      ['c-1', 'c-2', 'c-3'].forEach((id) => {
        events$.next(
          new AlarmCreatedEvent(buildAlarm(id, 'Hydraulic Pump') as any),
        );
      });

      jest.advanceTimersByTime(5000);

      expect(emitted).toHaveLength(1);
      expect(emitted[0].alarmIds).toEqual(['c-1', 'c-2', 'c-3']);
    });
  });

  describe('Projection sync', () => {
    it('ack traces survive alongside new alarms', async () => {
      const repository = new InMemoryAlarmRepository();
      const handler = new AlarmAcknowledgedEventHandler(repository);

      await repository.upsert({
        id: 'alarm-flapping',
        name: 'Door Sensor',
        severity: 'low',
        triggeredAt: new Date('2024-01-01T10:00:00.000Z'),
        isAcknowledged: false,
        items: [],
      });

      const acknowledgedAt = new Date('2024-01-01T10:00:05.000Z');
      const ackEvent = Object.assign(
        new AlarmAcknowledgedEvent('alarm-flapping'),
        { acknowledgedAt },
      );
      await handler.handle(ackEvent);

      await repository.upsert({
        id: 'alarm-fresh',
        name: 'Door Sensor',
        severity: 'low',
        triggeredAt: new Date('2024-01-01T10:01:00.000Z'),
        isAcknowledged: false,
        items: [],
      });

      const alarms = await repository.findAll();
      const flapping = alarms.find((alarm) => alarm.id === 'alarm-flapping');
      const fresh = alarms.find((alarm) => alarm.id === 'alarm-fresh');

      expect(flapping?.isAcknowledged).toBe(true);
      expect(flapping?.acknowledgedAt?.toISOString()).toBe(
        acknowledgedAt.toISOString(),
      );
      expect(fresh?.isAcknowledged).toBe(false);
      expect(fresh?.acknowledgedAt).toBeUndefined();
    });
  });
});

function buildAlarm(id: string, name: string, isAcknowledged = false): AlarmLike {
  return {
    id,
    name,
    severity: 'high',
    triggeredAt: new Date('2024-01-01T00:00:00.000Z'),
    isAcknowledged,
    items: [],
  };
}
