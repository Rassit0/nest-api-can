import { validate } from 'class-validator';
import { ReactivateStudentMembershipDto } from './reactivate-student-membership.dto';

describe('ReactivateStudentMembershipDto', () => {
  let dto: ReactivateStudentMembershipDto;

  beforeEach(() => {
    dto = new ReactivateStudentMembershipDto();
  });

  describe('quantity', () => {
    it('debe aceptar valor >= 1', async () => {
      dto.quantity = 1;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('debe rechazar quantity = 0', async () => {
      dto.quantity = 0;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('quantity');
    });

    it('debe rechazar quantity = -1', async () => {
      dto.quantity = -1;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('quantity');
    });

    it('debe rechazar quantity decimal (ej. 1.5)', async () => {
      dto.quantity = 1.5;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('quantity');
    });
  });

  describe('reentryDate', () => {
    beforeEach(() => {
      dto.quantity = 1;
    });

    it('debe aceptar cuando reentryDate es omitido (undefined)', async () => {
      dto.reentryDate = undefined;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('debe aceptar ISO 8601 con timezone explícito (Z)', async () => {
      dto.reentryDate = '2026-09-15T00:00:00.000Z';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('debe aceptar ISO 8601 con offset (+00:00)', async () => {
      dto.reentryDate = '2026-09-15T00:00:00+04:00';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('debe rechazar ISO 8601 sin timezone explícito (ambiguo)', async () => {
      dto.reentryDate = '2026-09-15T00:00:00';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('reentryDate');
    });

    it('debe rechazar fecha solo día (ambigua sin timezone)', async () => {
      dto.reentryDate = '2026-09-15';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('reentryDate');
    });
    
    it('debe rechazar fecha completamente inválida', async () => {
      dto.reentryDate = 'fecha_invalida';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('reentryDate');
    });
  });
});
