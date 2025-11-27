import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetAlarmsQuery } from './get-alarms.query';
import { Logger } from '@nestjs/common';
import { FindAlarmsRepository } from '../ports/find-alarm.repository';
import { AlarmReadModel } from 'src/alarms/domain/read-models/alarm.read-model';

@QueryHandler(GetAlarmsQuery)
export class GetAlarmsQueryHandler
  implements IQueryHandler<GetAlarmsQuery, AlarmReadModel[]>
{
  constructor(private readonly alarmRepository: FindAlarmsRepository) {}

  private readonly logger = new Logger(GetAlarmsQueryHandler.name);

  async execute(query: GetAlarmsQuery): Promise<AlarmReadModel[]> {
    this.logger.debug(`Processing get alarms query: ${JSON.stringify(query)}`);
    return this.alarmRepository.findAll();
  }
}
