import { Injectable } from '@nestjs/common';
import { CalendarQueriesService } from './calendar-queries.service';
import { CalendarFilterDto } from './dto/calendar-filter.dto';
import { 
  CalendarEventResponse, 
  SessionCalendarMetadata,
  MatchCalendarMetadata,
  GeneralEventCalendarMetadata
} from './dto/calendar-response.dto';
import { EventType } from 'src/generated/prisma/client';

@Injectable()
export class CalendarService {
  constructor(private readonly calendarQueries: CalendarQueriesService) {}

  async getCalendarView(filter: CalendarFilterDto): Promise<CalendarEventResponse[]> {
    // 1. (Opcional a futuro) Validar permisos del usuario que consulta (RBAC).
    // if (!this.canViewEvent(user, ...)) ...
    
    // 2. Traer la base de eventos del QueryService
    const rawEvents = await this.calendarQueries.findCalendarEvents(filter);

    // 3. Mapeo a un contrato unificado
    return rawEvents.map((event) => {
      let metadata: any = {};

      if (event.eventType === EventType.SESSION && event.session) {
        const sessionMeta: SessionCalendarMetadata = {
          durationMin: event.session.durationMin,
          teams: event.session.sessionTeams.map(st => ({
            id: st.teamSeason.id,
            name: st.teamSeason.team.name
          })),
          courses: event.session.sessionCourses.map(sc => ({
            id: sc.courseSeason.id,
            name: sc.courseSeason.course.name
          }))
        };
        metadata = sessionMeta;
      } 
      else if (event.eventType === EventType.MATCH && event.match) {
        const matchMeta: MatchCalendarMetadata = {
          opponentName: event.match.opponentName,
          matchType: event.match.type,
          result: event.match.result,
          team: event.match.teamSeason ? {
            id: event.match.teamSeason.id,
            name: event.match.teamSeason.team.name
          } : null
        };
        metadata = matchMeta;
      }
      else if (event.eventType === EventType.GENERAL && event.generalEvent) {
        const genMeta: GeneralEventCalendarMetadata = {
          institutionId: event.generalEvent.institutionId,
          teamSeasonId: event.generalEvent.teamSeasonId,
          courseSeasonId: event.generalEvent.courseSeasonId
        };
        metadata = genMeta;
      }

      const response: CalendarEventResponse = {
        id: event.id,
        title: event.title,
        type: event.eventType,
        startDate: event.startDate,
        endDate: event.endDate,
        status: event.status, // Si está CANCELLED, el frontend lo recibirá y decidirá cómo pintarlo
        color: event.color,
        location: event.location ? {
          id: event.location.id,
          name: event.location.name,
        } : null,
        series: event.eventSeriesId ? {
          id: event.eventSeriesId,
          isRecurring: true,
        } : null,
        metadata
      };

      return response;
    });
  }
}
