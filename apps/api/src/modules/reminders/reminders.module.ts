import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { RemindersJob } from './reminders.job';

@Module({
  imports: [MeetingsModule, EventsModule],
  providers: [RemindersJob],
  exports: [RemindersJob],
})
export class RemindersModule {}
