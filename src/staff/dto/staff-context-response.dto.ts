import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StaffContextResponseDto {
  @ApiProperty({
    example: true,
    description: 'Indica si el usuario autenticado está vinculado a un perfil de Staff activo',
  })
  isStaff: boolean;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la entidad Staff vinculada, o null si no es personal',
    nullable: true,
  })
  staffId?: string | null;

  @ApiProperty({
    example: true,
    description: 'Indica si el personal tiene al menos un grupo (curso o equipo) asignado activamente',
  })
  hasAssignments: boolean;

  @ApiProperty({
    example: 2,
    description: 'Total de grupos activos asignados',
  })
  activeGroupsCount: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si el usuario tiene alcance de supervisión global sobre todos los grupos',
    nullable: true,
  })
  isSupervisor?: boolean;
}
