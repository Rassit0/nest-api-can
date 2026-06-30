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
import { MembershipChargeGeneratorService } from './membership-charge-generator/membership-charge-generator.service';
import { MembershipLateFeeModule } from './membership-late-fee/membership-late-fee.module';
import { SchedulesModule } from './schedules/schedules.module';
import { SessionsModule } from './sessions/sessions.module';
import { SessionBookingsModule } from './session-bookings/session-bookings.module';
import { MatchesModule } from './matches/matches.module';
import { MatchLineupsModule } from './match-lineups/match-lineups.module';

@Module({
  imports: [
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaExceptionFilter,
    MembershipChargeGeneratorService,
  ],
})
export class AppModule {}
