# zoner-stuff

You'll be working with an event-sourced alarm system where several test suites are failing. The tests encode real production bugs we've encountered, and your job is to fix the underlying issues without modifying or deleting the tests themselves. The system uses CQRS and event sourcing, so you'll need to trace how events flow through aggregates, sagas, and projections to find the root causes.

The repository includes a Makefile for common commands. Run make install to set up and make test to see what's failing. Don't modify the tests or remove production code like timeouts or event handlers unless you can clearly justify why. If you get stuck, try diagramming the data flow for one failing test at a time.

Once you're done, commit your changes and write a brief summary covering the bugs you found, your reasoning for each fix, and any trade-offs you made. Push to a GitHub repository and send us the link.

The repository and details are here: https://github.com/kottinov/test-ss

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

_Alarm sagas mesh › storms acked before either window stay quiet_

_Alarm sagas mesh › partial ack leaves a single targeted escalation_

_Alarm sagas mesh › acknowledgements during buffer window prevent escalation_

## src/alarms/application/sagas/cascading-alarms-projection.saga.spec.ts

_CascadingAlarmsSaga scenarios › Escalation stream › midstream signals shut it down_

## src/alarms/application/alarms.service.spec.ts

_AlarmsService › should be defined_

I don't considere this as modifying the tests:

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

This needs the same import as above.

## src/shared/infrastructure/event-store/mongo-event-store-concurrency.spec.ts

_MongoEventStore concurrency control › rejects concurrent writes to the same stream when a stale position is detected_

The **UNIQUE_CONSTRAINT_ERROR** was only logged, you need also throw the error

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
