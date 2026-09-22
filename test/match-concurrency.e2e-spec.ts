import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { MatchesService } from '../src/matches/matches.service';
import { MatchCallUpsService } from '../src/match-call-ups/match-call-ups.service';
import { EventStatus, EventType, MatchResult, MatchSide } from 'src/generated/prisma/client';
import { randomUUID } from 'crypto';

describe('Match Lifecycle Concurrency (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matchesService: MatchesService;
  let callUpsService: MatchCallUpsService;

  const testIds = {
    institution: randomUUID(),
    discipline: randomUUID(),
    clubHome: randomUUID(),
    clubAway: randomUUID(),
    teamHome: randomUUID(),
    teamAway: randomUUID(),
    season: randomUUID(),
    teamSeasonHome: randomUUID(),
    teamSeasonAway: randomUUID(),
    category1: randomUUID(),
    category2: randomUUID(),
    teamSeasonCatHome: randomUUID(),
    teamSeasonCatAway: randomUUID(),
    location: randomUUID(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    matchesService = app.get(MatchesService);
    callUpsService = app.get(MatchCallUpsService);

    // Create a User to satisfy createdById constraint
    const roleId = 'role-123';
    await prisma.role.create({ data: { id: roleId, name: 'Admin Role ' + Date.now() } });
    await prisma.user.create({ data: { id: 'user-123', email: 'test' + Date.now() + '@test.com', password: 'test', roleId: roleId } });

    // Setup base entities
    await prisma.institution.create({ data: { id: testIds.institution, name: 'Concurrency Inst', address: '123' } });
    await prisma.discipline.create({ data: { id: testIds.discipline, name: 'Football', icon: 'test' } });
    await prisma.season.create({ data: { id: testIds.season, name: '2026', institutionId: testIds.institution, disciplineId: testIds.discipline, startDate: new Date(), endDate: new Date() } });
    await prisma.category.create({ data: { id: testIds.category1, name: 'Cat A', minAge: 10, disciplineId: testIds.discipline } });
    await prisma.category.create({ data: { id: testIds.category2, name: 'Cat B', minAge: 10, disciplineId: testIds.discipline } });
    await prisma.club.create({ data: { id: testIds.clubHome, name: 'Home Club', institutionId: testIds.institution, disciplineId: testIds.discipline } });
    await prisma.club.create({ data: { id: testIds.clubAway, name: 'Away Club', institutionId: testIds.institution, disciplineId: testIds.discipline } });
    await prisma.team.create({ data: { id: testIds.teamHome, name: 'Home Team', clubId: testIds.clubHome } });
    await prisma.team.create({ data: { id: testIds.teamAway, name: 'Away Team', clubId: testIds.clubAway } });
    await prisma.teamSeason.create({ data: { id: testIds.teamSeasonHome, teamId: testIds.teamHome, seasonId: testIds.season } });
    await prisma.teamSeason.create({ data: { id: testIds.teamSeasonAway, teamId: testIds.teamAway, seasonId: testIds.season } });
    await prisma.teamSeasonCategory.create({ data: { id: testIds.teamSeasonCatHome, teamSeasonId: testIds.teamSeasonHome, categoryId: testIds.category1, gender: 'MIXED' } });
    await prisma.teamSeasonCategory.create({ data: { id: testIds.teamSeasonCatAway, teamSeasonId: testIds.teamSeasonAway, categoryId: testIds.category2, gender: 'MIXED' } });
    await prisma.location.create({ data: { id: testIds.location, name: 'Stadium', address: '123' } });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.match.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.user.delete({ where: { id: 'user-123' } }).catch(() => {});
    await prisma.role.delete({ where: { id: 'role-123' } }).catch(() => {});
    await prisma.location.delete({ where: { id: testIds.location } });
    await prisma.teamSeasonCategory.deleteMany({ where: { id: { in: [testIds.teamSeasonCatHome, testIds.teamSeasonCatAway] } } });
    await prisma.teamSeason.deleteMany({ where: { id: { in: [testIds.teamSeasonHome, testIds.teamSeasonAway] } } });
    await prisma.team.deleteMany({ where: { id: { in: [testIds.teamHome, testIds.teamAway] } } });
    await prisma.club.deleteMany({ where: { id: { in: [testIds.clubHome, testIds.clubAway] } } });
    await prisma.category.deleteMany({ where: { id: { in: [testIds.category1, testIds.category2] } } });
    await prisma.season.delete({ where: { id: testIds.season } });
    await prisma.discipline.delete({ where: { id: testIds.discipline } });
    await prisma.institution.delete({ where: { id: testIds.institution } });
    await app.close();
  });

  async function createTestMatch(offsetHours = 0) {
    const start = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    return await matchesService.create({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      locationId: testIds.location,
      homeTeamId: testIds.teamHome,
      awayTeamId: testIds.teamAway,
      homeTeamSeasonCategoryId: testIds.teamSeasonCatHome,
      awayTeamSeasonCategoryId: testIds.teamSeasonCatAway,
      homeScore: 0,
      awayScore: 0,
      type: 'LEAGUE' as any,
    }, 'user-123');
  }

  describe('Transition vs Transition', () => {
    it('COMPLETE vs CANCEL: One wins, the other fails', async () => {
      const matchRes = await createTestMatch();
      const matchId = matchRes.data.id;
      // Fetch event ID safely
      const matchDb = await prisma.match.findUnique({ where: { id: matchId }, select: { eventId: true } });
      const eventId = matchDb.eventId;
      
      const completePromise = matchesService.completeMatch(matchId).catch(e => e);
      const cancelPromise = matchesService.cancelMatch(matchId).catch(e => e);

      const [res1, res2] = await Promise.all([completePromise, cancelPromise]);

      const isOneSuccess = 
        (!(res1 instanceof Error) && (res2 instanceof Error)) || 
        (!(res2 instanceof Error) && (res1 instanceof Error));
      expect(isOneSuccess).toBeTruthy();

      const finalEvent = await prisma.event.findUnique({ where: { id: eventId } });
      
      if (res1.message && res1.message.includes('completado')) {
        expect(finalEvent.status).toBe(EventStatus.COMPLETED);
      } else if (res2.message && res2.message.includes('cancelado')) {
        expect(finalEvent.status).toBe(EventStatus.CANCELLED);
      }
    });
  });

  describe('Mutation vs Transition', () => {
    it('PATCH vs COMPLETE: Valid serialization', async () => {
      const matchRes = await createTestMatch(24);
      const matchId = matchRes.data.id;
      
      const updatePromise = matchesService.update(matchId, { homeScore: 2, awayScore: 1 }).catch(e => e);
      const completePromise = matchesService.completeMatch(matchId).catch(e => e);

      const [patchRes, completeRes] = await Promise.all([updatePromise, completePromise]);

      const finalMatch = await prisma.match.findUnique({ where: { id: matchId }, include: { event: true } });

      if (completeRes.message && completeRes.message.includes('completado') && patchRes instanceof Error) {
        // complete WON -> patch failed
        expect(patchRes.message).toMatch(/SCHEDULED|cancelado|completado|estado actual/);
        expect(finalMatch.homeScore).toBe(0);
        expect(finalMatch.awayScore).toBe(0);
      } else if (patchRes.message && patchRes.message.includes('actualizado') && completeRes.message && completeRes.message.includes('completado')) {
        // patch WON -> complete succeeded after
        expect(finalMatch.homeScore).toBe(2);
        expect(finalMatch.awayScore).toBe(1);
      } else {
        throw new Error(`Unexpected results: PATCH: ${JSON.stringify(patchRes)}, COMPLETE: ${JSON.stringify(completeRes)}`);
      }
    });
  });
});
