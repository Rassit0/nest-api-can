import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination';

export class InternalTransfersPaginationDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'ID de la cuenta de origen' })
  @IsOptional()
  @IsUUID()
  sourceAccountId?: string;

  @ApiPropertyOptional({ description: 'ID de la cuenta de destino' })
  @IsOptional()
  @IsUUID()
  destinationAccountId?: string;

  @ApiPropertyOptional({ description: 'ID del usuario creador' })
  @IsOptional()
  @IsUUID()
  createdById?: string;

  @ApiPropertyOptional({ description: 'Fecha de inicio para el filtro de fechas (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin para el filtro de fechas (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
