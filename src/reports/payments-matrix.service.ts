import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { 
  PaymentsMatrixResponseDto, 
  PaymentMatrixStudentDto, 
  PaymentMatrixPeriodDto,
  PaymentMatrixPeriodDataDto
} from './dto/payments-matrix.dto';
import { 
  getAbsoluteSeasonCycles, 
  buildCycleDescription 
} from 'src/student-charges/student-billing.utils';
import { TypeMembershipCharge } from 'src/generated/prisma/client';

@Injectable()
export class PaymentsMatrixService {
  constructor(private readonly prisma: PrismaService) {}

  async getCourseSeasonShiftMatrix(
    institutionId: string,
    shiftId: string
  ): Promise<PaymentsMatrixResponseDto> {
    const shift = await this.prisma.courseSeasonShift.findFirst({
      where: {
        id: shiftId,
        courseSeason: {
          course: {
            school: {
              institutionId: institutionId,
            }
          }
        }
      },
      include: {
        shift: true,
        courseSeason: {
          include: {
            season: true,
            billingConfig: true,
          }
        }
      }
    });

    if (!shift) {
      throw new NotFoundException(`Turno ${shiftId} no encontrado en la institución`);
    }

    const season = shift.courseSeason.season;
    const frequency = shift.courseSeason.billingConfig?.billingFrequency || 'MONTHLY';

    // 1. Generar los periodos base
    const absoluteCycles = getAbsoluteSeasonCycles(season.startDate, season.endDate, frequency);
    
    const periods: PaymentMatrixPeriodDto[] = absoluteCycles.map(c => ({
      key: `${c.billingYear}-${c.billingMonth}-${c.billingCycle}`,
      label: buildCycleDescription(c.cycleStartDate, c.cycleEndDate, frequency),
      startDate: c.cycleStartDate.toISOString(),
      endDate: c.cycleEndDate.toISOString(),
    }));

    // 2. Obtener estudiantes del turno con sus cargos y pagos
    const enrollments = await this.prisma.cycleEnrollment.findMany({
      where: {
        courseSeasonShiftId: shift.id,
      },
      include: {
        studentMembership: {
          include: {
            student: {
              include: {
                person: true
              }
            }
          }
        },
        charge: {
          include: {
            payments: {
              where: { status: 'COMPLETED' }, // Unica condición, Hard deletes controlan las reversiones
              select: { amount: true, paymentDate: true }
            }
          }
        }
      }
    });

    // 3. Agrupar la información por estudiante
    const studentMap = new Map<string, PaymentMatrixStudentDto>();

    for (const enrollment of enrollments) {
      const studentId = enrollment.studentMembership.student.id;
      const studentName = `${enrollment.studentMembership.student.person.name} ${enrollment.studentMembership.student.person.lastName}`.trim();

      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          id: studentId,
          name: studentName,
          paymentsByPeriod: {},
        });
      }

      const studentDto = studentMap.get(studentId)!;

      // Determinar a qué periodo pertenece este charge basándonos en las fechas
      // CourseSeason usa explícitamente cycleStartDate y cycleEndDate
      const matchedCycle = absoluteCycles.find(
        c => 
          c.cycleStartDate.getTime() === enrollment.cycleStartDate.getTime() &&
          c.cycleEndDate.getTime() === enrollment.cycleEndDate.getTime()
      );

      if (matchedCycle && enrollment.charge) {
        const key = `${matchedCycle.billingYear}-${matchedCycle.billingMonth}-${matchedCycle.billingCycle}`;
        
        let totalPaid = 0;
        const payments = enrollment.charge.payments.map(p => {
          const amt = Number(p.amount);
          totalPaid += amt;
          return {
            amount: amt,
            date: p.paymentDate.toISOString()
          };
        });

        // Sumar al periodo si ya existiera otro cargo (ej: reingresos)
        if (!studentDto.paymentsByPeriod[key]) {
          studentDto.paymentsByPeriod[key] = {
            totalPaid: 0,
            payments: [],
          };
        }

        studentDto.paymentsByPeriod[key].totalPaid += totalPaid;
        studentDto.paymentsByPeriod[key].payments.push(...payments);
      }
    }

    return {
      group: {
        id: shift.id,
        name: shift.shift.name,
        type: 'COURSE_SEASON_SHIFT',
      },
      periods,
      students: Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  async getTeamSeasonMatrix(
    institutionId: string,
    teamSeasonId: string
  ): Promise<PaymentsMatrixResponseDto> {
    const teamSeason = await this.prisma.teamSeason.findFirst({
      where: {
        id: teamSeasonId,
        team: {
          club: {
            institutionId: institutionId
          }
        }
      },
      include: {
        season: true,
        billingConfig: true,
        team: true,
        category: true,
        playerMemberships: {
          include: {
            player: {
              include: {
                person: true
              }
            },
            membershipCharges: {
              where: {
                type: TypeMembershipCharge.RECURRING_FEE,
              },
              include: {
                charge: {
                  include: {
                    payments: {
                      where: { status: 'COMPLETED' },
                      select: { amount: true, paymentDate: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!teamSeason) {
      throw new NotFoundException(`Temporada de equipo ${teamSeasonId} no encontrada`);
    }

    const season = teamSeason.season;
    const frequency = teamSeason.billingConfig?.billingFrequency || 'MONTHLY';

    // 1. Generar los periodos base
    const absoluteCycles = getAbsoluteSeasonCycles(season.startDate, season.endDate, frequency);
    
    const periods: PaymentMatrixPeriodDto[] = absoluteCycles.map(c => ({
      key: `${c.billingYear}-${c.billingMonth}-${c.billingCycle}`,
      label: buildCycleDescription(c.cycleStartDate, c.cycleEndDate, frequency),
      startDate: c.cycleStartDate.toISOString(),
      endDate: c.cycleEndDate.toISOString(),
    }));

    // 3. Agrupar la información por jugador
    const studentMap = new Map<string, PaymentMatrixStudentDto>();

    for (const membership of teamSeason.playerMemberships) {
      const studentId = membership.player.id;
      const studentName = `${membership.player.person.name} ${membership.player.person.lastName}`.trim();

      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          id: studentId,
          name: studentName,
          paymentsByPeriod: {},
        });
      }

      const studentDto = studentMap.get(studentId)!;

      for (const mCharge of membership.membershipCharges) {
        if (!mCharge.charge) continue;

        // Para TeamSeason, la correspondencia del periodo se da por año, mes y ciclo de facturación
        const key = `${mCharge.billingYear}-${mCharge.billingMonth}-${mCharge.billingCycle || 1}`;

        // Verificamos que este periodo sea parte de los periodos absolutos de la temporada
        // (Podría haber cargos extra-temporada pero los omitimos en este reporte estructurado, 
        // o los mostramos si se requiere, pero el PDF debe tener columnas definidas).
        if (!periods.some(p => p.key === key)) {
           continue; 
        }

        let totalPaid = 0;
        const payments = mCharge.charge.payments.map(p => {
          const amt = Number(p.amount);
          totalPaid += amt;
          return {
            amount: amt,
            date: p.paymentDate.toISOString()
          };
        });

        if (!studentDto.paymentsByPeriod[key]) {
          studentDto.paymentsByPeriod[key] = {
            totalPaid: 0,
            payments: [],
          };
        }

        studentDto.paymentsByPeriod[key].totalPaid += totalPaid;
        studentDto.paymentsByPeriod[key].payments.push(...payments);
      }
    }

    return {
      group: {
        id: teamSeason.id,
        name: `${teamSeason.team.name} - ${teamSeason.category.name}`,
        type: 'TEAM_SEASON',
        category: teamSeason.category.name,
      },
      periods,
      students: Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
}
