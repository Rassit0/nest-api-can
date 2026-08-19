import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';

jest.mock('uuid', () => ({
  v4: () => randomUUID(),
}));

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { CourseSeasonsService } from '../src/course-seasons/course-seasons.service';
import { CreateCourseSeasonDto } from '../src/course-seasons/dto/create-course-season.dto';
import { AddShiftDto } from '../src/course-seasons/dto/add-shift.dto';
import { ProgramGender, StatusCourseSeason, SeasonStatus, StatusCharge, TypeMembershipCharge, CycleEnrollmentStatus } from 'src/generated/prisma/client';

describe('Fase 7 - CourseSeason Shift Management QA Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let courseSeasonsService: CourseSeasonsService;

  const createdIds = {
    institutions: [] as string[],
    persons: [] as string[],
    disciplines: [] as string[],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
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
    for (const id of createdIds.disciplines) {
      await prisma.category.deleteMany({ where: { disciplineId: id } });
      await prisma.discipline.delete({ where: { id } });
    }
    await app.close();
    await prisma.$disconnect();
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  describe('CRUD Course Seasons', () => {
    let instId: string;
    let discId: string;
    let categoryId: string;
    let schoolId: string;
    let courseId: string;
    let seasonId: string;
    let shiftMorningId: string;
    let shiftAfternoonId: string;
    let personId: string;
    let studentId: string;
    
    let regularCourseSeasonId: string;
    let morningShiftId: string;
    let afternoonShiftId: string;

    beforeAll(async () => {
      const inst = await prisma.institution.create({ data: { name: 'Inst QA Fase 7', address: '123' } });
      instId = inst.id;
      createdIds.institutions.push(instId);

      const disc = await prisma.discipline.create({ data: { name: 'Disc QA Fase 7', icon: 'sport' } });
      discId = disc.id;
      createdIds.disciplines.push(discId);

      const cat = await prisma.category.create({ data: { name: 'Cat QA Fase 7', minAge: 5, disciplineId: discId } });
      categoryId = cat.id;

      const school = await prisma.school.create({ data: { name: 'School QA Fase 7', institutionId: instId, disciplineId: discId } });
      schoolId = school.id;

      const course = await prisma.course.create({ data: { name: 'Course QA Fase 7', schoolId, description: 'Desc' } });
      courseId = course.id;

      const season = await prisma.season.create({
        data: {
          name: 'Season QA Fase 7',
          institutionId: instId,
          disciplineId: discId,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: SeasonStatus.ACTIVE,
        }
      });
      seasonId = season.id;

      const shift1 = await prisma.shift.create({ data: { name: 'Mañana QA Fase 7', institutionId: instId } });
      shiftMorningId = shift1.id;
      
      const shift2 = await prisma.shift.create({ data: { name: 'Tarde QA Fase 7', institutionId: instId } });
      shiftAfternoonId = shift2.id;

      const person = await prisma.person.create({ data: { name: 'John', lastName: 'Doe Fase 7', documentNumber: 'QA7001' } });
      personId = person.id;
      createdIds.persons.push(personId);

      const student = await prisma.student.create({ data: { person: { connect: { id: personId } } } });
      studentId = student.id;
    });

    it('A. Crear una CourseSeason/oferta con un turno inicial', async () => {
      const createDto: CreateCourseSeasonDto = {
        name: 'Regular',
        courseId, categoryId, seasonId, shiftId: shiftMorningId,
        gender: ProgramGender.MIXED, maxMembers: 10, minMembers: 5, validateAge: false,
        billingConfig: { billingFrequency: 'MONTHLY', billingType: 'MONTHLY_ONLY' as any, recurringFee: '150', billingDay: 1, debtToleranceMonths: 1, lateFeeEnabled: false, registrationFee: '10', chargeGenerationDaysBefore: 7 }
      };

      let result;
      try {
        result = await courseSeasonsService.create(createDto);
      } catch(e) {
        console.error('ERROR CREATING COURSE SEASON:', e);
        throw e;
      }
      expect(result.data.id).toBeDefined();
      regularCourseSeasonId = result.data.id;
      
      const dbSeason = await prisma.courseSeason.findUnique({
        where: { id: regularCourseSeasonId },
        include: { shifts: true, billingConfig: true }
      });
      
      expect(dbSeason).toBeDefined();
      expect(dbSeason.name).toBe('Regular');
      expect(dbSeason.shifts.length).toBe(1);
      expect(dbSeason.billingConfig).toBeDefined();
      expect(Number(dbSeason.billingConfig.recurringFee)).toBe(150);
      
      morningShiftId = dbSeason.shifts[0].id;
    });

    it('B. Agregar otro turno mediante addShift', async () => {
      const addShiftDto: AddShiftDto = {
        shiftId: shiftAfternoonId,
        maxMembers: 15,
        minMembers: 5
      };
      
      const result = await courseSeasonsService.addShift(regularCourseSeasonId, addShiftDto);
      expect(result.data).toBeDefined();
      afternoonShiftId = result.data.id;
    });

    it('C. Verificar que ambos turnos pertenecen al mismo CourseSeason', async () => {
      const dbSeason = await prisma.courseSeason.findUnique({
        where: { id: regularCourseSeasonId },
        include: { shifts: { orderBy: { createdAt: 'asc' } } }
      });
      
      expect(dbSeason.shifts.length).toBe(2);
      
    });

    it('D. Verificar que existe un único BillingConfig para la oferta', async () => {
      const billingConfigs = await prisma.courseSeasonBillingConfig.findMany({
        where: { courseSeasonId: regularCourseSeasonId }
      });
      
      // La regla de negocio indica que la configuración comercial pertenece a la Oferta, no a los turnos.
      expect(billingConfigs.length).toBe(1);
    });

    it('E. Verificar que ambos turnos utilizan la misma configuración económica', async () => {
      const dbSeason = await prisma.courseSeason.findUnique({
        where: { id: regularCourseSeasonId },
        include: { shifts: true, billingConfig: true }
      });
      
      // Para cualquier turno que escojamos, el precio viene del CourseSeason
      expect(dbSeason.billingConfig).toBeDefined();
      expect(Number(dbSeason.billingConfig.recurringFee)).toBe(150);
      // Confirmamos que en el modelo CourseSeasonShift NO existe configuración de billing
      expect((dbSeason.shifts[0] as any).billingConfig).toBeUndefined();
      expect((dbSeason.shifts[1] as any).billingConfig).toBeUndefined();
    });

    it('Prueba de capacidad - maxMembers pertenece al turno logístico', async () => {
      const shiftData = await prisma.courseSeasonShift.findFirst({ where: { courseSeasonId: regularCourseSeasonId, shiftId: shiftAfternoonId } });
      
      expect(shiftData.maxMembers).toBe(15);
      
      // Validar que el total (10 + 15 = 25) se sumariza al pedir resumen
      const summary = await courseSeasonsService.getSummary(regularCourseSeasonId);
      expect(summary.data.maxMembers).toBe(25);
    });

  });
});
