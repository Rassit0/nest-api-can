import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class CreateManualChargeDto {
  @ApiProperty({
    description: 'El ID de la membresía (puede ser StudentMembership o StudentMembership según el contexto)',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  @IsNotEmpty()
  membershipId: string;

  @ApiProperty({
    description: 'Descripción que justificará el cargo manual',
    example: 'Cuota de equipamiento deportivo extra'
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Monto a cobrar por el cargo',
    example: 150.50
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Fecha límite de pago (Due Date)',
    example: '2026-07-15T00:00:00Z'
  })
  @IsDateString()
  @IsNotEmpty()
  dueDate: string;
}
