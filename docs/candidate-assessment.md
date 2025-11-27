# Candidate Assessment: Alarm SLA War Games

Hi, this is the "alarm war room" :) The goal of this exercise is to bring the entire CQRS/event-sourcing pipeline back into a trustworthy state. The suite below encodes real production regressions. Please be careful, some patience is required.

## Your Mission

Run the unit test suite and make every failure pass **without** deleting or rewriting the tests.

### Suites in scope

1. `src/alarms/application/event-handlers/alarm-acknowledged.event-handler.spec.ts`
2. `src/alarms/application/sagas/unacknowledged-alarms.saga.spec.ts`
3. `src/alarms/application/sagas/cascading-alarms-projection.saga.spec.ts`
4. `src/alarms/domain/alarm.aggregate.spec.ts`
5. `src/alarms/infrastructure/persistence/in-memory/repositories/in-memory-alarm.repository.spec.ts`
6. `src/alarms/integration/event-replay-consistency.integration.spec.ts`
7. `src/shared/infrastructure/event-store/mongo-event-store.spec.ts`
8. `src/shared/infrastructure/event-store/mongo-event-store-concurrency.spec.ts`
9. `src/alarms/integration/alarm-sagas.interaction.spec.ts`

8. **`src/alarms/integration/event-replay-consistency.integration.spec.ts`**
   - Integration test verifying write model (event store) and read model (projections) stay consistent.
   - This test may pass initially but break when candidates "fix" other tests incorrectly.

## Ground Rules

- **Stay focused on behavior.** These specs deliberately cross architectural boundaries so that "just mocking things" won't help.
- **No shortcuts.** Do not remove timeouts, observers, or map/reduce logic from production code unless you can explain why the behavior is redundant.

If you get stuck, diagram the data flow for one failing spec at a time. Good luck! 