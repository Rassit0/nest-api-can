import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { DateUtils } from 'src/utils/date.utils';
import { MembershipRepository } from '../repositories/membership.repository';
import { MembershipChargeRepository } from '../repositories/membership-charge.repository';
import { MembershipTeamSeasonValidator } from '../validators/membership-team-season.validator';
import { CreateMassiveManualChargeDto } from '../dto/create-massive-manual-charge.dto';
import { CreateManualChargeDto } from '../dto/create-manual-charge.dto';
import { MembershipChargeFactory } from '../membership-charge.factory';

@Injectable()
export class MembershipManualChargeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepo: MembershipRepository,
    private readonly chargeRepo: MembershipChargeRepository,
  ) {}

  /**
   * Aplica un cargo extraordinario (Multa, uniforme, extra) a todos los miembros
   * activos de una temporada. Emplea un mecanismo altamente optimizado usando
   * inserciones masivas (createMany) fraccionadas, permitiendo operar
   * miles de usuarios instantáneamente.
   */
  async createMassiveManualCharge(dto: CreateMassiveManualChargeDto) {
    const { teamSeasonId, description, amount, dueDate } = dto;
    const due = DateUtils.getEndOfUTCDay(dueDate);

    const teamSeason =
      await this.membershipRepo.getTeamSeasonOrThrow(teamSeasonId);
    MembershipTeamSeasonValidator.assertIsActive(
      teamSeason,
      'No se pueden generar cargos masivos para una temporada o equipo que ha finalizado o fue cancelada',
    );

    const activeMemberships =
      await this.membershipRepo.getActiveMembershipsIdsBySeason(teamSeasonId);

    if (activeMemberships.length === 0) {
      throw new BadRequestException(
        'No hay miembros activos para generar el cargo.',
      );
    }

    const payloads: Prisma.ChargeCreateInput[] = [];

    for (const membership of activeMemberships) {
      const payload = MembershipChargeFactory.buildManualChargePayload(
        membership.id,
        amount,
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

    MembershipTeamSeasonValidator.assertIsActive(
      membership.teamSeason,
      'No se pueden generar cargos manuales para una temporada o equipo que ha finalizado o fue cancelada',
    );

    const dueDate = DateUtils.getStartOfUTCDay(dto.dueDate);

    await this.prisma.$transaction(async (tx) => {
      await tx.charge.create({
        data: MembershipChargeFactory.buildManualChargePayload(
          membership.id,
          dto.amount,
          dto.description,
          dueDate,
        ),
      });
    });

    return { message: 'Cargo manual creado exitosamente' };
  }
}
