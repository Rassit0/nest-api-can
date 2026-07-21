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
import { LocationsModule } from './locations/locations.module';
import { PrismaExceptionFilter } from './common/filters/prisma/prisma-exception.filter';
import { InstitutionsModule } from './institutions/institutions.module';
import { ClubsModule } from './clubs/clubs.module';
import { TeamsModule } from './teams/teams.module';
import { PlayersModule } from './players/players.module';
import { TeamSeasonModule } from './team-season/team-season.module';
import { CategoriesModule } from './categories/categories.module';
import { SeasonsModule } from './seasons/seasons.module';
import { PaymentPlansModule } from './payment-plans/payment-plans.module';
import { PlayerMembershipsModule } from './player-memberships/player-memberships.module';
import { MembershipDiscountModule } from './membership-discount/membership-discount.module';
import { StaffModule } from './staff/staff.module';
import { TeamSeasonStaffModule } from './team-season-staff/team-season-staff.module';
import { ChargesModule } from './charges/charges.module';
import { MembershipChargesModule } from './membership-charges/membership-charges.module';
import { MembershipLateFeeModule } from './membership-late-fee/membership-late-fee.module';
import { SchedulesModule } from './schedules/schedules.module';
import { SessionsModule } from './sessions/sessions.module';
import { SessionBookingsModule } from './session-bookings/session-bookings.module';
import { MatchesModule } from './matches/matches.module';
import { MatchLineupsModule } from './match-lineups/match-lineups.module';

// Nuevos módulos RBAC/Seguridad
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

// Nuevos módulos Escolares
import { SchoolsModule } from './schools/schools.module';
import { CoursesModule } from './courses/courses.module';
import { CourseSeasonsModule } from './course-seasons/course-seasons.module';
import { CourseSeasonStaffModule } from './course-season-staff/course-season-staff.module';

// Nuevos módulos de Alumnos e Inscripción/Cobro
import { StudentsModule } from './students/students.module';
import { StudentMembershipsModule } from './student-memberships/student-memberships.module';
import { StudentDiscountsModule } from './student-discounts/student-discounts.module';
import { StudentChargesModule } from './student-charges/student-charges.module';

// Nuevos módulos de Evaluaciones e Incidencias de conducta
import { SessionIncidentsModule } from './session-incidents/session-incidents.module';
import { ProgressEvaluationsModule } from './progress-evaluations/progress-evaluations.module';
import { TransactionsModule } from './transactions/transactions.module';

import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { ClsModule } from 'nestjs-cls';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    ScheduleModule.forRoot(),
    CommonModule,
    PersonsModule,
    DisciplinesModule,
    I18nModule.forRootAsync({
      useFactory: () => ({
        fallbackLanguage: 'es',
        loaderOptions: {
          path: join(__dirname, '/i18n/'),
          watch: true,
        },
      }),
      resolvers: [new HeaderResolver(['x-custom-lang'])],
    }),
    LocationsModule,
    InstitutionsModule,
    ClubsModule,
    TeamsModule,
    PlayersModule,
    TeamSeasonModule,
    CategoriesModule,
    SeasonsModule,
    PaymentPlansModule,
    PlayerMembershipsModule,
    MembershipDiscountModule,
    StaffModule,
    TeamSeasonStaffModule,
    ChargesModule,
    MembershipChargesModule,
    MembershipLateFeeModule,
    SchedulesModule,
    SessionsModule,
    SessionBookingsModule,
    MatchesModule,
    MatchLineupsModule,

    // Registrar nuevos módulos
    PermissionsModule,
    RolesModule,
    UsersModule,
    SchoolsModule,
    CoursesModule,
    CourseSeasonsModule,
    CourseSeasonStaffModule,
    StudentsModule,
    StudentMembershipsModule,
    StudentDiscountsModule,
    StudentChargesModule,
    SessionIncidentsModule,
    ProgressEvaluationsModule,
    TransactionsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaExceptionFilter],
})
export class AppModule {}
