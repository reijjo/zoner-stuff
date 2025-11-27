import { Alarm } from './alarm';
import {
  SerializableEvent,
  SerializedEventPayload,
} from 'src/shared/domain/interfaces/serializable-event';
import { AlarmCreatedEvent } from './events/alarm-created.event';
import { AlarmAcknowledgedEvent } from './events/alarm-acknowledged.event';

describe('Alarm aggregate event sourcing guarantees', () => {
  it('preserves event order when replaying concurrent acknowledgements from history', () => {
    const alarm = new Alarm('alarm-race');

    const createdEvent: SerializableEvent<AlarmCreatedEvent> = {
      position: 0,
      streamId: 'alarm-race',
      type: 'AlarmCreatedEvent',
      data: instantiateSerializedEvent(AlarmCreatedEvent, {
        alarm: buildAlarmPayload(
          'alarm-race',
          'Turbine Overspeed',
          'critical',
          '2024-01-01T10:00:00.000Z',
        ),
      }),
    };

    const acknowledgedEvent: SerializableEvent<AlarmAcknowledgedEvent> = {
      position: 1,
      streamId: 'alarm-race',
      type: 'AlarmAcknowledgedEvent',
      data: instantiateSerializedEvent(AlarmAcknowledgedEvent, {
        alarmId: 'alarm-race',
      }),
    };

    expect(() => {
      alarm.loadFromHistory([createdEvent, acknowledgedEvent]);
    }).not.toThrow();

    expect(alarm.isAcknowledged).toBe(true);
    expect(alarm.version.value).toBe(1);
  });

  it('enforces business invariants only during command execution, not event replay', () => {
    const alarm = new Alarm('alarm-double');

    const createdEvent: SerializableEvent<AlarmCreatedEvent> = {
      position: 0,
      streamId: 'alarm-double',
      type: 'AlarmCreatedEvent',
      data: instantiateSerializedEvent(AlarmCreatedEvent, {
        alarm: buildAlarmPayload(
          'alarm-double',
          'Pressure Relief',
          'high',
          '2024-01-01T11:00:00.000Z',
        ),
      }),
    };

    alarm.loadFromHistory([createdEvent]);

    expect(() => alarm.acknowledge()).not.toThrow();
    expect(() => alarm.acknowledge()).toThrow('Alarm has already been acknowledged');
  });
});

function buildAlarmPayload(
  id: string,
  name: string,
  severity: string,
  triggeredAt: string,
): Alarm {
  return {
    id,
    name,
    severity,
    triggeredAt,
    isAcknowledged: false,
    items: [],
  } as unknown as Alarm;
}

function instantiateSerializedEvent<T>(
  EventCls: new (...args: any[]) => T,
  payload: Partial<T>,
): SerializedEventPayload<T> {
  return Object.assign(Object.create(EventCls.prototype), payload);
}
