import { InMemoryAlarmRepository } from './alarm.repository';
import { AlarmReadModel } from 'src/alarms/domain/read-models/alarm.read-model';

const BASE_VIEW: AlarmReadModel = {
  id: 'alarm-materialized',
  name: 'Boiler Overheat',
  severity: 'high',
  triggeredAt: new Date('2024-01-01T00:00:00.000Z'),
  isAcknowledged: false,
  items: [
    {
      name: 'Boiler #3',
      type: 'temperature',
    },
  ],
};

describe('InMemoryAlarmRepository materialized views', () => {
  it('persists a new view on the first upsert call', async () => {
    const repository = new InMemoryAlarmRepository();

    await repository.upsert(BASE_VIEW);
    const all = await repository.findAll();

    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: BASE_VIEW.id, name: BASE_VIEW.name });
  });

  it('retains existing fields when patching subset of properties', async () => {
    const repository = new InMemoryAlarmRepository();

    await repository.upsert(BASE_VIEW);
    await repository.upsert({
      id: BASE_VIEW.id,
      isAcknowledged: true,
      acknowledgedAt: new Date('2024-01-01T00:10:00.000Z'),
    });

    const [materialized] = await repository.findAll();

    expect(materialized.name).toBe(BASE_VIEW.name);
    expect(materialized.isAcknowledged).toBe(true);
    expect(materialized.triggeredAt.toISOString()).toBe(
      BASE_VIEW.triggeredAt.toISOString(),
    );
    expect(materialized.acknowledgedAt?.toISOString()).toBe(
      '2024-01-01T00:10:00.000Z',
    );
  });

  it('drops acknowledgedAt when toggled back to false', async () => {
    const repository = new InMemoryAlarmRepository();

    await repository.upsert(BASE_VIEW);
    await repository.upsert({
      id: BASE_VIEW.id,
      isAcknowledged: true,
      acknowledgedAt: new Date('2024-01-01T00:10:00.000Z'),
    });
    await repository.upsert({
      id: BASE_VIEW.id,
      isAcknowledged: false,
    });

    const [materialized] = await repository.findAll();
    expect(materialized.isAcknowledged).toBe(false);
    expect(materialized.acknowledgedAt).toBeUndefined();
  });
});
