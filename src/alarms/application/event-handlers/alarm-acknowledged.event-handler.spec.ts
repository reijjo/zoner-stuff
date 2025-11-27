import { AlarmAcknowledgedEventHandler } from './alarm-acknowledged.event-handler';
import { AlarmAcknowledgedEvent } from '../../domain/events/alarm-acknowledged.event';
import { UpsertMaterializedAlarmRepository } from '../ports/upsert-materialized-alarm.repository';

describe('AlarmAcknowledgedEventHandler determinism', () => {
  it('uses the event payload timestamp instead of wall-clock time', async () => {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const repository: UpsertMaterializedAlarmRepository = {
      upsert,
    };

    const handler = new AlarmAcknowledgedEventHandler(repository);
    const acknowledgedAt = new Date('2024-02-02T10:00:00.000Z');
    const event = Object.assign(new AlarmAcknowledgedEvent('alarm-latency'), {
      acknowledgedAt,
    });

    await handler.handle(event);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'alarm-latency',
        isAcknowledged: true,
        acknowledgedAt,
      }),
    );
  });

  it('is idempotent when replaying the same ack event', async () => {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const repository: UpsertMaterializedAlarmRepository = {
      upsert,
    };

    const handler = new AlarmAcknowledgedEventHandler(repository);
    const acknowledgedAt = new Date('2024-02-02T11:00:00.000Z');
    const event = Object.assign(new AlarmAcknowledgedEvent('alarm-replay'), {
      acknowledgedAt,
    });

    await handler.handle(event);
    await handler.handle(event);

    expect(upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        acknowledgedAt,
      }),
    );
    expect(upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        acknowledgedAt,
      }),
    );
  });
});
