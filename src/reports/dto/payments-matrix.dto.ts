import { IsUUID, IsOptional, IsISO8601 } from 'class-validator';

export interface PaymentMatrixPeriodDto {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

export interface PaymentMatrixPaymentDetailDto {
  amount: number;
  date: string;
  receiptNumber: string;
  chargeType: 'REGISTRATION' | 'RECURRING_FEE' | 'LATE_FEE' | 'MANUAL';
  description?: string;
}

export interface PaymentMatrixPeriodDataDto {
  totalPaid: number;
  payments: PaymentMatrixPaymentDetailDto[];
}

export interface PaymentMatrixStudentDto {
  id: string;
  name: string;
  registration?: PaymentMatrixPeriodDataDto;
  // Key represents the period 'key'
  paymentsByPeriod: Record<string, PaymentMatrixPeriodDataDto>;
}

export interface PaymentMatrixGroupDto {
  id: string;
  name: string;
  type: 'COURSE_SEASON_SHIFT' | 'TEAM_SEASON';
  category?: string;
  teacher?: string;
}

export interface PaymentsMatrixResponseDto {
  group: PaymentMatrixGroupDto;
  periods: PaymentMatrixPeriodDto[];
  students: PaymentMatrixStudentDto[];
}

export class TeamSeasonPaymentsMatrixPdfQueryDto {
  @IsOptional()
  @IsUUID()
  teamSeasonCategoryId?: string;

  @IsOptional()
  @IsISO8601()
  issuedAt?: string;

  @IsOptional()
  @IsISO8601()
  emissionDate?: string;
}

export class CourseSeasonShiftPaymentsMatrixPdfQueryDto {
  @IsOptional()
  @IsISO8601()
  issuedAt?: string;

  @IsOptional()
  @IsISO8601()
  emissionDate?: string;
}
