import { Test, TestingModule } from '@nestjs/testing';
import { CourseCycleEnrollmentReport } from './course-cycle-enrollment.report';
import { ReportRegistry } from '../core/registry/report.registry';
import { PrinterService } from 'src/printer/printer.service';
import { PrismaService } from 'src/prisma.service';

describe('CourseCycleEnrollmentReport', () => {
  let report: CourseCycleEnrollmentReport;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourseCycleEnrollmentReport,
        {
          provide: ReportRegistry,
          useValue: { register: jest.fn() },
        },
        {
          provide: PrinterService,
          useValue: { createPdf: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    report = module.get<CourseCycleEnrollmentReport>(CourseCycleEnrollmentReport);
  });

  describe('extractDataset', () => {
    it('should calculate age and format names correctly', () => {
      const cycleStartDate = new Date('2026-10-01T00:00:00.000Z');
      const cycleEndDate = new Date('2026-10-31T23:59:59.000Z');

      const mockEnrollments = [
        {
          studentMembership: {
            startedAt: new Date('2026-10-01T10:00:00.000Z'),
            student: {
              person: {
                id: '1',
                name: ' Juan  ',
                lastName: ' Perez ',
                secondLastName: ' Lopez',
                birthDate: new Date('2010-05-15T00:00:00.000Z'),
              }
            },
            studentCharges: [],
          },
          charge: null,
        }
      ];

      const result = report.extractDataset(mockEnrollments, cycleStartDate, cycleEndDate);
      expect(result.length).toBe(1);
      expect(result[0].fullName).toBe('PEREZ LOPEZ JUAN');
      expect(result[0].ageStr).toBe('16'); // 2026 - 2010 = 16
    });

    it('should sum paid amounts and find the latest payment date', () => {
      const cycleStartDate = new Date('2026-10-01T00:00:00.000Z');
      const cycleEndDate = new Date('2026-10-31T23:59:59.000Z');

      const mockEnrollments = [
        {
          studentMembership: {
            startedAt: new Date('2026-09-15T10:00:00.000Z'), // Started before cycle
            student: {
              person: {
                id: '1',
                name: 'Ana',
                lastName: 'Gomez',
                birthDate: null,
              }
            },
            studentCharges: [
              {
                charge: {
                  amount: 150,
                  pendingAmount: 0,
                  adjustmentAmount: 0,
                  payments: [
                    { paymentDate: new Date('2026-09-15T10:00:00.000Z') }
                  ]
                }
              }
            ],
          },
          charge: {
            amount: 200,
            pendingAmount: 50,
            adjustmentAmount: 10,
            payments: [
              { paymentDate: new Date('2026-10-05T10:00:00.000Z') }
            ]
          },
        }
      ];

      const result = report.extractDataset(mockEnrollments, cycleStartDate, cycleEndDate);
      expect(result.length).toBe(1);
      
      // Membership started before the cycle, BUT the prompt says: "La matrícula se suma únicamente si esa matrícula pertenece al acto inicial de inscripción que creó/habilitó al estudiante para este mismo ciclo".
      // Our logic checks:
      // if (membershipStartedAt >= cycleStartDate && membershipStartedAt <= cycleEndDate || 
      //    (membershipStartedAt.getFullYear() === cycleStartDate.getFullYear() && membershipStartedAt.getMonth() === cycleStartDate.getMonth()))
      // 2026-09-15 is BEFORE cycle (2026-10), so it shouldn't include registration.
      
      expect(result[0].amountPaid).toBe('Bs 140.00'); // Only cycle paid: 200 - 50 - 10
      expect(result[0].paymentDate).toBe('05/10/2026');
    });

    it('should include registration fee if started in same month', () => {
      const cycleStartDate = new Date('2026-10-01T00:00:00.000Z');
      const cycleEndDate = new Date('2026-10-31T23:59:59.000Z');

      const mockEnrollments = [
        {
          studentMembership: {
            startedAt: new Date('2026-10-02T10:00:00.000Z'), // Same month
            student: {
              person: {
                id: '1',
                name: 'Ana',
                lastName: 'Gomez',
                birthDate: null,
              }
            },
            studentCharges: [
              {
                charge: {
                  amount: 150,
                  pendingAmount: 0,
                  adjustmentAmount: 0,
                  payments: [
                    { paymentDate: new Date('2026-10-02T10:00:00.000Z') }
                  ]
                }
              }
            ],
          },
          charge: {
            amount: 200,
            pendingAmount: 0,
            adjustmentAmount: 0,
            payments: [
              { paymentDate: new Date('2026-10-02T10:05:00.000Z') }
            ]
          },
        }
      ];

      const result = report.extractDataset(mockEnrollments, cycleStartDate, cycleEndDate);
      expect(result.length).toBe(1);
      
      expect(result[0].amountPaid).toBe('Bs 350.00'); // Cycle (200) + Reg (150)
      expect(result[0].paymentDate).toBe('02/10/2026'); // Same date for both
    });
  });
});
