# zoner-stuff

You'll be working with an event-sourced alarm system where several test suites are failing. The tests encode real production bugs we've encountered, and your job is to fix the underlying issues without modifying or deleting the tests themselves. The system uses CQRS and event sourcing, so you'll need to trace how events flow through aggregates, sagas, and projections to find the root causes.

The repository includes a Makefile for common commands. Run make install to set up and make test to see what's failing. Don't modify the tests or remove production code like timeouts or event handlers unless you can clearly justify why. If you get stuck, try diagramming the data flow for one failing test at a time.

Once you're done, commit your changes and write a brief summary covering the bugs you found, your reasoning for each fix, and any trade-offs you made. Push to a GitHub repository and send us the link.

The repository and details are here: https://github.com/kottinov/test-ss

# First things first

- Run `cp .env.example .env`
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
- Run `make install`
- Run `make setup`
- Run `pnpm start:dev` to run the app

## Bugs found & fixed

### AlarmsService - should be defined

`src/alarms/application/alarms.service.spec.ts`

- The `CqrsModule` was missing from the `test/app.e2e-spec.ts` file:

```ts
...
  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, CqrsModule],
    }).compile();
...
```

### Alarms sagas mesh

- `src/alarms/integration/alarm-sagas.interaction.spec.ts `

#### storms acked before either window stay quiet

#### partial ack leaves a single targeted escalation

#### acknowledgements during buffer window prevent escalation

### CascadingAlarmsSaga scenarios

#### Escalation stream - midstream signals shut it down

- `src/alarms/application/sagas/cascading-alarms-projection.saga.spec.ts `

### AlarmsController - should be defined

### AlarmsService - should be defined

### MongoEventStore concurrency control - rejects concurrent writes to the same stream when a stale postition is detected

- `src/shared/infrastructure/event-store/mongo-event-store-concurrency.spec.ts`

### Event replay consistency integration - rebuilds an aggregate from stored events that aligns with the projection state

- `src/alarms/integration/event-replay-consistency.integration.spec.ts`

### MongoEventStore.persist - does not resolve until the Mongo commit promise settles

- `src/shared/infrastructure/event-store/mongo-event-store.spec.ts`
