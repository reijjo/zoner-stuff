export class AlarmSeverity {
  constructor(readonly value: 'critical' | 'high' | 'medium' | 'low') {}

  equals(severity: AlarmSeverity): boolean {
    return this.value === severity.value;
  }

  toJSON() {
    return this.value;
  }
}
