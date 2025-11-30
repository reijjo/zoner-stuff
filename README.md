# zoner-stuff

# First things first

- `docker-compose.yml` file has an extra "N" on the version

```yml
Nversion: '3.8'
services:
  write-db:
    image: postgres
    ports:
```

Nversion -> version

- Open docker
- Run `make setup`
- Run `pnpm start:dev` to run the app

# Bugs found & fixed

## src/alarms/integration/alarm-sagas.interaction.spec.ts

We can see in the testfile that `AlarmAcknowledgedEvent` is mocked with

```ts
 AlarmAcknowledgedEvent: class AlarmAcknowledgedEventStub {
    constructor(
      public readonly alarmId: string,
      public readonly acknowledgedAt?: Date,
    ) {}
```

So we need to make some changes to the `src/alarms/domain/alarm.ts` file:

```ts
export class Alarm extends VersionedAggregateRoot {
  public name: string;
  public severity: AlarmSeverity;
  public triggeredAt: Date;
  public isAcknowledged = false;
  public acknowledgedAt?: Date;	// <-- We add this
  public items = new Array<AlarmItem>();

 ...

  [`on${AlarmAcknowledgedEvent.name}`](
    event: SerializedEventPayload<AlarmAcknowledgedEvent>,
  ) {
    if (this.isAcknowledged == true) {
      throw new Error('Alarm has already been acknowledged');
    }
    this.isAcknowledged = true;
    this.acknowledgedAt = new Date(event.acknowledgedAt);	// <-- And this
  }
}
```

And also some changes to `src/alarms/domain/events/alarm-acknowledged.event.ts` file:

```ts
import { AutowiredEvent } from 'src/shared/decorators/autowired-event.decorator';

@AutowiredEvent
export class AlarmAcknowledgedEvent {
  constructor(
    public readonly alarmId: string,
    public readonly acknowledgedAt: string = new Date().toISOString(), // <-- Add this
  ) {}
}
```

- `toISOString()` because we want to keep the **handle** in `src/alarms/application/event-handlers/alarm-acknowledged.event-handler.ts`file happy.

## src/alarms/integration/alarm-sagas.interaction.spec.ts

_Alarm sagas mesh › storms acked before either window stay quiet_
We modify the `bufferTime` in the events pipe

- `src/alarms/application/sagas/cascading-alarms.saga.ts`

```ts
...
return events$.pipe(
      ofType(AlarmCreatedEvent),
      groupBy((event) => event.alarm.name),
      mergeMap((groupedEvents$) =>
        groupedEvents$.pipe(
          shareReplay({ bufferSize: 1, refCount: true }),
          // bufferTime(5000, null, 3), <-- What we had
          bufferTime(5000), 	// <-- What we have now
        ),
      ),
...
```

- Removing the **maxBufferSize** restored the intended behavior.
- So instead of collecting all alarms that fire inside the 5-second window, it only collected the first three and flushed too early. The tests expect the system to wait 5 full seconds, not to flush early.

_Alarm sagas mesh › partial ack leaves a single targeted escalation_

- The solution above fixes this too.

_Alarm sagas mesh › acknowledgements during buffer window prevent escalation_

- Too hard for me and my AI friend.

## src/alarms/application/sagas/cascading-alarms-projection.saga.spec.ts

_CascadingAlarmsSaga scenarios › Escalation stream › midstream signals shut it down_

The `AlarmAcknowledgedEvent` wasn’t used at all, so the saga only looked at `AlarmCreatedEvent` and the `isAcknowledged` flag at creation time. That meant that even if an alarm was acknowledged right after it was created, the saga still thought it was “active” and could escalate it.

- `src/alarms/application/sagas/cascading-alarms.saga.ts`
- I added a Set to track which alarm IDs have been acknowledged.
- The saga now listens to AlarmAcknowledgedEvent and stores those IDs in the set.
- When the 5 second window closes, the saga ignores alarms that have been acknowledged and only escalates if there are 3 or more still not acknowledged.

```ts
export class CascadingAlarmsSaga {
  private readonly logger = new Logger(CascadingAlarmsSaga.name);
  private acknowledgedIds = new Set<string>();	// <-- Here is the set for the ids

  @Saga()
  start = (events$: Observable<any>): Observable<ICommand> => {
		// Listen for AlarmAcknowledgedEvent and store the ids
    events$.pipe(ofType(AlarmAcknowledgedEvent)).subscribe((event) => {
      this.acknowledgedIds.add(event.alarmId);
    });

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
				// Only count alarms that are still not acknowledged
        const active = events.filter(
          (event) =>
            !event.alarm.isAcknowledged &&
            !this.acknowledgedIds.has(event.alarm.id),
        );
        return active.length >= 3;
      }),
		...
```

## src/alarms/application/alarms.service.spec.ts

_AlarmsService › should be defined_

I don't considere this as modifying the tests:

- `src/alarms/application/alarms.service.spec.ts`
- The test needs the CqrsModule

```ts
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CqrsModule],	// <--this
      providers: [AlarmsService],
    }).compile();
```

## src/alarms/presenters/http/alarms.controller.spec.ts

_AlarmsController › should be defined_

- `src/alarms/presenters/http/alarms.controller.spec.ts`
  This needs the same import as above.

## src/shared/infrastructure/event-store/mongo-event-store-concurrency.spec.ts

_MongoEventStore concurrency control › rejects concurrent writes to the same stream when a stale position is detected_

The **UNIQUE_CONSTRAINT_ERROR** was only logged, you need also throw the error

- `src/shared/infrastructure/event-store/mongo-event-store.ts`

```ts
...
	const UNIQUE_CONSTRAINT_ERROR_CODE = 11000;
      if (error?.code === UNIQUE_CONSTRAINT_ERROR_CODE) {
        this.logger.error(
          `Events could not be persisited. Aggregate is stale.`,
        );
        console.error(error.writeErrors?.[0]?.err?.errmsg);
        throw new Error('Events could not be persisited. Aggregate is stale.'); // <-- This was missing
      } else {
        throw error;
      }
		...
```

## src/shared/infrastructure/event-store/mongo-event-store.spec.ts

_MongoEventStore.persist › does not resolve until the Mongo commit promise settles_

Like the test says we don't wait the promise to settle:

- `src/shared/infrastructure/event-store/mongo-event-store.ts`
- We need just add one `await` in the code:

```ts
    const session = await this.eventStore.startSession();
    try {
      session.startTransaction();
      await this.eventStore.insertMany(events, { session, ordered: true });

      await session.commitTransaction();	// <-- This
      this.logger.debug(`Events inserted successfully to the event store`);
    } catch (error) {
      await session.abortTransaction();
```

## src/alarms/integration/event-replay-consistency.integration.spec.ts

_Event replay consistency integration › rebuilds an aggregate from stored events that aligns with the projection state_

The `onAlarmAcknowledgedEvent` handler method was never being called when loading events from history.

- `src/shared/domain/aggregate-root.ts`
- Before, `domainEvents` was just extracting the plain data objects:

```ts
const domainEvents = history.map((event) => event.data);
```

- This gave us plain objects without constructor names, so `@nestjs/cqrs` couldn't match them to handler methods like `onAlarmAcknowledgedEvent`.

- Now we create objects with the correct constructor name from `event.type`:

```ts
const domainEvents = history.map((event) => {
  const instance = Object.create({ constructor: { name: event.type } });
  return Object.assign(instance, event.data);
});
```

- This way `@nestjs/cqrs` can find the right handler method by checking `event.constructor.name`.

- I have to admit that i needed some Claude.ai help for this one.

test suites: 1failed 11passed
tests 3failed 21passed
