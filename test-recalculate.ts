import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma.service';
import { MembershipChargesService } from './src/membership-charges/membership-charges.service';
import { MembershipGenerationService } from './src/membership-charges/services/membership-generation.service';
import { DateUtils } from './src/utils/date.utils';

async function runTest() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const chargesService = app.get(MembershipChargesService);
  const generationService = app.get(MembershipGenerationService);

  console.log('1. Setting up seed data...');
  const user = await prisma.user.findFirst();

  // Find or create required relations
  const institution = await prisma.institution.findFirst() ?? await prisma.institution.create({ data: { name: 'Test Inst ' + Date.now(), address: 'Test' } });
  const discipline = await prisma.discipline.findFirst() ?? await prisma.discipline.create({ data: { name: 'Test Disc ' + Date.now(), icon: 'test' } });
  const club = await prisma.club.findFirst() ?? await prisma.club.create({ data: { name: 'Test Club ' + Date.now(), institutionId: institution.id, disciplineId: discipline.id } });
  const category = await prisma.category.findFirst() ?? await prisma.category.create({ data: { name: 'Test Category ' + Date.now(), maxAge: 99, minAge: 0, disciplineId: discipline.id } });

  const person = await prisma.person.create({
    data: {
      name: 'Test',
      lastName: 'Recalculate',
      documentNumber: 'DOC-' + Date.now(),
      documentType: 'CI',
      gender: 'MALE',
      birthDate: new Date('2010-01-01'),
    }
  });

  const player = await prisma.player.create({
    data: {
      personId: person.id,
      isActive: true,
    }
  });

  const season = await prisma.season.create({
    data: {
      name: 'Season Test ' + Date.now(),
      institutionId: institution.id,
      disciplineId: discipline.id,
      startDate: new Date('2024-01-01T00:00:00Z'),
      endDate: new Date('2024-12-31T23:59:59Z'),
    }
  });

  const team = await prisma.team.create({
    data: { name: 'Team Test', description: 'Test', clubId: club.id }
  });

  const teamSeason = await prisma.teamSeason.create({
    data: {
      teamId: team.id,
      seasonId: season.id,
      categoryId: category.id,
      gender: 'MIXED',
      maxMembers: 20,
      minMembers: 5,
      billingType: 'MONTHLY_ONLY',
      billingFrequency: 'MONTHLY',
      billingDay: 5,
      chargeGenerationDaysBefore: 7,
      recurringFee: 100,
    }
  });

  const normalPlan = await prisma.paymentPlan.create({
    data: {
      teamSeasonId: teamSeason.id,
      name: 'Normal Plan',
      isSinglePayment: false,
      advanceCycles: 1,
      recurringDiscountPercent: 0,
    }
  });

  const trimestralPlan = await prisma.paymentPlan.create({
    data: {
      teamSeasonId: teamSeason.id,
      name: 'Trimestral Plan',
      isSinglePayment: false,
      advanceCycles: 3,
      advanceCyclesDiscountPercent: 10,
    }
  });

  const membership = await prisma.playerMembership.create({
    data: {
      playerId: player.id,
      teamSeasonId: teamSeason.id,
      paymentPlanId: normalPlan.id,
      status: 'ACTIVE',
      startedAt: new Date('2024-01-01T00:00:00Z'),
      isMigrated: false,
    }
  });

  console.log('2. Running initial generation (Eval: 2024-01-01)');
  const membershipWithRels = await prisma.playerMembership.findUnique({
    where: { id: membership.id },
    include: { teamSeason: { include: { season: true } }, paymentPlan: true, membershipDiscounts: true }
  });

  await prisma.$transaction(async (tx) => {
    await generationService.ensureMembershipCharges(tx, membershipWithRels!, new Date('2024-01-01T10:00:00Z'));
  });

  let charges = await prisma.membershipCharge.findMany({ where: { playerMembershipId: membership.id }, include: { charge: true } });
  console.log(`Charges generated initially: ${charges.length}`);
  charges.forEach(c => console.log(` - ${c.charge.description}: Amount: ${c.charge.amount}`));

  console.log('3. Fast forwarding to mid-season (April 1st) and changing plan...');
  // Simulating time passing and changing plan mid-season
  await prisma.playerMembership.update({
    where: { id: membership.id },
    data: { paymentPlanId: trimestralPlan.id }
  });

  // Pay all existing charges to avoid them being deleted
  for (const mc of charges) {
     await prisma.charge.update({
       where: { id: mc.chargeId },
       data: { pendingAmount: 0 }
     });
  }

  // Now, recalculate pending future charges!
  console.log('4. Calling recalculatePendingFutureCharges...');
  // We mock DateUtils.getStartOfUTCDay for the service? No we can't easily mock.
  // The service uses new Date(). So it will use today's date!
  // Wait, if it uses today's date (e.g. 2026), it will generate all charges up to 2026!
  
  await chargesService.recalculatePendingFutureCharges(membership.id);

  console.log('5. Let\'s see the result...');
  charges = await prisma.membershipCharge.findMany({ where: { playerMembershipId: membership.id }, include: { charge: true }, orderBy: { charge: { dueDate: 'asc' } } });
  
  console.log(`Total charges now: ${charges.length}`);
  charges.forEach(c => console.log(` - ${c.charge.description}: Amount: ${c.charge.amount} | Due: ${c.charge.dueDate}`));

  await app.close();
}

runTest().catch(console.error);
