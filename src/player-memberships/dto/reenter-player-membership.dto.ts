import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReenterPlayerMembershipDto {
  @ApiProperty({
    description: 'ID de la membresía anterior en estado WITHDRAWN',
    example: '3be2139a-026a-4857-b9f7-972284d73a86',
  })
  @IsUUID('4', { message: 'previousMembershipId debe ser un UUID válido' })
  previousMembershipId: string;

  @ApiProperty({
    description: 'ID de la categoría de temporada donde reingresa',
    example: '266543e0-7604-4bab-bc12-f17c1a6ba3fd',
  })
  @IsUUID('4', { message: 'teamSeasonCategoryId debe ser un UUID válido' })
  teamSeasonCategoryId: string;

  @ApiProperty({
    description: 'ID del plan de pagos seleccionado',
    example: '65f3a176-8743-4ecc-8d8a-097ee60a1b87',
  })
  @IsUUID('4', { message: 'paymentPlanId debe ser un UUID válido' })
  paymentPlanId: string;

  @ApiProperty({
    description: 'Fecha efectiva de reingreso (ISO 8601)',
    example: '2026-08-01T00:00:00.000Z',
  })
  @IsISO8601(
    { strict: true },
    { message: 'startedAt debe ser una fecha ISO8601 válida' },
  )
  startedAt: string;

  @ApiPropertyOptional({
    description:
      'Indica si se debe cobrar matrícula en el reingreso (false = exonerada por ya haber pagado en la temporada)',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'chargeRegistration debe ser un booleano' })
  chargeRegistration?: boolean;

  @ApiPropertyOptional({
    description:
      'Indica si se debe omitir la cuota recurrente del mes en curso si ya fue pagada en el mismo mes antes de la baja',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'skipCurrentMonthRecurringFee debe ser un booleano' })
  skipCurrentMonthRecurringFee?: boolean;

  @ApiPropertyOptional({
    description: 'Observaciones o motivo administrativo del reingreso',
    example: 'Reingreso autorizado tras viaje familiar',
  })
  @IsOptional()
  @IsString({ message: 'notes debe ser una cadena de texto' })
  notes?: string;
}

export interface PlayerMembershipReentryInfoDto {
  player: {
    id: string;
    personId: string;
    fullName: string;
    documentNumber?: string | null;
    birthDate?: string | null;
  };
  previousMembership: {
    id: string;
    teamSeasonId: string;
    teamSeasonName: string;
    categoryName: string;
    startedAt: string;
    endedAt: string | null;
    withdrawalReason: string | null;
  };
  registrationFeeStatus: {
    hasPaidInSeason: boolean;
    paidAmount?: number;
    paymentDate?: string;
    receiptNumber?: string;
    seasonFeeAmount: number;
  };
  currentMonthStatus: {
    currentYear: number;
    currentMonth: number;
    hasPaidCurrentMonth: boolean;
    paidAmount?: number;
    receiptNumber?: string;
  };
  historicalDebts: {
    hasPendingDebts: boolean;
    totalPendingAmount: number;
    pendingCharges: {
      id: string;
      description: string;
      amount: number;
      pendingAmount: number;
      dueDate: string;
      type: string;
    }[];
  };
  cancelledChargesOnWithdrawal: {
    id: string;
    description: string;
    amount: number;
    dueDate: string;
  }[];
  availableCategories: {
    id: string;
    name: string;
    maxMembers: number | null;
    activeMembers: number;
    availableSpots: number | null;
    isCurrentCategory: boolean;
  }[];
  availablePaymentPlans: {
    id: string;
    name: string;
    registrationDiscountPercent: number;
    recurringDiscountPercent: number;
    isSinglePayment: boolean;
    advanceCycles: number;
  }[];
}
