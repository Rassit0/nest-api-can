import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { MembershipDiscountService } from './membership-discount.service';
import { CreateMembershipDiscountDto } from './dto/create-membership-discount.dto';
import { UpdateMembershipDiscountDto } from './dto/update-membership-discount.dto';
import { PlayerMembershipDiscountsPaginationDto } from './dto/pagination.dto';
import { ApiStandardResponse, ApiStandardCreatedResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { MembershipDiscountResponseDto } from '../common/dto/responses/entities.dto';

@ApiTags('Player Membership Discounts')
@Controller('membership-discount')
export class MembershipDiscountController {
  constructor(
    private readonly membershipDiscountService: MembershipDiscountService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Asignar un descuento a una membresía de jugador',
    description: 'Registra y aplica un descuento a la membresía de un jugador.',
  })
  @ApiStandardCreatedResponse(MembershipDiscountResponseDto, 'Descuento de membresía registrado exitosamente.')
  async create(@Body() createMembershipDiscountDto: CreateMembershipDiscountDto) {
    return this.membershipDiscountService.create(createMembershipDiscountDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar descuentos de membresías',
    description:
      'Retorna una lista paginada y filtrable de todos los descuentos aplicados a membresías de jugadores.',
  })
  @ApiPaginatedResponse(MembershipDiscountResponseDto, 'Lista de descuentos obtenida correctamente.')
  async findAll(
    @Query() paginationDto: PlayerMembershipDiscountsPaginationDto,
  ) {
    return await this.membershipDiscountService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener descuento de membresía por ID',
    description:
      'Busca y retorna la información de un descuento específico por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del descuento (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(MembershipDiscountResponseDto, 'Descuento encontrado exitosamente.')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.membershipDiscountService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar descuento de membresía por ID',
    description: 'Modifica parámetros o porcentajes del descuento por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del descuento a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateMembershipDiscountDto })
  @ApiStandardResponse(MembershipDiscountResponseDto, 'Descuento actualizado exitosamente.')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMembershipDiscountDto: UpdateMembershipDiscountDto,
  ) {
    return await this.membershipDiscountService.update(
      id,
      updateMembershipDiscountDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar descuento de membresía por ID',
    description:
      'Remueve permanentemente el descuento de la membresía del jugador.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del descuento a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(MembershipDiscountResponseDto, 'Descuento eliminado con éxito.')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.membershipDiscountService.remove(id);
  }

  @Post(':id/finish')
  @ApiOperation({
    summary: 'Finalizar vigencia del descuento',
    description:
      'Finaliza de forma manual y anticipada la vigencia del descuento aplicado a la membresía.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del descuento a finalizar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Vigencia del descuento finalizada correctamente.',
  })
  @ApiBadRequestResponse({
    description: 'No se puede finalizar el descuento en su estado actual.',
  })
  async finish(@Param('id', ParseUUIDPipe) id: string) {
    return await this.membershipDiscountService.finish(id);
  }
}
