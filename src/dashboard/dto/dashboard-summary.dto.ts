import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialAccountType } from 'src/generated/prisma/client';

export class DashboardPeriodDto {
  @ApiProperty({ description: 'Fecha inicial en ISO 8601' })
  from: string;

  @ApiProperty({ description: 'Fecha final en ISO 8601' })
  to: string;

  @ApiProperty({ description: 'Etiqueta legible del período (ej. Octubre 2026)' })
  label: string;
}

export class DashboardAccountBalanceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: FinancialAccountType })
  type: FinancialAccountType;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  balance: number;

  @ApiProperty({ description: 'Porcentaje de participación sobre el total de liquidez' })
  percentage: number;
}

export class DashboardLiquidityDto {
  @ApiProperty({ description: 'Saldo total de cuentas activas en moneda base' })
  total: number;

  @ApiProperty({ description: 'Moneda principal (BOB)' })
  currency: string;

  @ApiProperty({ description: 'Cantidad de cuentas financieras activas' })
  activeAccountsCount: number;

  @ApiProperty({ type: [DashboardAccountBalanceDto] })
  accounts: DashboardAccountBalanceDto[];
}

export class DashboardFinancialFlowPointDto {
  @ApiProperty({ description: 'Fecha del punto de agregación (YYYY-MM-DD o YYYY-MM)' })
  date: string;

  @ApiProperty({ description: 'Total de ingresos operativos' })
  income: number;

  @ApiProperty({ description: 'Total de egresos operativos' })
  expense: number;

  @ApiProperty({ description: 'Resultado neto del punto (income - expense)' })
  netMargin: number;
}

export class DashboardFinancialFlowDto {
  @ApiProperty({ description: 'Total de ingresos externos aprobados en el período' })
  totalIncome: number;

  @ApiProperty({ description: 'Total de egresos externos aprobados en el período' })
  totalExpense: number;

  @ApiProperty({ description: 'Resultado neto operativo (totalIncome - totalExpense)' })
  netResult: number;

  @ApiProperty({ description: 'Serie temporal de puntos agregados', type: [DashboardFinancialFlowPointDto] })
  series: DashboardFinancialFlowPointDto[];
}

export class DashboardReceivablesSummaryDto {
  @ApiProperty({ description: 'Monto total pendiente de cobro' })
  totalPending: number;

  @ApiProperty({ description: 'Monto vencido (dueDate < hoy)' })
  overdueAmount: number;

  @ApiProperty({ description: 'Monto vigente dentro de plazo' })
  currentAmount: number;

  @ApiProperty({ description: 'Porcentaje de cartera vencida' })
  overduePercentage: number;

  @ApiProperty({ description: 'Cantidad total de cargos pendientes' })
  pendingChargesCount: number;

  @ApiProperty({ description: 'Cantidad de cargos con vencimiento superado' })
  overdueChargesCount: number;
}

export class DashboardCommunitySummaryDto {
  @ApiProperty({ description: 'Cantidad de personas físicas únicas con membresía activa' })
  uniqueActivePeople: number;

  @ApiProperty({ description: 'Total de membresías activas (Escuelas + Equipos)' })
  totalActiveMemberships: number;

  @ApiProperty({ description: 'Total de membresías activas en escuelas' })
  activeStudents: number;

  @ApiProperty({ description: 'Total de membresías activas en equipos de club' })
  activePlayers: number;

  @ApiProperty({ description: 'Deportistas con membresía simultánea en escuela y club' })
  dualAthletesCount: number;
}

export class DashboardShiftOccupancyItemDto {
  @ApiProperty()
  courseSeasonId: string;

  @ApiProperty()
  courseSeasonShiftId: string;

  @ApiProperty()
  courseName: string;

  @ApiProperty()
  shiftName: string;

  @ApiPropertyOptional()
  disciplineName?: string;

  @ApiProperty({ description: 'Cupos ocupados en el ciclo vigente (CONFIRMED + PENDING < 24h)' })
  occupied: number;

  @ApiProperty({ description: 'Capacidad máxima configurada' })
  capacity: number;

  @ApiProperty({ description: 'Cupos disponibles (Math.max(0, capacity - occupied))' })
  available: number;

  @ApiProperty({ description: 'Porcentaje de ocupación física' })
  rate: number;
}

export class DashboardCoursesOccupancyDto {
  @ApiProperty({ description: 'Capacidad total de los turnos activos' })
  totalCapacity: number;

  @ApiProperty({ description: 'Total de cupos ocupados en el ciclo vigente' })
  totalOccupied: number;

  @ApiProperty({ description: 'Tasa global de ocupación de la institución' })
  globalRate: number;

  @ApiProperty({ type: [DashboardShiftOccupancyItemDto] })
  topOccupiedShifts: DashboardShiftOccupancyItemDto[];
}

export class DashboardAlertItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ['FULL_SHIFT', 'OVERDUE_RECEIVABLES', 'EXPIRING_CYCLE'] })
  type: 'FULL_SHIFT' | 'OVERDUE_RECEIVABLES' | 'EXPIRING_CYCLE';

  @ApiProperty({ enum: ['CRITICAL', 'WARNING', 'INFO'] })
  severity: 'CRITICAL' | 'WARNING' | 'INFO';

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional()
  count?: number;

  @ApiPropertyOptional()
  actionLabel?: string;

  @ApiPropertyOptional()
  actionUrl?: string;
}

export class DashboardSummaryResponseDto {
  @ApiProperty({ type: DashboardPeriodDto })
  period: DashboardPeriodDto;

  @ApiPropertyOptional({ type: DashboardLiquidityDto })
  liquidity?: DashboardLiquidityDto;

  @ApiPropertyOptional({ type: DashboardFinancialFlowDto })
  financialFlow?: DashboardFinancialFlowDto;

  @ApiPropertyOptional({ type: DashboardReceivablesSummaryDto })
  receivables?: DashboardReceivablesSummaryDto;

  @ApiPropertyOptional({ type: DashboardCommunitySummaryDto })
  community?: DashboardCommunitySummaryDto;

  @ApiPropertyOptional({ type: DashboardCoursesOccupancyDto })
  coursesOccupancy?: DashboardCoursesOccupancyDto;

  @ApiPropertyOptional({ type: [DashboardAlertItemDto] })
  alerts?: DashboardAlertItemDto[];
}
