export class AlarmReadModel {
  id: string;
  name: string;
  severity: string;
  triggeredAt: Date;
  isAcknowledged: boolean;
  acknowledgedAt?: Date;
  items: Array<{ name: string; type: string }>;
  correlationId?: string;
}
