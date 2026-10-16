import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type DashboardActivityActionType =
  | 'PAYMENT'
  | 'INTERNAL_TRANSFER'
  | 'ENROLLMENT'
  | 'MEMBERSHIP_STATUS'
  | 'SHIFT_OCCUPANCY'
  | 'SYSTEM';

export class DashboardActivityUserDto {
  @ApiProperty({ description: 'ID del usuario actor o SYSTEM' })
  id: string;

  @ApiProperty({ description: 'Nombre para mostrar del usuario' })
  displayName: string;
}

export class DashboardActivityContextDto {
  @ApiProperty({ description: 'Título descriptivo de la acción de negocio' })
  title: string;

  @ApiPropertyOptional({ description: 'Detalle descriptivo de la acción' })
  description?: string;

  @ApiPropertyOptional({ description: 'Monto financiero si corresponde' })
  amount?: number;

  @ApiPropertyOptional({ description: 'Moneda (ej. BOB)' })
  currency?: string;

  @ApiPropertyOptional({ description: 'Identificador, recibo o número de referencia' })
  identifier?: string;
}

export class DashboardActivityItemDto {
  @ApiProperty({ description: 'ID del log de auditoría' })
  id: string;

  @ApiProperty({
    description: 'Tipo de acción clasificada en el dominio de negocio',
    enum: ['PAYMENT', 'INTERNAL_TRANSFER', 'ENROLLMENT', 'MEMBERSHIP_STATUS', 'SHIFT_OCCUPANCY', 'SYSTEM'],
  })
  actionType: DashboardActivityActionType;

  @ApiProperty({ description: 'Acción cruda de auditoría (CREATE, UPDATE, DELETE, UPSERT)' })
  rawAction: string;

  @ApiProperty({ description: 'Nombre de la entidad auditada' })
  entityName: string;

  @ApiPropertyOptional({ description: 'ID de la entidad auditada' })
  entityId?: string;

  @ApiProperty({ description: 'Fecha de creación en ISO 8601' })
  createdAt: string;

  @ApiPropertyOptional({ description: 'Usuario que ejecutó la acción (null si es del sistema)', type: DashboardActivityUserDto })
  user: DashboardActivityUserDto | null;

  @ApiProperty({ description: 'Contexto de negocio sanitizado', type: DashboardActivityContextDto })
  context: DashboardActivityContextDto;
}

export class DashboardActivityResponseDto {
  @ApiProperty({ description: 'Lista de eventos de actividad recientes', type: [DashboardActivityItemDto] })
  items: DashboardActivityItemDto[];

  @ApiProperty({ description: 'Total de eventos devueltos en la respuesta' })
  total: number;
}
