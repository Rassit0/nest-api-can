import { Test, TestingModule } from '@nestjs/testing';
import { StudentReactivationService } from './student-reactivation.service';
import { PrismaService } from 'src/prisma.service';
import { StudentMembershipRepository } from '../repositories/student-membership.repository';
import { StudentCycleManagerService } from './student-cycle-manager.service';
import { StudentMembershipStatus, CycleEnrollmentStatus } from 'src/generated/prisma/client';
import { Prisma } from 'src/generated/prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('StudentReactivationService (Fase 3A)', () => {
  let service: StudentReactivationService;
  let mockPrisma: any;
  let mockMembershipRepo: any;
  let mockCycleManager: any;
  let mockTx: any;

  beforeEach(async () => {
    mockTx = {
      cycleEnrollment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      studentMembership: {
        update: jest.fn().mockResolvedValue({ id: 'mem-1', status: StudentMembershipStatus.ACTIVE }),
      },
    };

    mockPrisma = {
      $transaction: jest.fn(async (cb) => {
        return cb(mockTx);
      }),
      cycleEnrollment: {
        findMany: jest.fn().mockResolvedValue([]),
      }
    };

    mockMembershipRepo = {
      getMembershipOrThrow: jest.fn(),
    };

    mockCycleManager = {
      enrollCyclesToMembership: jest.fn().mockResolvedValue({ generatedCount: 2 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentReactivationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StudentMembershipRepository, useValue: mockMembershipRepo },
        { provide: StudentCycleManagerService, useValue: mockCycleManager },
      ],
    }).compile();

    service = module.get<StudentReactivationService>(StudentReactivationService);
  });

  const generateMembership = (status: any = StudentMembershipStatus.SUSPENDED) => ({
    id: 'mem-1',
    status,
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    courseSeason: {
      billingConfig: { billingFrequency: 'MONTHLY' },
      season: {
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.000Z'),
      },
    },
  });

  it('Caso 1 y 6: Rechazar operación si la membresía no está SUSPENDED', async () => {
    mockMembershipRepo.getMembershipOrThrow.mockResolvedValue(generateMembership(StudentMembershipStatus.ACTIVE));
    
    await expect(service.reactivateWithCycles('mem-1', { quantity: 1 })).rejects.toThrow(
      new BadRequestException('Solo una membresía suspendida puede ser reactivada mediante reingreso.')
    );
  });

  it('Caso 7: Validar que rechaza si la fecha está fuera de la temporada (season)', async () => {
    mockMembershipRepo.getMembershipOrThrow.mockResolvedValue(generateMembership());
    
    await expect(
      service.reactivateWithCycles('mem-1', { quantity: 1, reentryDate: '2027-01-15T00:00:00.000Z' })
    ).rejects.toThrow(
      new BadRequestException('La fecha de reingreso debe estar dentro de la temporada.')
    );
  });

  it('Caso 2 y 4: Reingreso exitoso con reentryDate explícita y calculando ciclos correctamente', async () => {
    const membership = generateMembership();
    mockMembershipRepo.getMembershipOrThrow.mockResolvedValue(membership);
    
    // reentryDate: Septiembre 15
    const reentryDateStr = '2026-09-15T12:00:00.000Z';
    
    const result = await service.reactivateWithCycles('mem-1', { quantity: 2, reentryDate: reentryDateStr });
    
    expect(mockCycleManager.enrollCyclesToMembership).toHaveBeenCalled();
    const callArgs = mockCycleManager.enrollCyclesToMembership.mock.calls[0];
    
    expect(callArgs[1].length).toBe(2);
    expect(callArgs[1][0].cycleStartDate.getUTCMonth()).toBe(8); 
    expect(callArgs[1][1].cycleStartDate.getUTCMonth()).toBe(9); 
    
    expect(callArgs[2].toISOString()).toBe(reentryDateStr);
    
    expect(mockTx.studentMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StudentMembershipStatus.ACTIVE,
          histories: expect.objectContaining({
            create: expect.objectContaining({
              newStatus: StudentMembershipStatus.ACTIVE,
              reason: 'Reactivación por inscripción a nuevo ciclo',
            })
          })
        })
      })
    );
    
    expect(result.message).toContain('reactivada exitosamente');
  });

  it('Caso 11 y 12: Excluir ciclos anteriores a reentryDate e identificar si no hay suficientes ciclos', async () => {
    mockMembershipRepo.getMembershipOrThrow.mockResolvedValue(generateMembership());
    
    const reentryDateStr = '2026-11-15T00:00:00.000Z';
    
    await expect(
      service.reactivateWithCycles('mem-1', { quantity: 3, reentryDate: reentryDateStr })
    ).rejects.toThrow(
      new BadRequestException('No existen suficientes ciclos disponibles a partir de la fecha solicitada para satisfacer la cantidad requerida (3). Solo hay 2 disponibles.')
    );
  });

  it('Caso 13: Descartar ciclos ya inscritos (existentes en base de datos)', async () => {
    mockMembershipRepo.getMembershipOrThrow.mockResolvedValue(generateMembership());
    
    mockTx.cycleEnrollment.findMany.mockResolvedValue([{
      cycleStartDate: new Date('2026-09-01T00:00:00.000Z'),
      cycleEndDate: new Date('2026-10-01T00:00:00.000Z')
    }]);
    
    const reentryDateStr = '2026-09-15T00:00:00.000Z';
    
    await service.reactivateWithCycles('mem-1', { quantity: 1, reentryDate: reentryDateStr });
    
    const callArgs = mockCycleManager.enrollCyclesToMembership.mock.calls[0];
    expect(callArgs[1].length).toBe(1);
    expect(callArgs[1][0].cycleStartDate.getUTCMonth()).toBe(9); 
  });

  it('Caso 15, 16, 17 y 18: Rollback completo si falla la inscripción dentro de la transacción', async () => {
    mockMembershipRepo.getMembershipOrThrow.mockResolvedValue(generateMembership());
    
    mockCycleManager.enrollCyclesToMembership.mockRejectedValue(new Error('Fallo en la base de datos'));
    
    await expect(
      service.reactivateWithCycles('mem-1', { quantity: 1 })
    ).rejects.toThrow('Fallo en la base de datos');
    
    expect(mockTx.studentMembership.update).not.toHaveBeenCalled();
  });

  it('Caso de fallo al crear Charge: Rollback completo simulando fallo en facturación (enrollCyclesToMembership)', async () => {
    mockMembershipRepo.getMembershipOrThrow.mockResolvedValue(generateMembership());
    
    mockCycleManager.enrollCyclesToMembership.mockRejectedValue(new Error('Error al crear Charge en pasarela/BD'));
    
    await expect(
      service.reactivateWithCycles('mem-1', { quantity: 1 })
    ).rejects.toThrow('Error al crear Charge en pasarela/BD');
    
    expect(mockTx.studentMembership.update).not.toHaveBeenCalled();
  });

  it('Test de ciclo límite: cycleEndDate === reentryDate (Ciclo descartado)', async () => {
    mockMembershipRepo.getMembershipOrThrow.mockResolvedValue(generateMembership());
    
    // reentryDate exacta al límite exclusivo del ciclo de Septiembre (1 de Octubre a las 00:00:00Z)
    const reentryDateStr = '2026-10-01T00:00:00.000Z';
    
    await service.reactivateWithCycles('mem-1', { quantity: 1, reentryDate: reentryDateStr });
    
    const callArgs = mockCycleManager.enrollCyclesToMembership.mock.calls[0];
    
    // El ciclo que se debió tomar es Octubre (index 9 base 0), NO Septiembre
    expect(callArgs[1].length).toBe(1);
    expect(callArgs[1][0].cycleStartDate.getUTCMonth()).toBe(9); 
  });

  it('Test de reentryDate omitida (usa Date fallback)', async () => {
    mockMembershipRepo.getMembershipOrThrow.mockResolvedValue(generateMembership());
    
    const fakeNow = new Date('2026-08-15T10:00:00.000Z');
    jest.useFakeTimers({ now: fakeNow });
    
    try {
      await service.reactivateWithCycles('mem-1', { quantity: 1 });
      
      const callArgs = mockCycleManager.enrollCyclesToMembership.mock.calls[0];
      const passedDate: Date = callArgs[2];
      
      expect(passedDate.getTime()).toBe(fakeNow.getTime());
    } finally {
      jest.useRealTimers();
    }
  });

  it('Test de ciclo futuro: Se delega a StudentCycleManagerService', async () => {
    mockMembershipRepo.getMembershipOrThrow.mockResolvedValue(generateMembership());
    
    const reentryDateStr = '2026-09-15T00:00:00.000Z';
    // Se solicitan 2 ciclos. Según lógica base, será Septiembre y Octubre.
    // El motor base (StudentCycleManagerService) debe recibir esta fecha para calcular el prorrateo.
    await service.reactivateWithCycles('mem-1', { quantity: 2, reentryDate: reentryDateStr });
    
    const callArgs = mockCycleManager.enrollCyclesToMembership.mock.calls[0];
    expect(callArgs[1].length).toBe(2);
    expect(callArgs[1][0].cycleStartDate.getUTCMonth()).toBe(8); // Septiembre
    expect(callArgs[1][1].cycleStartDate.getUTCMonth()).toBe(9); // Octubre
    expect(callArgs[2].toISOString()).toBe(reentryDateStr);
    // Este test comprueba que StudentReactivationService NO calcula el prorrateo, 
    // simplemente inyecta reentryDate en enrollCyclesToMembership.
  });

  it('Test de Deuda Histórica: No bloquea el reingreso', async () => {
    mockMembershipRepo.getMembershipOrThrow.mockResolvedValue(generateMembership());
    
    // Aunque haya un Charge pending histórico (aquí simulamos que lo hay, pero el servicio 
    // reactivateWithCycles no realiza búsquedas de Charge, por lo que intrínsecamente no bloquea).
    // La prueba valida el happy path inalterado.
    const reentryDateStr = '2026-09-15T00:00:00.000Z';
    
    const result = await service.reactivateWithCycles('mem-1', { quantity: 1, reentryDate: reentryDateStr });
    
    expect(result.message).toContain('reactivada exitosamente');
    expect(mockCycleManager.enrollCyclesToMembership).toHaveBeenCalled();
  });

  it('Caso 20: Concurrencia que genera un duplicado hace rollback (UniqueConstraint)', async () => {
    mockMembershipRepo.getMembershipOrThrow.mockResolvedValue(generateMembership());
    
    const uniqueConstraintError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '4.0.0' }
    );
    mockCycleManager.enrollCyclesToMembership.mockRejectedValue(uniqueConstraintError);
    
    await expect(
      service.reactivateWithCycles('mem-1', { quantity: 1 })
    ).rejects.toThrow(
      new BadRequestException('Error de concurrencia: El ciclo solicitado ya fue procesado o se intentó reactivar simultáneamente.')
    );
    
    expect(mockTx.studentMembership.update).not.toHaveBeenCalled();
  });
});
