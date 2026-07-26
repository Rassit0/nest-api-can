import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { MembershipRepository } from '../repositories/membership.repository';
import { MembershipTeamSeasonValidator } from '../validators/membership-team-season.validator';
import { MembershipGenerationService } from './membership-generation.service';
import { MembershipPreviewService } from './membership-preview.service';
import { PrismaErrorUtils } from 'src/utils/prisma-error.util';

@Injectable()
export class MembershipAdvanceChargeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepo: MembershipRepository,
    private readonly generationService: MembershipGenerationService,
    private readonly previewService: MembershipPreviewService,
  ) {}

  /**
   * Simula N ciclos hacia adelante sin guardarlos en la base de datos.
   * Util para mostrarle al usuario un preview de "Pagar 3 cuotas por adelantado".
   */
  async previewAdvanceCharges(membershipId: string, quantity: number) {
    const membership =
      await this.membershipRepo.getMembershipOrThrow(membershipId);

    MembershipTeamSeasonValidator.assertIsActive(
      membership.teamSeason,
      'No se pueden previsualizar cuotas adelantadas para una temporada o equipo inactivo',
    );

    const nextCycles = await this.generationService.findNextUngeneratedCycles(
      this.prisma,
      membership,
      quantity,
    );

    if (nextCycles.length === 0) {
      return {
        charges: [],
        breakdown: this.previewService.buildChargesBreakdown([]),
      };
    }

    return this.previewService.extractAdvanceChargesFromCycles(nextCycles);
  }

  /**
   * Concreta la generación física (persistida) de N cuotas por adelantado
   * bajo el contexto de un solo agrupamiento transaccional.
   */
  async generateAdvanceCharges(membershipId: string, quantity: number) {
    const membership =
      await this.membershipRepo.getMembershipOrThrow(membershipId);

    MembershipTeamSeasonValidator.assertIsActive(
      membership.teamSeason,
      'No se pueden generar cuotas adelantadas para una temporada o equipo inactivo',
    );

    try {
      let generatedCount = 0;
      await this.prisma.$transaction(async (tx) => {
        const nextCycles =
          await this.generationService.findNextUngeneratedCycles(
            tx,
            membership,
            quantity,
          );

        if (nextCycles.length === 0) {
          return;
        }

        await this.generationService.generateAdvanceCharges(
          tx,
          membership,
          nextCycles,
        );

        generatedCount = nextCycles.length;
      });

      if (generatedCount === 0) {
        return {
          message:
            'No hay más cuotas disponibles para generar en la temporada.',
        };
      }

      return {
        message: `Se generaron exitosamente ${generatedCount} cuotas por adelantado.`,
      };
    } catch (error) {
      if (PrismaErrorUtils.isUniqueConstraintViolation(error)) {
        throw new BadRequestException(
          'Algunas de las cuotas solicitadas ya fueron generadas recientemente por otro proceso.',
        );
      }
      throw error;
    }
  }
}
