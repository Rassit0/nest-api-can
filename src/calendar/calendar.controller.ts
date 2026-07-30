import { Controller, Get, Query } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarFilterDto } from './dto/calendar-filter.dto';
import { CalendarEventResponse } from './dto/calendar-response.dto';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  async getCalendarEvents(
    @Query() filter: CalendarFilterDto
  ): Promise<{ events: CalendarEventResponse[] }> {
    const events = await this.calendarService.getCalendarView(filter);
    return { events };
  }
}
