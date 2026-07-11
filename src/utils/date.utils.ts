export class DateUtils {
  static getEndOfUTCDay(date: Date | string | null = new Date()): Date {
    if (!date) return new Date();
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);
    return end;
  }

  static getStartOfUTCDay(date: Date | string | null = new Date()): Date {
    if (!date) return new Date();
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    return start;
  }
}
