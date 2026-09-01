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
            },
            studentCharges: {
              where: {
                type: {
                  in: [
                    TypeMembershipCharge.REGISTRATION,
                    TypeMembershipCharge.LATE_FEE,
                  ]
                }
              },
              include: {
                charge: {
                  include: {
                    parentCharge: {
                      include: {
                        studentCharges: true
                      }
                    },
                    payments: {
                      where: { status: 'COMPLETED' },
                      select: { amount: true, paymentDate: true, receiptSeries: true, receiptNumber: true }
                    }
                  }
                }
              }
            }
          }
        },
        charge: {
          include: {
            payments: {
              where: { status: 'COMPLETED' }, // Unica condición, Hard deletes controlan las reversiones
              select: { amount: true, paymentDate: true, receiptSeries: true, receiptNumber: true }
            }
          }
        }
      }
    });

    // 3. Agrupar la información por estudiante
    const studentMap = new Map<string, PaymentMatrixStudentDto>();

    for (const enrollment of enrollments) {
      const studentId = enrollment.studentMembership.student.id;
      const studentName = `${enrollment.studentMembership.student.person.lastName} ${enrollment.studentMembership.student.person.name}`.trim();

      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          id: studentId,
          name: studentName,
          paymentsByPeriod: {},
        });

        const studentDto = studentMap.get(studentId)!;
        // Procesar Matrícula si existe en el membership (solo una vez por estudiante)
        for (const mCharge of enrollment.studentMembership.studentCharges) {
          if (!mCharge.charge) continue;

          let isRegistration = false;
          if (mCharge.type === TypeMembershipCharge.REGISTRATION) {
            isRegistration = true;
          } else if (mCharge.type === TypeMembershipCharge.LATE_FEE) {
            const parentMembershipCharge = mCharge.charge.parentCharge?.studentCharges?.[0];
            if (parentMembershipCharge && parentMembershipCharge.type === TypeMembershipCharge.REGISTRATION) {
              isRegistration = true;
            }
          }

          if (isRegistration) {
            let totalPaid = 0;
            const payments = mCharge.charge.payments.map(p => {
              const amt = Number(p.amount);
              totalPaid += amt;
              let formattedReceipt = '';
              if (p.receiptSeries && p.receiptNumber) {
                formattedReceipt = `${p.receiptSeries}-${p.receiptNumber.toString().padStart(5, '0')}`;
              }
              return {
                amount: amt,
                date: p.paymentDate.toISOString(),
                receiptNumber: formattedReceipt,
                chargeType: mCharge.type as any,
                description: mCharge.charge?.description || undefined,
              };
            });

            if (!studentDto.registration) {
              studentDto.registration = { totalPaid: 0, payments: [] };
            }
            studentDto.registration.totalPaid += totalPaid;
            studentDto.registration.payments.push(...payments);
          }
        }
      }

      const studentDto = studentMap.get(studentId)!;

      // Continuación: Determinar a qué periodo pertenece este charge basándonos en las fechas
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
          let formattedReceipt = '';
          if (p.receiptSeries && p.receiptNumber) {
            formattedReceipt = `${p.receiptSeries}-${p.receiptNumber.toString().padStart(5, '0')}`;
          }
          return {
            amount: amt,
            date: p.paymentDate.toISOString(),
            receiptNumber: formattedReceipt,
            chargeType: 'RECURRING_FEE' as const,
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
    teamSeasonId: string,
    teamSeasonCategoryId?: string
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
        categories: { include: { category: true } },
        playerMemberships: {
          where: teamSeasonCategoryId ? { teamSeasonCategoryId } : undefined,
          include: {
            player: {
              include: {
                person: true
              }
            },
            membershipCharges: {
              where: {
                type: {
                  in: [
                    TypeMembershipCharge.RECURRING_FEE,
                    TypeMembershipCharge.REGISTRATION,
                    TypeMembershipCharge.LATE_FEE,
                    TypeMembershipCharge.MANUAL,
                  ]
                }
              },
              include: {
                charge: {
                  include: {
                    parentCharge: {
                      include: {
                        membershipCharges: true
                      }
                    },
                    payments: {
                      where: { status: 'COMPLETED' },
                      select: { amount: true, paymentDate: true, receiptSeries: true, receiptNumber: true }
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
      key: frequency === 'MONTHLY'
        ? `${c.billingYear}-${c.billingMonth}`
        : `${c.billingYear}-${c.billingMonth}-${c.billingCycle}`,
      label: buildCycleDescription(c.cycleStartDate, c.cycleEndDate, frequency),
      startDate: c.cycleStartDate.toISOString(),
      endDate: c.cycleEndDate.toISOString(),
    }));

    // 3. Agrupar la información por jugador
    const studentMap = new Map<string, PaymentMatrixStudentDto>();

    for (const membership of teamSeason.playerMemberships) {
      const studentId = membership.player.id;
      const studentName = `${membership.player.person.lastName} ${membership.player.person.name}`.trim();

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

        let bYear = mCharge.billingYear;
        let bMonth = mCharge.billingMonth;
        let bCycle = mCharge.billingCycle;

        let isRegistration = false;

        if (mCharge.type === TypeMembershipCharge.REGISTRATION) {
          isRegistration = true;
        } else if (mCharge.type === TypeMembershipCharge.LATE_FEE) {
          const parentMembershipCharge = mCharge.charge.parentCharge?.membershipCharges?.[0];
          if (parentMembershipCharge) {
            if (parentMembershipCharge.type === TypeMembershipCharge.REGISTRATION) {
              isRegistration = true;
            } else {
              bYear = parentMembershipCharge.billingYear;
              bMonth = parentMembershipCharge.billingMonth;
              bCycle = parentMembershipCharge.billingCycle;
            }
          }
        } else if (mCharge.type === TypeMembershipCharge.MANUAL) {
          bYear = mCharge.createdAt.getUTCFullYear();
          bMonth = mCharge.createdAt.getUTCMonth() + 1;
          bCycle = 1;
        }

        const key = frequency === 'MONTHLY'
          ? `${bYear}-${bMonth}`
          : `${bYear}-${bMonth}-${bCycle || 1}`;

        if (!isRegistration && !periods.some(p => p.key === key)) {
           continue; 
        }

        let totalPaid = 0;
        const payments = mCharge.charge.payments.map(p => {
          const amt = Number(p.amount);
          totalPaid += amt;
          
          let formattedReceipt = '';
          if (p.receiptSeries && p.receiptNumber) {
            formattedReceipt = `${p.receiptSeries}-${p.receiptNumber.toString().padStart(5, '0')}`;
          }

          return {
            amount: amt,
            date: p.paymentDate.toISOString(),
            receiptNumber: formattedReceipt,
            chargeType: mCharge.type as any,
            description: mCharge.charge?.description || undefined,
          };
        });

        if (isRegistration) {
          if (!studentDto.registration) {
            studentDto.registration = {
              totalPaid: 0,
              payments: [],
            };
          }
          studentDto.registration.totalPaid += totalPaid;
          studentDto.registration.payments.push(...payments);
        } else {
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
    }

    const displayCategories = teamSeasonCategoryId 
      ? teamSeason.categories.filter(c => c.id === teamSeasonCategoryId)
      : teamSeason.categories;

    return {
      group: {
        id: teamSeason.id,
        name: teamSeason.team.name,
        type: 'TEAM_SEASON',
        category: displayCategories.length > 0 
          ? displayCategories.map(c => c.category.name).join(', ')
          : 'Todas las categorías',
      },
      periods,
      students: Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
}
