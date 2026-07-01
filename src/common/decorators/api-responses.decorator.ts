import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import {
  PaginatedResponseDto,
  StandardResponseDto,
} from '../dto/api-response.dto';

export const ApiStandardResponse = <DataDto extends Type<unknown>>(
  dataDto: DataDto,
  description = 'Operación exitosa',
) => {
  return applyDecorators(
    ApiExtraModels(StandardResponseDto, dataDto),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(StandardResponseDto) },
          {
            properties: {
              data: {
                $ref: getSchemaPath(dataDto),
              },
            },
          },
        ],
      },
    }),
  );
};

export const ApiStandardCreatedResponse = <DataDto extends Type<unknown>>(
  dataDto: DataDto,
  description = 'Recurso creado exitosamente',
) => {
  return applyDecorators(
    ApiExtraModels(StandardResponseDto, dataDto),
    ApiResponse({
      status: 201,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(StandardResponseDto) },
          {
            properties: {
              data: {
                $ref: getSchemaPath(dataDto),
              },
            },
          },
        ],
      },
    }),
  );
};

export const ApiPaginatedResponse = <DataDto extends Type<unknown>>(
  dataDto: DataDto,
  description = 'Datos obtenidos exitosamente',
) => {
  return applyDecorators(
    ApiExtraModels(PaginatedResponseDto, dataDto),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(dataDto) },
              },
            },
          },
        ],
      },
    }),
  );
};
