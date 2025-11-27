import { MongoEventStore } from './mongo-event-store';
import { SerializableEvent } from '../../domain/interfaces/serializable-event';
import { EventDeserializer } from './deserializers/event.deserializer';

describe('MongoEventStore concurrency control', () => {
  it('rejects concurrent writes to the same stream when a stale position is detected', async () => {
    const duplicateKeyError: any = new Error(
      'E11000 duplicate key error collection: events index: streamId_1_position_1',
    );
    duplicateKeyError.code = 11000;
    duplicateKeyError.writeErrors = [
      {
        err: { errmsg: duplicateKeyError.message },
      },
    ];

    const sessionFactory = () => ({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
    });

    const sessions = [sessionFactory(), sessionFactory()];
    let sessionIndex = 0;
    let insertCount = 0;

    const model = {
      startSession: jest
        .fn()
        .mockImplementation(() => Promise.resolve(sessions[sessionIndex++])),
      insertMany: jest.fn().mockImplementation(() => {
        insertCount += 1;
        if (insertCount === 2) {
          throw duplicateKeyError;
        }
        return Promise.resolve(undefined);
      }),
    } as any;

    const deserializer: EventDeserializer = {
      deserialize: jest.fn().mockImplementation((event) => event),
      getEventClassByType: jest.fn(),
      instantiateSerializedEvent: jest.fn(),
    };

    const store = new MongoEventStore(model, deserializer);
    const baseEvent: SerializableEvent = {
      streamId: 'alarm-concurrent',
      type: 'AlarmAcknowledgedEvent',
      position: 2,
      data: { alarmId: 'alarm-concurrent' },
    };

    const firstWrite = store.persist(baseEvent);
    const secondWrite = store.persist({ ...baseEvent });

    await expect(firstWrite).resolves.toBeUndefined();
    await expect(secondWrite).rejects.toThrow(
      'Events could not be persisited. Aggregate is stale.',
    );
    expect(sessions[1].abortTransaction).toHaveBeenCalled();
  });

  it('does not expose uncommitted events to readers while a transaction is in-flight', async () => {
    let commitResolver!: () => void;
    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            commitResolver = resolve;
          }),
      ),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    const storedEvents: SerializableEvent[] = [];
    const pendingEvents: SerializableEvent[] = [];
    const model = {
      startSession: jest.fn().mockResolvedValue(session),
      insertMany: jest
        .fn()
        .mockImplementation((events: SerializableEvent[]) => {
          pendingEvents.push(...events);
          return Promise.resolve(undefined);
        }),
      find: jest
        .fn()
        .mockImplementation(({ streamId }: { streamId: string }) => ({
          sort: jest.fn().mockImplementation(() => {
            const docs = storedEvents
              .filter((event) => event.streamId === streamId)
              .sort((a, b) => a.position - b.position)
              .map((event) => ({ toJSON: () => event }));
            return Promise.resolve(docs);
          }),
        })),
    } as any;

    const deserializer: EventDeserializer = {
      deserialize: jest.fn().mockImplementation((event) => event),
      getEventClassByType: jest.fn(),
      instantiateSerializedEvent: jest.fn(),
    };

    const store = new MongoEventStore(model, deserializer);
    const event: SerializableEvent = {
      streamId: 'alarm-uncommitted',
      type: 'AlarmAcknowledgedEvent',
      position: 1,
      data: { alarmId: 'alarm-uncommitted' },
    };

    const persistPromise = store.persist(event);
    await expect(
      store.getEventsByStreamId('alarm-uncommitted'),
    ).rejects.toThrow('Aggregate with id "alarm-uncommitted" does not exist');

    commitResolver();
    storedEvents.push(...pendingEvents.splice(0));
    await persistPromise;

    const history = await store.getEventsByStreamId('alarm-uncommitted');
    expect(history).toHaveLength(1);
  });
});
