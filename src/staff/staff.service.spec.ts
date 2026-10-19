import { Test, TestingModule } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from 'src/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('StaffService', () => {
  let service: StaffService;
  let prisma: PrismaService;

  const mockStaff = {
    id: 'staff-uuid-1',
    personId: 'person-uuid-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    person: {
      id: 'person-uuid-1',
      name: 'Carlos',
      lastName: 'Valderrama',
      secondLastName: null,
      birthDate: new Date('1985-05-20'),
      imageUrl: null,
      documentType: 'CI',
      documentNumber: '1234567',
      phone: '77712345',
      email: 'carlos@can.bo',
      address: 'Av. Siempre Viva 123',
      gender: 'MALE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        {
          provide: PrismaService,
          useValue: {
            staff: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('debe registrar un nuevo miembro de staff si la persona no tiene una ficha previa', async () => {
      jest.spyOn(prisma.staff, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.staff, 'create').mockResolvedValue(mockStaff as any);

      const result = await service.create(
        { personId: 'person-uuid-1', isActive: true },
        { id: 'user-admin-id' },
      );

      expect(prisma.staff.findUnique).toHaveBeenCalledWith({
        where: { personId: 'person-uuid-1' },
      });
      expect(prisma.staff.create).toHaveBeenCalledWith({
        data: {
          personId: 'person-uuid-1',
          isActive: true,
          createdById: 'user-admin-id',
        },
        select: expect.any(Object),
      });
      expect(result.data.id).toBe('staff-uuid-1');
      expect(result.message).toBe('Personal creado exitosamente');
    });

    it('debe lanzar ConflictException si la persona ya está registrada como Staff', async () => {
      jest.spyOn(prisma.staff, 'findUnique').mockResolvedValue(mockStaff as any);

      await expect(
        service.create({ personId: 'person-uuid-1', isActive: true }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.staff.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('debe listar personal aplicando filtro de status ACTIVE', async () => {
      jest.spyOn(prisma.staff, 'findMany').mockResolvedValue([mockStaff] as any);
      jest.spyOn(prisma.staff, 'count').mockResolvedValue(1);

      const result = await service.findAll({
        page: 1,
        per_page: 10,
        status: 'ACTIVE',
      });

      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
    });

    it('debe listar personal aplicando filtro de status INACTIVE', async () => {
      jest.spyOn(prisma.staff, 'findMany').mockResolvedValue([] as any);
      jest.spyOn(prisma.staff, 'count').mockResolvedValue(0);

      const result = await service.findAll({
        page: 1,
        per_page: 10,
        status: 'INACTIVE',
      });

      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: false,
          }),
        }),
      );
      expect(result.data).toHaveLength(0);
    });

    it('debe listar todo el personal si status es ALL o no se especifica', async () => {
      jest.spyOn(prisma.staff, 'findMany').mockResolvedValue([mockStaff] as any);
      jest.spyOn(prisma.staff, 'count').mockResolvedValue(1);

      await service.findAll({ page: 1, per_page: 10, status: 'ALL' });

      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });
  });

  describe('findOne', () => {
    it('debe retornar los datos del staff si existe', async () => {
      jest.spyOn(prisma.staff, 'findUnique').mockResolvedValue(mockStaff as any);

      const result = await service.findOne('staff-uuid-1');
      expect(result.data.id).toBe('staff-uuid-1');
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      jest.spyOn(prisma.staff, 'findUnique').mockResolvedValue(null);

      await expect(service.findOne('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('debe actualizar los datos de la ficha staff', async () => {
      jest.spyOn(prisma.staff, 'findUnique').mockResolvedValue(mockStaff as any);
      jest.spyOn(prisma.staff, 'update').mockResolvedValue({
        ...mockStaff,
        isActive: false,
      } as any);

      const result = await service.update(
        'staff-uuid-1',
        { isActive: false },
        { id: 'admin-id' },
      );

      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff-uuid-1' },
        data: {
          isActive: false,
          updatedById: 'admin-id',
        },
        select: expect.any(Object),
      });
      expect(result.data.isActive).toBe(false);
    });
  });

  describe('deactivate y reactivate', () => {
    it('deactivate debe establecer isActive en false', async () => {
      jest.spyOn(prisma.staff, 'findUnique').mockResolvedValue(mockStaff as any);
      jest.spyOn(prisma.staff, 'update').mockResolvedValue({
        ...mockStaff,
        isActive: false,
      } as any);

      const result = await service.deactivate('staff-uuid-1', { id: 'admin-id' });

      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff-uuid-1' },
        data: {
          isActive: false,
          updatedById: 'admin-id',
        },
        select: expect.any(Object),
      });
      expect(result.message).toBe('Personal desactivado exitosamente');
      expect(result.data.isActive).toBe(false);
    });

    it('reactivate debe establecer isActive en true', async () => {
      jest.spyOn(prisma.staff, 'findUnique').mockResolvedValue({
        ...mockStaff,
        isActive: false,
      } as any);
      jest.spyOn(prisma.staff, 'update').mockResolvedValue({
        ...mockStaff,
        isActive: true,
      } as any);

      const result = await service.reactivate('staff-uuid-1', { id: 'admin-id' });

      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff-uuid-1' },
        data: {
          isActive: true,
          updatedById: 'admin-id',
        },
        select: expect.any(Object),
      });
      expect(result.message).toBe('Personal reactivado exitosamente');
      expect(result.data.isActive).toBe(true);
    });

    it('remove debe ejecutar desactivación lógica en vez de borrado físico', async () => {
      jest.spyOn(prisma.staff, 'findUnique').mockResolvedValue(mockStaff as any);
      jest.spyOn(prisma.staff, 'update').mockResolvedValue({
        ...mockStaff,
        isActive: false,
      } as any);

      const result = await service.remove('staff-uuid-1', { id: 'admin-id' });

      expect(prisma.staff.delete).not.toHaveBeenCalled();
      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff-uuid-1' },
        data: {
          isActive: false,
          updatedById: 'admin-id',
        },
        select: expect.any(Object),
      });
      expect(result.message).toBe('Personal desactivado exitosamente');
    });
  });
});
