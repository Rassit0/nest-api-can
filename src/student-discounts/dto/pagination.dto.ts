import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { MembershipDiscountType } from 'src/generated/prisma/client';

export class StudentDiscountsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'createdAt',
    enum: ['startDate', 'createdAt', 'type', 'id'],
  })
  @IsOptional()
  @IsIn(['startDate', 'createdAt', 'type', 'id'], {
    message: 'Columnas permitidas: startDate, createdAt, type, id',
  })
  sortField?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Filtrar por membresia del estudiante',
  })
  @IsUUID('4')
  @Exists('studentMembership', 'id')
  @IsOptional()
  studentMembershipId?: string;

  @ApiPropertyOptional({
    enum: MembershipDiscountType,
    description: 'Filtrar por tipo de descuento escolar',
  })
  @IsEnum(MembershipDiscountType)
  @IsOptional()
  type?: MembershipDiscountType;
}
