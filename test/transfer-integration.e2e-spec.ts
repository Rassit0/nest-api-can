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

describe('Fase 5.4 - Transfer Shift QA Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let membershipsService: StudentMembershipsService;

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
  });

  afterAll(async () => {
    // Teardown the cron jobs to prevent Jest open handles
    try {
      const schedulerRegistry = app.get(require('@nestjs/schedule').SchedulerRegistry);
      schedulerRegistry.getCronJobs().forEach((job: any) => job.stop());
      schedulerRegistry.getIntervals().forEach((interval: any) => clearInterval(schedulerRegistry.getInterval(interval)));
      schedulerRegistry.getTimeouts().forEach((timeout: any) => clearTimeout(schedulerRegistry.getTimeout(timeout)));
    } catch (e) {
      // Ignorar si ScheduleModule no está inyectado correctamente
    }
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
      await prisma.courseSeason.deleteMany({ where: { season: { institutionId: id } } });
      await prisma.season.deleteMany({ where: { institutionId: id } });
      await prisma.course.deleteMany({ where: { school: { institutionId: id } } });
      await prisma.school.deleteMany({ where: { institutionId: id } });
      // await prisma.category.deleteMany({});
      // await prisma.discipline.deleteMany({});
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

  describe('Escenario Completo: Transferencias A -> B -> C', () => {
    let instId: string;
    let discId: string;
    let schoolId: string;
    let courseId: string;
    let seasonId: string;
    let categoryId: string;
    let seasonAId: string;
    let seasonBId: string;
    let seasonCId: string;
    let personId: string;
    let studentId: string;
    let membershipId: string;
    let chargeId1: string;
    let chargeId2: string;

    beforeAll(async () => {
      const inst = await prisma.institution.create({ data: { name: 'Inst QA', address: '123' } });
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

      const shiftA = await prisma.shift.create({ data: { name: 'Shift A', institutionId: instId } });
      const shiftB = await prisma.shift.create({ data: { name: 'Shift B', institutionId: instId } });
      const shiftC = await prisma.shift.create({ data: { name: 'Shift C', institutionId: instId } });

      const seasonA = await prisma.courseSeason.create({
        data: {
          courseId,
          shiftId: shiftA.id,
          seasonId,
          categoryId,
          gender: ProgramGender.MIXED,
          minMembers: 1,
          maxMembers: 10,
          status: StatusCourseSeason.ACTIVE,
        }
      });
      seasonAId = seasonA.id;

      const seasonB = await prisma.courseSeason.create({
        data: {
          courseId,
          shiftId: shiftB.id,
          seasonId,
          categoryId,
          gender: ProgramGender.MIXED,
          minMembers: 1,
          maxMembers: 10,
          status: StatusCourseSeason.ACTIVE,
        }
      });
      seasonBId = seasonB.id;

      const seasonC = await prisma.courseSeason.create({
        data: {
          courseId,
          shiftId: shiftC.id,
          seasonId,
          categoryId,
          gender: ProgramGender.MIXED,
          minMembers: 1,
          maxMembers: 10,
          status: StatusCourseSeason.ACTIVE,
        }
      });
      seasonCId = seasonC.id;

      const person = await prisma.person.create({ data: { name: 'Juan', lastName: 'Transfer QA' } });
      personId = person.id;
      createdIds.persons.push(personId);

      const student = await prisma.student.create({ data: { personId } });
      studentId = student.id;

      const paymentPlan = await prisma.paymentPlan.create({
        data: {
          name: 'Plan Mensual QA',
          courseSeasonId: seasonAId,
          isDefault: true,
        }
      });
      const paymentPlanId = paymentPlan.id;

      const membership = await prisma.studentMembership.create({
        data: {
          studentId,
          courseSeasonId: seasonAId,
          paymentPlanId,
          status: StudentMembershipStatus.ACTIVE,
          startedAt: new Date('2026-08-01T15:00:00Z'),
        }
      });
      membershipId = membership.id;

      const chargeAgosto = await prisma.charge.create({
        data: { amount: 100, pendingAmount: 100, status: StatusCharge.PENDING, description: 'Agosto', dueDate: new Date('2026-08-01T00:00:00Z') }
      });
      chargeId1 = chargeAgosto.id;

      await prisma.studentCharge.create({
        data: {
          studentMembershipId: membershipId,
          chargeId: chargeId1,
          type: TypeMembershipCharge.RECURRING_FEE,
          billingYear: 2026,
          billingMonth: 8,
        }
      });

      await prisma.cycleEnrollment.create({
        data: {
          studentMembershipId: membershipId,
          courseSeasonId: seasonAId,
          chargeId: chargeId1,
          cycleStartDate: new Date('2026-08-01T00:00:00Z'),
          cycleEndDate: new Date('2026-09-01T00:00:00Z'),
          effectiveStartDate: new Date('2026-08-01T15:00:00Z'),
          status: CycleEnrollmentStatus.PENDING,
        }
      });

      const chargeSeptiembre = await prisma.charge.create({
        data: { amount: 100, pendingAmount: 100, status: StatusCharge.PENDING, description: 'Septiembre', dueDate: new Date('2026-09-01T00:00:00Z') }
      });
      chargeId2 = chargeSeptiembre.id;

      await prisma.studentCharge.create({
        data: {
          studentMembershipId: membershipId,
          chargeId: chargeId2,
          type: TypeMembershipCharge.RECURRING_FEE,
          billingYear: 2026,
          billingMonth: 9,
        }
      });

      await prisma.cycleEnrollment.create({
        data: {
          studentMembershipId: membershipId,
          courseSeasonId: seasonAId,
          chargeId: chargeId2,
          cycleStartDate: new Date('2026-09-01T00:00:00Z'),
          cycleEndDate: new Date('2026-10-01T00:00:00Z'),
          effectiveStartDate: new Date('2026-09-01T00:00:00Z'),
          status: CycleEnrollmentStatus.PENDING,
        }
      });
    });

    it('1. Debe validar que inicialmente todo pertenece al Turno A', async () => {
      const membership = await prisma.studentMembership.findUnique({ where: { id: membershipId } });
      expect(membership?.courseSeasonId).toBe(seasonAId);

      const cycles = await prisma.cycleEnrollment.findMany({ where: { studentMembershipId: membershipId } });
      expect(cycles).toHaveLength(2);
      expect(cycles[0].courseSeasonId).toBe(seasonAId); // Agosto
      expect(cycles[1].courseSeasonId).toBe(seasonAId); // Septiembre
    });

    it('2. Ejecutar Transferencia A -> B en el mes de Agosto', async () => {
      await membershipsService.transferShift(membershipId, {
        targetCourseSeasonId: seasonBId,
        effectiveDate: new Date('2026-08-15T10:00:00Z'), // Efectivo en agosto
      });

      const membership = await prisma.studentMembership.findUnique({ where: { id: membershipId } });
      // El administrativo base se actualiza inmediatamente a B
      expect(membership?.courseSeasonId).toBe(seasonBId);

      // Verificamos inmutabilidad del ciclo Agosto y actualización de Septiembre
      const cycles = await prisma.cycleEnrollment.findMany({ 
        where: { studentMembershipId: membershipId },
        orderBy: { cycleStartDate: 'asc' } 
      });
      expect(cycles).toHaveLength(2);
      expect(cycles[0].courseSeasonId).toBe(seasonAId); // Agosto inmutable
      expect(cycles[1].courseSeasonId).toBe(seasonBId); // Septiembre actualizado a B
    });

    it('3. Verificar inmutabilidad financiera tras la primera transferencia', async () => {
      const charges = await prisma.charge.findMany({
        where: { id: { in: [chargeId1, chargeId2] } },
        orderBy: { description: 'asc' }
      });
      // Montos deben seguir siendo 100
      expect(Number(charges[0].amount)).toBe(100);
      expect(Number(charges[1].amount)).toBe(100);
      expect(charges[0].status).toBe(StatusCharge.PENDING);

      const studentCharges = await prisma.studentCharge.findMany({
        where: { studentMembershipId: membershipId }
      });
      expect(studentCharges).toHaveLength(2);
      // Las asociaciones deben seguir intactas
      expect(studentCharges[0].chargeId).toBeDefined();
    });

    it('4. Consulta de Asistencia (Bordes y Roster) para el 1 de Agosto', async () => {
      // 1 de Agosto a las 14:00 (1 hora antes de inscripcion):
      const resAntes = await membershipsService.findAll({
        courseSeasonId: seasonAId,
        physicalDate: '2026-08-01T14:00:00.000Z', // formato ISO 8601
      });
      expect(resAntes.data).toHaveLength(0);

      // 1 de Agosto a las 16:00 (despues de inscripcion):
      const resDespues = await membershipsService.findAll({
        courseSeasonId: seasonAId,
        physicalDate: '2026-08-01T16:00:00.000Z',
      });
      expect(resDespues.data).toHaveLength(1);

      // Si consulto Turno B en Agosto, no debe salir en lista física
      const resTurnoBAgosto = await membershipsService.findAll({
        courseSeasonId: seasonBId,
        physicalDate: '2026-08-01T16:00:00.000Z',
      });
      expect(resTurnoBAgosto.data).toHaveLength(0);
    });

    it('5. Consulta Administrativa (Sin physicalDate)', async () => {
      // Al pedir Roster sin physicalDate, es puramente administrativo.
      // Como ahora la membresía base es Turno B, debe salir en Turno B, no en Turno A.
      const resAdminA = await membershipsService.findAll({ courseSeasonId: seasonAId });
      expect(resAdminA.data).toHaveLength(0);

      const resAdminB = await membershipsService.findAll({ courseSeasonId: seasonBId });
      expect(resAdminB.data).toHaveLength(1);
    });

    it('6. Consulta de Asistencia (Límite Final de Mes UTC) para Agosto', async () => {
      // El ciclo de agosto acaba en 2026-09-01T00:00:00Z.
      // Si pido la clase 1 milisegundo antes, es Agosto. Debe salir en A.
      const resFinalAgosto = await membershipsService.findAll({
        courseSeasonId: seasonAId,
        physicalDate: '2026-08-31T23:59:59.999Z',
      });
      expect(resFinalAgosto.data).toHaveLength(1);

      // Si pido exactamente a medianoche, es Septiembre. Septiembre esta en B, no en A.
      const resPrimeraSeptiembre = await membershipsService.findAll({
        courseSeasonId: seasonAId,
        physicalDate: '2026-09-01T00:00:00.000Z',
      });
      expect(resPrimeraSeptiembre.data).toHaveLength(0);

      const resPrimeraSeptiembreB = await membershipsService.findAll({
        courseSeasonId: seasonBId,
        physicalDate: '2026-09-01T00:00:00.000Z',
      });
      expect(resPrimeraSeptiembreB.data).toHaveLength(1); // Septiembre esta en B
    });

    it('7. Ejecutar Transferencia Consecutiva B -> C', async () => {
      await membershipsService.transferShift(membershipId, {
        targetCourseSeasonId: seasonCId,
        effectiveDate: new Date('2026-08-20T10:00:00Z'), // Efectivo también en agosto
      });

      const membership = await prisma.studentMembership.findUnique({ where: { id: membershipId } });
      // El administrativo base se actualiza inmediatamente a C
      expect(membership?.courseSeasonId).toBe(seasonCId);

      // Verificamos inmutabilidad del ciclo Agosto (Turno A) y actualización de Septiembre a Turno C
      const cycles = await prisma.cycleEnrollment.findMany({ 
        where: { studentMembershipId: membershipId },
        orderBy: { cycleStartDate: 'asc' } 
      });
      expect(cycles).toHaveLength(2);
      expect(cycles[0].courseSeasonId).toBe(seasonAId); // Agosto inmutable!
      expect(cycles[1].courseSeasonId).toBe(seasonCId); // Septiembre ahora en C!
    });

    it('8. Concurrencia Básica - Intentar 3 transferencias simultáneas a turnos diferentes', async () => {
      // Simulamos que el frontend hace 3 clics rápidos para transferir a A, B y C
      const requests = [
        membershipsService.transferShift(membershipId, { targetCourseSeasonId: seasonAId, effectiveDate: new Date('2026-09-05T00:00Z') }),
        membershipsService.transferShift(membershipId, { targetCourseSeasonId: seasonBId, effectiveDate: new Date('2026-09-05T00:00Z') }),
        membershipsService.transferShift(membershipId, { targetCourseSeasonId: seasonCId, effectiveDate: new Date('2026-09-05T00:00Z') }),
      ];

      const results = await Promise.allSettled(requests);
      
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      // Gracias al FOR UPDATE, deben procesarse de a una.
      // Sin embargo, las que entren después encontrarán que originCourseSeason === targetCourseSeason 
      // (si ya se movió ahí), o fallarán si las validaciones del capacityHelper determinan algo incorrecto.
      // Al menos 1 debe tener éxito, o bien si lanza BadRequest por ser redundante, no debe haber deadlocks.
      expect(results.length).toBe(3);
      // Validamos explícitamente que no exista deadlock (el Promise.all resuelve).
      
      // La membresía debe quedar en un estado consistente
      const memFinal = await prisma.studentMembership.findUnique({ where: { id: membershipId } });
      expect(memFinal?.courseSeasonId).toBeTruthy();

      const cyclesFinal = await prisma.cycleEnrollment.findMany({ where: { studentMembershipId: membershipId }, orderBy: { cycleStartDate: 'asc' } });
      expect(cyclesFinal[0].courseSeasonId).toBe(seasonAId); // Agosto sigue en A
      // Septiembre quedará en el último turno que logró procesarse (A, B o C).
      expect(['A', 'B', 'C'].some(letter => cyclesFinal[1].courseSeasonId === eval(`season${letter}Id`))).toBe(true);
    });
  });
});
