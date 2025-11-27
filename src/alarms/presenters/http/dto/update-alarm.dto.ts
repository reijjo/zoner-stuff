import { PartialType } from '@nestjs/mapped-types';
import { CreateAlarmDTO } from './create-alarm.dto';

export class UpdateAlarmDto extends PartialType(CreateAlarmDTO) {}
