import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AcknowledgeAlarmCommand } from './acknowledge-alarm.command';
import { Logger } from '@nestjs/common';
import { AggregateRehydrator } from 'src/shared/application/aggregate-rehydrator';
import { Alarm } from 'src/alarms/domain/alarm';

@CommandHandler(AcknowledgeAlarmCommand)
export class AcknowledgeAlarmCommandHandler
  implements ICommandHandler<AcknowledgeAlarmCommand>
{
  private readonly logger = new Logger(AcknowledgeAlarmCommandHandler.name);

  constructor(private readonly aggregateRehydator: AggregateRehydrator) {}

  async execute(command: AcknowledgeAlarmCommand) {
    this.logger.debug(
      `Processing "AcknowledgeAlarmCommand": ${JSON.stringify(command)}`,
    );

    const alarm = await this.aggregateRehydator.rehydrate(
      command.alarmId,
      Alarm,
    );

    alarm.acknowledge();
    alarm.commit();

    return alarm;
  }
}
