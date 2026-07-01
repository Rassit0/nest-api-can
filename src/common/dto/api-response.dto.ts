import { ApiProperty } from '@nestjs/swagger';

export class MetaDto {
  @ApiProperty({ example: 100 })
  totalItems: number;

  @ApiProperty({ example: 10 })
  itemsPerPage: number;

  @ApiProperty({ example: 10 })
  totalPages: number;

  @ApiProperty({ example: 1 })
  currentPage: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;

  @ApiProperty({ example: false })
  hasPrevPage: boolean;

  @ApiProperty({ example: 2, nullable: true })
  nextPage: number | null;

  @ApiProperty({ example: null, nullable: true })
  prevPage: number | null;
}

export class StandardResponseDto<T> {
  @ApiProperty({ example: 'Operación realizada exitosamente' })
  message: string;

  data: T;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ example: 'Datos obtenidos exitosamente' })
  message: string;

  data: T[];

  @ApiProperty({ type: () => MetaDto })
  meta: MetaDto;
}
