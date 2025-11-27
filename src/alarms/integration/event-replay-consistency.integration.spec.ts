import { MongoEventStore } from 'src/shared/infrastructure/event-store/mongo-event-store';
import { SerializableEvent } from 'src/shared/domain/interfaces/serializable-event';
import { EventDeserializer } from 'src/shared/infrastructure/event-store/deserializers/event.deserializer';
import { AlarmAcknowledgedEventHandler } from '../application/event-handlers/alarm-acknowledged.event-handler';
import { InMemoryAlarmRepository } from '../infrastructure/persistence/in-memory/repositories/alarm.repository';
import { AlarmAcknowledgedEvent } from '../domain/events/alarm-acknowledged.event';
import { Alarm } from '../domain/alarm';

describe('Event replay consistency integration', () => {
  let storedEvents: SerializableEvent[];
  let mongoModel: any;
  let eventStore: MongoEventStore;
  let repository: InMemoryAlarmRepository;
  let handler: AlarmAcknowledgedEventHandler;

  beforeEach(() => {
    storedEvents = [];
    repository = new InMemoryAlarmRepository();
    handler = new AlarmAcknowledgedEventHandler(repository);

    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    mongoModel = {
      startSession: jest.fn().mockResolvedValue(session),
      insertMany: jest
        .fn()
        .mockImplementation((events: SerializableEvent[]) => {
          storedEvents.push(...events);
          return Promise.resolve(undefined);
        }),
      find: jest
        .fn()
        .mockImplementation(({ streamId }: { streamId: string }) => ({
          sort: jest.fn().mockImplementation(() => {
            const sorted = storedEvents
              .filter((event) => event.streamId === streamId)
              .sort((left, right) => left.position - right.position)
              .map((event) => ({ toJSON: () => event }));
            return Promise.resolve(sorted);
          }),
        })),
    };

    const deserializer: EventDeserializer = {
      deserialize: jest.fn().mockImplementation((event) => event),
      getEventClassByType: jest.fn(),
      instantiateSerializedEvent: jest.fn(),
    };

    eventStore = new MongoEventStore(mongoModel, deserializer);
  });

  it('rebuilds an aggregate from stored events that aligns with the projection state', async () => {
    const aggregateId = 'alarm-integration';
    const createdEvent: SerializableEvent = {
      streamId: aggregateId,
      position: 0,
      type: 'AlarmCreatedEvent',
      data: {
        alarm: {
          id: aggregateId,
          name: 'Pump Failure',
          severity: 'high',
          triggeredAt: '2024-01-01T10:00:00.000Z',
          isAcknowledged: false,
          items: [],
        },
      },
    };

    const acknowledgedAt = new Date('2024-01-01T10:05:00.000Z');
    const acknowledgedEvent: SerializableEvent = {
      streamId: aggregateId,
      position: 1,
      type: 'AlarmAcknowledgedEvent',
      data: {
        alarmId: aggregateId,
        acknowledgedAt,
      },
    };

    await eventStore.persist([createdEvent, acknowledgedEvent]);

    await repository.upsert({
      id: aggregateId,
      name: 'Pump Failure',
      severity: 'high',
      triggeredAt: new Date('2024-01-01T10:00:00.000Z'),
      isAcknowledged: false,
      items: [],
    });

    const ackEvent = Object.assign(new AlarmAcknowledgedEvent(aggregateId), {
      acknowledgedAt,
    });
    await handler.handle(ackEvent);

    const history = await eventStore.getEventsByStreamId(aggregateId);
    const rehydratedAlarm = new Alarm(aggregateId);
    rehydratedAlarm.loadFromHistory(history);

    const [projection] = await repository.findAll();

    expect(rehydratedAlarm.isAcknowledged).toBe(true);
    expect(projection.isAcknowledged).toBe(true);
    expect(projection.acknowledgedAt?.toISOString()).toBe(
      acknowledgedAt.toISOString(),
    );
  });

  it('materialized view upserts retain immutable fields across partial updates', async () => {
    const triggeredAt = new Date('2024-01-01T08:00:00.000Z');
    await repository.upsert({
      id: 'alarm-upsert-test',
      name: 'Generator Fault',
      severity: 'critical',
      triggeredAt,
      isAcknowledged: false,
      items: [{ name: 'Generator #1', type: 'power' }],
    });

    await repository.upsert({
      id: 'alarm-upsert-test',
      isAcknowledged: true,
      acknowledgedAt: new Date('2024-01-01T08:05:00.000Z'),
    });

    await repository.upsert({
      id: 'alarm-upsert-test',
      severity: 'high',
    });

    const [projection] = await repository.findAll();
    expect(projection.name).toBe('Generator Fault');
    expect(projection.severity).toBe('high');
    expect(projection.isAcknowledged).toBe(true);
    expect(projection.acknowledgedAt).toBeDefined();
    expect(projection.items).toHaveLength(1);
    expect(projection.triggeredAt.toISOString()).toBe(
      triggeredAt.toISOString(),
    );
  });
});
