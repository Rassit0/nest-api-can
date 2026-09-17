import { validate } from 'class-validator';
import { CreateSessionDto } from './create-session.dto';

describe('CreateSessionDto - ISO 8601 Validation', () => {
  let dto: CreateSessionDto;

  beforeEach(() => {
    dto = new CreateSessionDto();
    // Default valid values to isolate date testing
    dto.startDate = '2026-09-17T18:00:00Z';
    dto.endDate = '2026-09-17T19:30:00Z';
  });

  it('debe aceptar un string UTC ISO 8601 válido (✓ ISO 8601 UTC válido)', async () => {
    dto.startDate = '2026-09-17T18:00:00Z'; // UTC Z
    dto.endDate = '2026-09-17T19:30:00Z';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('debe aceptar un string ISO 8601 válido con offset explícito (✓ ISO 8601 válido según contrato aceptado)', async () => {
    dto.startDate = '2026-09-17T14:00:00-04:00'; // UTC -4
    dto.endDate = '2026-09-17T15:30:00-04:00';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('debe rechazar strings de fecha inválidos (✗ string de fecha inválido)', async () => {
    dto.startDate = 'invalid-date';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('startDate');
  });

  it('debe rechazar formatos locales ambiguos sin zona horaria (✗ formato local ambiguo)', async () => {
    // strict ISO 8601 validator might reject YYYY-MM-DD HH:mm:ss without T or Z
    dto.startDate = '2026-09-17 18:00:00'; 
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('startDate');
  });
});
