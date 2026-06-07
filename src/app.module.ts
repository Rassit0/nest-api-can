import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { PersonsModule } from './persons/persons.module';
import { DisciplinesModule } from './disciplines/disciplines.module';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import path, { join } from 'path';
import { ActivitiesModule } from './activities/activities.module';
import { LocationsModule } from './locations/locations.module';
import { PrismaExceptionFilter } from './common/filters/prisma/prisma-exception.filter';
import { MatchDetailModule } from './match-detail/match-detail.module';
import { EventsModule } from './events/events.module';
import { MatchesModule } from './matches/matches.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ClubsModule } from './clubs/clubs.module';
import { TeamsModule } from './teams/teams.module';
import { TeamSeasonsModule } from './team-seasons/team-seasons.module';
import { PlayerPassesModule } from './player-passes/player-passes.module';
import { PlayersModule } from './players/players.module';
import { StudentsModule } from './students/students.module';

@Module({
  imports: [
    CommonModule,
    PersonsModule,
    DisciplinesModule,
    I18nModule.forRootAsync({
      useFactory: () => ({
        fallbackLanguage: 'es',
        loaderOptions: {
          path: join(__dirname, 'i18n'),
          watch: process.env.NODE_ENV !== 'production',
        },
        typesOutputPath: join(process.cwd(), 'src/i18n/i18n.generated.ts'),
      }),
      resolvers: [new HeaderResolver(['x-custom-lang'])],
    }),
    ActivitiesModule,
    LocationsModule,
    MatchDetailModule,
    EventsModule,
    MatchesModule,
    OrganizationsModule,
    ClubsModule,
    TeamsModule,
    TeamSeasonsModule,
    PlayerPassesModule,
    PlayersModule,
    StudentsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaExceptionFilter],
})
export class AppModule {}
