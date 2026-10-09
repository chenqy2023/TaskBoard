import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { VersionsModule } from '../versions/versions.module';

@Module({
  imports: [VersionsModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
