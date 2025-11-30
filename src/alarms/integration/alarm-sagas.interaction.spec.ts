import { merge, Subject, Subscription } from 'rxjs';
import { CascadingAlarmsSaga } from '../application/sagas/cascading-alarms.saga';
import { UnacknowledgedAlarmsSaga } from '../application/sagas/unacknowledged-alarms.saga';
import { AlarmCreatedEvent } from '../domain/events/alarm-created.event';
import { AlarmAcknowledgedEvent } from '../domain/events/alarm-acknowledged.event';
import { AlarmCreatedEventHandler } from '../application/event-handlers/alarm-created.event-handler';
import { AlarmAcknowledgedEventHandler } from '../application/event-handlers/alarm-acknowledged.event-handler';
import { InMemoryAlarmRepository } from '../infrastructure/persistence/in-memory/repositories/alarm.repository';
import { ICommand } from '@nestjs/cqrs';
import { NotifyFacilitySupervisorCommand } from '../application/commands/notify-facility-supervisor.command';

type AlarmShape = {
  id: string;
  name: string;
  severity: string;
  triggeredAt: Date;
  isAcknowledged: boolean;
  items: Array<{ id: string; name: string; type: string }>;
};

jest.mock('../domain/events/alarm-created.event', () => ({
  AlarmCreatedEvent: class AlarmCreatedEventStub {
    constructor(public readonly alarm: AlarmShape) {}
  },
}));

jest.mock('../domain/events/alarm-acknowledged.event', () => ({
  AlarmAcknowledgedEvent: class AlarmAcknowledgedEventStub {
    constructor(
      public readonly alarmId: string,
      public readonly acknowledgedAt?: Date,
    ) {}
  },
}));

describe('Alarm sagas mesh', () => {
  let events$: Subject<any>;
  let outputs: ICommand[];
  let subscription: Subscription;
  let cascading: CascadingAlarmsSaga;
  let unack: UnacknowledgedAlarmsSaga;
  let repository: InMemoryAlarmRepository;
  let createdHandler: AlarmCreatedEventHandler;
  let ackHandler: AlarmAcknowledgedEventHandler;

  beforeEach(() => {
    jest.useFakeTimers();
    events$ = new Subject();
    outputs = [];
    cascading = new CascadingAlarmsSaga();
    unack = new UnacknowledgedAlarmsSaga();
    repository = new InMemoryAlarmRepository();
    createdHandler = new AlarmCreatedEventHandler(repository);
    ackHandler = new AlarmAcknowledgedEventHandler(repository);
    subscription = merge(
      cascading.start(events$),
      unack.start(events$),
    ).subscribe((command) => {
      outputs.push(command);
    });
  });

  afterEach(() => {
    subscription.unsubscribe();
    jest.useRealTimers();
  });

  it('storms acked before either window stay quiet', async () => {
    await raiseCreate('storm-1');
    await raiseCreate('storm-2');
    await raiseCreate('storm-3');

    jest.advanceTimersByTime(4000);
    await raiseAck('storm-1', '2024-01-01T00:00:04.000Z');
    await raiseAck('storm-2', '2024-01-01T00:00:04.000Z');
    await raiseAck('storm-3', '2024-01-01T00:00:04.000Z');

    jest.advanceTimersByTime(2000);
    jest.advanceTimersByTime(15000);

    expect(outputs).toHaveLength(0);
    const views = await repository.findAll();
    expect(views.map((view) => view.isAcknowledged)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('partial ack leaves a single targeted escalation', async () => {
    await raiseCreate('wave-1');
    await raiseCreate('wave-2');
    await raiseCreate('wave-3');

    jest.advanceTimersByTime(4000);
    await raiseAck('wave-1', '2024-01-01T00:00:04.000Z');
    await raiseAck('wave-2', '2024-01-01T00:00:04.000Z');

    jest.advanceTimersByTime(2000);
    jest.advanceTimersByTime(9000);

    expect(outputs).toHaveLength(1);
    const cmd = outputs[0] as NotifyFacilitySupervisorCommand;
    expect(cmd.alarmIds).toEqual(['wave-3']);

    const views = await repository.findAll();
    const lookup = Object.fromEntries(views.map((view) => [view.id, view]));
    expect(lookup['wave-1'].isAcknowledged).toBe(true);
    expect(lookup['wave-2'].isAcknowledged).toBe(true);
    expect(lookup['wave-3'].isAcknowledged).toBe(false);
  });

  it('acknowledgements during buffer window prevent escalation', async () => {
    await raiseCreate('rapid-1');
    await raiseCreate('rapid-2');

    jest.advanceTimersByTime(2000);
    await raiseAck('rapid-1', '2024-01-01T00:00:02.000Z');

    await raiseCreate('rapid-3');

    jest.advanceTimersByTime(4000);
    jest.advanceTimersByTime(15000);

    expect(outputs).toHaveLength(0);
    const lookup = await viewMap();
    expect(lookup['rapid-1'].isAcknowledged).toBe(true);
    expect(lookup['rapid-2'].isAcknowledged).toBe(false);
    expect(lookup['rapid-3'].isAcknowledged).toBe(false);
  });

  function buildAlarm(id: string): AlarmShape {
    return {
      id,
      name: 'Process Cell',
      severity: 'high',
      triggeredAt: new Date('2024-01-01T00:00:00.000Z'),
      isAcknowledged: false,
      items: [],
    };
  }

  async function raiseCreate(id: string) {
    const alarm = buildAlarm(id);
    const correlationId = `${id}-corr`;
    const sagaEvent = Object.assign(new AlarmCreatedEvent(alarm as any), {
      correlationId,
    });
    events$.next(sagaEvent);
    await createdHandler.handle({ alarm, correlationId } as any);
  }

  async function raiseAck(id: string, at: string) {
    const sagaEvent = Object.assign(new AlarmAcknowledgedEvent(id), {
      acknowledgedAt: new Date(at),
    });
    events$.next(sagaEvent);
    await ackHandler.handle({
      alarmId: id,
      acknowledgedAt: new Date(at),
    } as any);
  }

  async function viewMap() {
    const views = await repository.findAll();
    return Object.fromEntries(views.map((view) => [view.id, view]));
  }
});
