import { MongoEventStore } from './mongo-event-store';
import { SerializableEvent } from '../../domain/interfaces/serializable-event';
import { EventDeserializer } from './deserializers/event.deserializer';

describe('MongoEventStore.persist', () => {
  const event: SerializableEvent = {
    streamId: 'alarm-123',
    type: 'AlarmCreatedEvent',
    position: 0,
    data: { foo: 'bar' },
  };

  it('does not resolve until the Mongo commit promise settles', async () => {
    let resolveCommit!: () => void;
    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveCommit = resolve;
          }),
      ),
      abortTransaction: jest.fn(),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    const model = {
      startSession: jest.fn().mockResolvedValue(session),
      insertMany: jest.fn().mockResolvedValue(undefined),
    } as any;

    const store = new MongoEventStore(model, {
      deserialize: jest.fn(),
    } as unknown as EventDeserializer);

    const persistPromise = store.persist(event);
    let completed = false;
    persistPromise.then(() => {
      completed = true;
    });

    await flushMicrotasks();
    expect(completed).toBe(false);

    resolveCommit();
    await persistPromise;
    expect(completed).toBe(true);
  });
});

async function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}
