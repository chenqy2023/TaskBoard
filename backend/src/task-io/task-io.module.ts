import { Module } from '@nestjs/common';
import { TaskIoService } from './task-io.service';
import { TaskIoController } from './task-io.controller';
import { ActivitiesModule } from '../activities/activities.module';

@Module({
  imports: [ActivitiesModule],
  controllers: [TaskIoController],
  providers: [TaskIoService],
})
export class TaskIoModule {}
