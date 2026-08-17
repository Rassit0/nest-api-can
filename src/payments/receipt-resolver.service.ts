import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Prisma, AccountCategory } from 'src/generated/prisma/client';

export interface ResolvedReceipt {
  receiptSeries: string;
  receiptNumber: number;
}

@Injectable()
export class ReceiptResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the effective AccountCategory for a given charge ID.
   */
  async resolveEffectiveCategory(chargeId: string, tx?: Prisma.TransactionClient): Promise<AccountCategory | null> {
    const client = tx || this.prisma;
    const charge = await client.charge.findUnique({
      where: { id: chargeId },
      include: {
        accountCharge: true,
        studentCharges: {
          include: {
            studentMembership: {
              include: {
                courseSeason: {
                  include: {
                    course: {
                      include: {
                        school: {
                          include: { defaultAccountCategory: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        membershipCharges: {
          include: {
            playerMembership: {
              include: {
                teamSeason: {
                  include: {
                    team: {
                      include: {
                        club: {
                          include: { defaultAccountCategory: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!charge) {
      throw new NotFoundException(`Cargo con ID ${chargeId} no encontrado para resolución de comprobante.`);
    }

    // 1. AccountCharge explícito
    if (charge.accountCharge) {
      const ac = charge.accountCharge;
      if (ac.categoryId) {
        const category = await client.accountCategory.findUnique({ where: { id: ac.categoryId } });
        if (category) {
          if (!category.isActive) throw new BadRequestException(`Categoría contable ${category.code} inactiva`);
          return category;
        }
      }
    }

    // Precedence rule for ambiguity: if both exist, throw error
    if (charge.studentCharges.length > 0 && charge.membershipCharges.length > 0) {
      throw new InternalServerErrorException(`Ambigüedad resolviendo categoría: el cargo ${chargeId} tiene tanto StudentCharge como MembershipCharge.`);
    }

    // 2. StudentCharge (Escuelas) -> Siempre va a la categoría por defecto de la Escuela (ESC)
    if (charge.studentCharges.length > 0) {
      const sc = charge.studentCharges[0];
      const category = sc.studentMembership.courseSeason.course.school.defaultAccountCategory;
      if (category) {
        if (!category.isActive) throw new BadRequestException(`Categoría contable ${category.code} de Escuela inactiva`);
        return category;
      }
    }

    // 3. MembershipCharge (Equipos) -> Siempre va a la categoría por defecto del Club (EQP)
    if (charge.membershipCharges.length > 0) {
      const mc = charge.membershipCharges[0];
      const category = mc.playerMembership.teamSeason.team.club.defaultAccountCategory;
      if (category) {
        if (!category.isActive) throw new BadRequestException(`Categoría contable ${category.code} de Equipo inactiva`);
        return category;
      }
    }

    // Fallback if no category resolves
    return null;
  }

  /**
   * Identifies the series for the given charge.
   */
  async resolveReceiptSeriesForCharge(chargeId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx || this.prisma;
    const charge = await client.charge.findUnique({
      where: { id: chargeId },
      include: {
        accountCharge: { include: { category: true } },
        studentCharges: true,
        membershipCharges: true,
      },
    });

    if (!charge) return 'GEN';

    // 1. AccountCharge explícito
    if (charge.accountCharge && charge.accountCharge.category) {
      return charge.accountCharge.category.receiptSeries || 'GEN';
    }

    // 2. StudentCharge (Escuela)
    if (charge.studentCharges.length > 0) {
      const type = charge.studentCharges[0].type;
      switch (type) {
        case 'REGISTRATION': return 'ESC-MAT';
        case 'RECURRING_FEE': return 'ESC';
        case 'SEASON_FEE': return 'ESC';
        case 'LATE_FEE': return 'ESC-REC';
        case 'MANUAL': return 'ESC-OTR';
        default: return 'ESC-OTR';
      }
    }

    // 3. MembershipCharge (Equipo)
    if (charge.membershipCharges.length > 0) {
      const type = charge.membershipCharges[0].type;
      switch (type) {
        case 'REGISTRATION': return 'EQP-MAT';
        case 'RECURRING_FEE': return 'EQP';
        case 'SEASON_FEE': return 'EQP';
        case 'LATE_FEE': return 'EQP-REC';
        case 'MANUAL': return 'EQP-OTR';
        default: return 'EQP-OTR';
      }
    }

    return 'GEN';
  }

  /**
   * Generates the next receipt number for the given series using an atomic upsert.
   */
  async nextReceiptNumber(series: string, tx?: Prisma.TransactionClient): Promise<number> {
    const client = tx || this.prisma;
    const sequence = await client.receiptSequence.upsert({
      where: { series },
      update: { lastValue: { increment: 1 } },
      create: {
        series,
        lastValue: 1,
        description: `Secuencia de recibos generada automáticamente para ${series}`,
      },
    });
    return sequence.lastValue;
  }

  /**
   * Resolves the full receipt detail for a charge (Series + Number).
   */
  async resolveReceiptForCharge(chargeId: string, tx?: Prisma.TransactionClient): Promise<ResolvedReceipt> {
    const effectiveCategory = await this.resolveEffectiveCategory(chargeId, tx);
    
    // El effectiveCategory se valida para asegurarse de que el cargo tenga una categoría válida configurada, 
    // pero la serie se resuelve de forma tipada consultando el Charge de nuevo.
    // (Podemos obviar usar effectiveCategory para la serie según el nuevo requerimiento).
    const series = await this.resolveReceiptSeriesForCharge(chargeId, tx);
    const number = await this.nextReceiptNumber(series, tx);

    return {
      receiptSeries: series,
      receiptNumber: number,
    };
  }
}
