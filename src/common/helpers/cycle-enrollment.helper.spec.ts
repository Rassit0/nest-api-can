import { isCycleEnrollmentExpired } from './cycle-enrollment.helper';

describe('isCycleEnrollmentExpired', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Caso 1: 23h 59m 59s -> NO expirado', () => {
    const now = new Date('2026-08-24T12:00:00.000Z');
    jest.setSystemTime(now);

    const createdAt = new Date(now.getTime() - (24 * 60 * 60 * 1000) + 1000); // exactly 23h 59m 59s ago
    expect(isCycleEnrollmentExpired(createdAt)).toBe(false);
  });

  it('Caso 2: Exactamente 24h -> EXPIRADO', () => {
    const now = new Date('2026-08-24T12:00:00.000Z');
    jest.setSystemTime(now);

    const createdAt = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // exactly 24h ago
    expect(isCycleEnrollmentExpired(createdAt)).toBe(true);
  });

  it('Caso 3: 24h + 1ms -> EXPIRADO', () => {
    const now = new Date('2026-08-24T12:00:00.000Z');
    jest.setSystemTime(now);

    const createdAt = new Date(now.getTime() - (24 * 60 * 60 * 1000) - 1); // exactly 24h 1ms ago
    expect(isCycleEnrollmentExpired(createdAt)).toBe(true);
  });
});
