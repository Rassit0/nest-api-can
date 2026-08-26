import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { DateUtils } from 'src/utils/date.utils';
import { StudentMembershipRepository } from '../repositories/student-membership.repository';
import { StudentChargeRepository } from '../repositories/student-charge.repository';
import { StudentCourseSeasonValidator } from '../validators/student-course-season.validator';
import { CreateMassiveManualChargeDto } from '../dto/create-massive-manual-charge.dto';
import { CreateManualChargeDto } from '../dto/create-manual-charge.dto';
import { StudentChargeFactory } from '../student-charge.factory';

@Injectable()
export class StudentManualChargeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepo: StudentMembershipRepository,
    private readonly chargeRepo: StudentChargeRepository,
  ) {}

  /**
   * Aplica un cargo extraordinario (Multa, uniforme, extra) a todos los miembros
   * activos de una temporada. Emplea un mecanismo altamente optimizado usando
   * inserciones masivas (createMany) fraccionadas, permitiendo operar
   * miles de usuarios instantáneamente.
   */
  async createMassiveManualCharge(dto: CreateMassiveManualChargeDto) {
    const { courseSeasonId, description, amount, dueDate } = dto;
    const due = DateUtils.getEndOfLocalDayInUTC(dueDate);

    const courseSeason =
      await this.membershipRepo.getCourseSeasonOrThrow(courseSeasonId);
    StudentCourseSeasonValidator.assertIsActive(
      courseSeason,
      'No se pueden generar cargos masivos para una temporada o equipo que ha finalizado o fue cancelada',
    );

    const activeMemberships =
      await this.membershipRepo.getActiveMembershipsIdsBySeason(courseSeasonId);

    if (activeMemberships.length === 0) {
      throw new BadRequestException(
        'No hay miembros activos para generar el cargo.',
      );
    }

    const payloads: Prisma.ChargeCreateInput[] = [];

    for (const membership of activeMemberships) {
      const payload = StudentChargeFactory.buildManualChargePayload(
        membership.id,
        amount,
        0,
        description,
        due,
      );
      payloads.push(payload);
    }

    const chunkSize = 1000;

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < payloads.length; i += chunkSize) {
        const chunk = payloads.slice(i, i + chunkSize);
        await this.chargeRepo.bulkCreateChargesWithRelations(tx, chunk);
      }
    });

    return {
      message: `Cargos generados exitosamente para ${activeMemberships.length} miembros.`,
    };
  }

  /**
   * Crea un cargo extraordinario manual para un único jugador específico.
   */
  async createManualCharge(dto: CreateManualChargeDto) {
    const membership = await this.membershipRepo.getMembershipOrThrow(
      dto.membershipId,
    );

    StudentCourseSeasonValidator.assertIsActive(
      membership.courseSeason,
      'No se pueden generar cargos manuales para una temporada o equipo que ha finalizado o fue cancelada',
    );

    const dueDate = DateUtils.getEndOfLocalDayInUTC(dto.dueDate);

    await this.prisma.$transaction(async (tx) => {
      const charge = await tx.charge.create({
        data: StudentChargeFactory.buildManualChargePayload(
          membership.id,
          dto.amount,
          0,
          dto.description,
          dueDate,
        ),
      });

      await tx.accountCharge.create({
        data: {
          chargeId: charge.id,
          title: dto.description,
          categoryId: dto.categoryId,
          personId: membership.student.personId,
        },
      });
    });

    return { message: 'Cargo manual creado exitosamente' };
  }
}
