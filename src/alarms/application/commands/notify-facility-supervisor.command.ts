export class NotifyFacilitySupervisorCommand {
  constructor(
    public readonly facilityId: string,
    public readonly alarmIds: string[],
    public readonly correlationId?: string,
  ) {}
}
