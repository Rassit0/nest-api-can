import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';

jest.mock('uuid', () => ({
  v4: () => randomUUID(),
}));

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { StudentMembershipsService } from '../src/student-memberships/student-memberships.service';
import {
  StudentMembershipStatus,
  StatusCourseSeason,
  TypeMembershipCharge,
  StatusCharge,
  CycleEnrollmentStatus,
  ProgramGender,
  SeasonStatus
} from 'src/generated/prisma/client';
import { CourseSeasonsService } from '../src/course-seasons/course-seasons.service';

describe('Fase 7 - Transfer QA Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let membershipsService: StudentMembershipsService;
  let courseSeasonsService: CourseSeasonsService;

  const createdIds = {
    institutions: [] as string[],
    persons: [] as string[],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    membershipsService = app.get(StudentMembershipsService);
    courseSeasonsService = app.get(CourseSeasonsService);
  });

  afterAll(async () => {
    try {
      const schedulerRegistry = app.get(require('@nestjs/schedule').SchedulerRegistry);
      schedulerRegistry.getCronJobs().forEach((job: any) => job.stop());
      schedulerRegistry.getIntervals().forEach((interval: any) => clearInterval(schedulerRegistry.getInterval(interval)));
      schedulerRegistry.getTimeouts().forEach((timeout: any) => clearTimeout(schedulerRegistry.getTimeout(timeout)));
    } catch (e) {}
    for (const id of createdIds.institutions) {
      await prisma.cycleEnrollment.deleteMany({ where: { studentMembership: { courseSeason: { season: { institutionId: id } } } } });
      await prisma.studentCharge.deleteMany({ where: { studentMembership: { courseSeason: { season: { institutionId: id } } } } });
      const studentCharges = await prisma.studentCharge.findMany({ where: { studentMembership: { courseSeason: { season: { institutionId: id } } } } });
      const chargeIds = studentCharges.map(sc => sc.chargeId);
      await prisma.studentCharge.deleteMany({ where: { chargeId: { in: chargeIds } } });
      await prisma.charge.deleteMany({ where: { id: { in: chargeIds } } });
      
      await prisma.studentMembershipHistory.deleteMany({ where: { studentMembership: { courseSeason: { season: { institutionId: id } } } } });
      await prisma.studentMembership.deleteMany({ where: { courseSeason: { season: { institutionId: id } } } });
      await prisma.paymentPlan.deleteMany({ where: { courseSeason: { season: { institutionId: id } } } });
      
      await prisma.courseSeasonShift.deleteMany({ where: { courseSeason: { season: { institutionId: id } } } });
      await prisma.courseSeasonBillingConfig.deleteMany({ where: { courseSeason: { season: { institutionId: id } } } });
      await prisma.courseSeason.deleteMany({ where: { season: { institutionId: id } } });
      
      await prisma.season.deleteMany({ where: { institutionId: id } });
      await prisma.course.deleteMany({ where: { school: { institutionId: id } } });
      await prisma.school.deleteMany({ where: { institutionId: id } });
      await prisma.shift.deleteMany({ where: { institutionId: id } });
      await prisma.institution.delete({ where: { id } });
    }
    for (const id of createdIds.persons) {
      await prisma.student.deleteMany({ where: { personId: id } });
      await prisma.person.delete({ where: { id } });
    }

    await app.close();
    await prisma.$disconnect();
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  describe('Escenario de Transferencia (F-I)', () => {
    let instId: string;
    let discId: string;
    let schoolId: string;
    let courseId: string;
    let seasonId: string;
    let categoryId: string;
    
    let regularSeasonId: string;
    let regularMorningShiftId: string;
    let regularAfternoonShiftId: string;
    
    let premiumSeasonId: string;
    let premiumNightShiftId: string;

    let personId: string;
    let studentId: string;
    let membershipId: string;
    let pastChargeId: string;
    let futureCycleId: string;

    beforeAll(async () => {
      const inst = await prisma.institution.create({ data: { name: 'Inst Transfer QA', address: '123' } });
      instId = inst.id;
      createdIds.institutions.push(instId);

      const disc = await prisma.discipline.create({ data: { name: 'Disciplina QA', icon: 'sport' } });
      discId = disc.id;

      const cat = await prisma.category.create({ data: { name: 'Cat QA', minAge: 5, disciplineId: discId } });
      categoryId = cat.id;

      const school = await prisma.school.create({ data: { name: 'School QA', institutionId: instId, disciplineId: discId } });
      schoolId = school.id;

      const course = await prisma.course.create({ data: { name: 'Course QA', schoolId } });
      courseId = course.id;

      const season = await prisma.season.create({
        data: {
          name: 'Season QA',
          institutionId: instId,
          disciplineId: discId,
          startDate: new Date('2026-08-01T00:00:00Z'),
          endDate: new Date('2026-12-31T00:00:00Z'),
          status: SeasonStatus.ACTIVE,
        }
      });
      seasonId = season.id;

      const shiftMorning = await prisma.shift.create({ data: { name: 'Mañana', institutionId: instId } });
      const shiftAfternoon = await prisma.shift.create({ data: { name: 'Tarde', institutionId: instId } });
      const shiftNight = await prisma.shift.create({ data: { name: 'Noche', institutionId: instId } });

      // Oferta Regular
      let resultRegular;
      try {
        resultRegular = await courseSeasonsService.create({

        name: 'Regular',
        courseId, seasonId, categoryId, shiftId: shiftMorning.id,
        gender: ProgramGender.MIXED, minMembers: 1, maxMembers: 10, validateAge: false,
        billingConfig: { billingFrequency: 'MONTHLY', billingType: 'MONTHLY_ONLY' as any, recurringFee: '100', billingDay: 1, debtToleranceMonths: 1, lateFeeEnabled: false, registrationFee: '10', chargeGenerationDaysBefore: 7 } });
      } catch(e) {
        console.error('ERROR CREATING REGULAR:', e);
        throw e;
      }
      regularSeasonId = resultRegular.data.id;
      regularMorningShiftId = (await prisma.courseSeasonShift.findFirst({ where: { courseSeasonId: regularSeasonId } })).id;
      
      // Agregar turno Tarde a Regular
      const resultTarde = await courseSeasonsService.addShift(regularSeasonId, { shiftId: shiftAfternoon.id, minMembers: 1, maxMembers: 10, categoryId, gender: ProgramGender.MIXED });
      regularAfternoonShiftId = (await prisma.courseSeasonShift.findFirst({ where: { courseSeasonId: regularSeasonId, shiftId: shiftAfternoon.id } })).id;

      // Oferta Premium
      const resultPremium = await courseSeasonsService.create({
        name: 'Premium',
        courseId, seasonId, categoryId, shiftId: shiftNight.id,
        gender: ProgramGender.MIXED, minMembers: 1, maxMembers: 10, validateAge: false,
        billingConfig: { billingFrequency: 'MONTHLY', billingType: 'MONTHLY_ONLY' as any, recurringFee: '200', billingDay: 1, debtToleranceMonths: 1, lateFeeEnabled: false, registrationFee: '10', chargeGenerationDaysBefore: 7 }
      });
      premiumSeasonId = resultPremium.data.id;
      premiumNightShiftId = (await prisma.courseSeasonShift.findFirst({ where: { courseSeasonId: premiumSeasonId } })).id;

      await prisma.courseSeason.updateMany({ data: { status: StatusCourseSeason.ACTIVE } });

      const person = await prisma.person.create({ data: { name: 'Juan', lastName: 'Transfer QA' } });
      personId = person.id;
      createdIds.persons.push(personId);

      const student = await prisma.student.create({ data: { personId } });
      studentId = student.id;
    });

    it('F. Inscribir un alumno en Oferta Regular, Turno Mañana', async () => {
      const paymentPlan = await prisma.paymentPlan.create({
        data: { name: 'Plan Mensual', courseSeasonId: regularSeasonId, isDefault: true }
      });

      const membership = await prisma.studentMembership.create({
        data: {
          studentId,
          courseSeasonId: regularSeasonId,
          courseSeasonShiftId: regularMorningShiftId,
          paymentPlanId: paymentPlan.id,
          status: StudentMembershipStatus.ACTIVE,
          startedAt: new Date('2026-08-01T10:00:00Z'),
        }
      });
      membershipId = membership.id;

      // Generar un Charge "historico" ya pagado (agosto)
      const pastCharge = await prisma.charge.create({
        data: { amount: 100, pendingAmount: 0, status: StatusCharge.PAID, dueDate: new Date('2026-08-05') }
      });
      pastChargeId = pastCharge.id;
      await prisma.studentCharge.create({
        data: { studentMembershipId: membershipId, chargeId: pastChargeId, type: TypeMembershipCharge.RECURRING_FEE }
      });

      // Crear ciclo historico (Agosto)
      await prisma.cycleEnrollment.create({
        data: {
          studentMembershipId: membershipId,
          courseSeasonShiftId: regularMorningShiftId, courseSeasonId: regularSeasonId,
          chargeId: pastChargeId,
          cycleStartDate: new Date('2026-08-01T00:00:00Z'),
          cycleEndDate: new Date('2026-09-01T00:00:00Z'),
          effectiveStartDate: new Date('2026-08-01T00:00:00Z'),
          status: CycleEnrollmentStatus.CONFIRMED
        }
      });

      // Generar un Charge "futuro" pendiente (septiembre)
      const futureCharge = await prisma.charge.create({
        data: { amount: 100, pendingAmount: 100, status: StatusCharge.PENDING, dueDate: new Date('2026-09-05') }
      });
      await prisma.studentCharge.create({
        data: { studentMembershipId: membershipId, chargeId: futureCharge.id, type: TypeMembershipCharge.RECURRING_FEE }
      });

      // Crear ciclo futuro (Septiembre)
      const futureCycle = await prisma.cycleEnrollment.create({
        data: {
          studentMembershipId: membershipId,
          courseSeasonShiftId: regularMorningShiftId, courseSeasonId: regularSeasonId,
          chargeId: futureCharge.id,
          cycleStartDate: new Date('2026-09-01T00:00:00Z'),
          cycleEndDate: new Date('2026-10-01T00:00:00Z'),
          effectiveStartDate: new Date('2026-09-01T00:00:00Z'),
          status: CycleEnrollmentStatus.PENDING
        }
      });
      futureCycleId = futureCycle.id;

      expect(membershipId).toBeDefined();
    });

    it('G & H. Transferencia Interna (Regular Mañana -> Regular Tarde)', async () => {
      // Act
      await membershipsService.transferShift(membershipId, {
        targetCourseSeasonId: regularSeasonId,
        targetCourseSeasonShiftId: regularAfternoonShiftId,
        effectiveDate: new Date('2026-08-15T00:00:00Z') // Medio mes de agosto
      });

      // Assert
      const updatedMembership = await prisma.studentMembership.findUnique({ where: { id: membershipId } });
      
      // G: Cambio unicamente courseSeasonShiftId
      expect(updatedMembership.courseSeasonId).toBe(regularSeasonId);
      expect(updatedMembership.courseSeasonShiftId).toBe(regularAfternoonShiftId);

      // H: No crear otra membership
      const membershipsCount = await prisma.studentMembership.count({ where: { studentId } });
      expect(membershipsCount).toBe(1);

      // H: Ciclo historico (Agosto) permanece igual porque la fecha efectiva (15 de agosto) es cubierta por el ciclo (1-agosto a 1-septiembre), PERO OJO, segun la logica actual, si esta PENDING o CONFIRMED y arranca antes de transferStartDate... wait!
      // En la logica, el overlappingCycle determina transferStartDate. Si overlap (c.cycleStartDate <= effectiveDate < c.cycleEndDate), transferStartDate = overlappingCycle.cycleEndDate.
      // Así que el ciclo de Agosto NO SE TOCA. Se toca a partir de Septiembre.
      
      const cycles = await prisma.cycleEnrollment.findMany({ where: { studentMembershipId: membershipId }, orderBy: { cycleStartDate: 'asc' } });
      
      // Ciclo historico de agosto NO cambia de turno
      expect(cycles[0].courseSeasonShiftId).toBe(regularMorningShiftId);
      
      // Ciclo futuro de septiembre SI cambia de turno
      expect(cycles[1].courseSeasonShiftId).toBe(regularAfternoonShiftId);

      // Los cargos historicos permanecen inmutables (el amount = 100)
      const pastCharge = await prisma.charge.findUnique({ where: { id: pastChargeId } });
      expect(Number(pastCharge.amount)).toBe(100);
      expect(pastCharge.status).toBe(StatusCharge.PAID);
    });

    it('I. Transferencia Externa (Regular Tarde -> Premium Noche)', async () => {
      // Act
      await membershipsService.transferShift(membershipId, {
        targetCourseSeasonId: premiumSeasonId,
        targetCourseSeasonShiftId: premiumNightShiftId,
        effectiveDate: new Date('2026-09-15T00:00:00Z') // A mitad de Septiembre
      });

      // Assert
      const updatedMembership = await prisma.studentMembership.findUnique({ where: { id: membershipId } });
      
      // I: Cambian ambos IDs
      expect(updatedMembership.courseSeasonId).toBe(premiumSeasonId);
      expect(updatedMembership.courseSeasonShiftId).toBe(premiumNightShiftId);

      const cycles = await prisma.cycleEnrollment.findMany({ where: { studentMembershipId: membershipId }, orderBy: { cycleStartDate: 'asc' } });
      
      // El ciclo historico de agosto (indice 0) debe estar en Regular/Mañana
      expect(cycles[0].courseSeasonShiftId).toBe(regularMorningShiftId);
      
      // El ciclo de septiembre (indice 1) superpone al effectiveDate (15 sept), asi que el transferStartDate sera el fin de Septiembre (1 Octubre).
      // Por ende, el ciclo de septiembre NO se toca y se queda en Regular/Tarde.
      expect(cycles[1].courseSeasonShiftId).toBe(regularAfternoonShiftId);

      // No se generaron ciclos nuevos (el cronjob de Billing sera quien lo haga)
      expect(cycles.length).toBe(2);

      // Los cargos pasados siguen inmutables
      const pastCharge = await prisma.charge.findUnique({ where: { id: pastChargeId } });
      expect(Number(pastCharge.amount)).toBe(100);
    });
  });
});
