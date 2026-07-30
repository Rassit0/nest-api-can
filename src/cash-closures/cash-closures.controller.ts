import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CashClosuresService } from './cash-closures.service';
import { CreateCashClosureDto } from './dto/create-cash-closure.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  ApiStandardResponse,
  ApiPaginatedResponse,
  ApiStandardCreatedResponse,
} from '../common/decorators/api-responses.decorator';
import { PaginationDto } from 'src/common/dto/pagination';

@ApiTags('Cash Closures')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('cash-closures')
export class CashClosuresController {
  constructor(private readonly cashClosuresService: CashClosuresService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un cierre de caja (Arqueo)',
    description:
      'Registra el conteo físico de una caja y calcula la diferencia con el sistema de forma inmutable.',
  })
  @ApiStandardCreatedResponse(Object, 'Cierre de caja registrado exitosamente')
  @RequirePermissions('CREATE_CASH_CLOSURES')
  async create(
    @Body() createCashClosureDto: CreateCashClosureDto,
    @Req() req: any,
  ) {
    const data = await this.cashClosuresService.create(
      createCashClosureDto,
      req.user.id,
    );
    return {
      message: 'Cierre de caja registrado exitosamente',
      data,
    };
  }

  @Get('account/:accountId')
  @ApiOperation({
    summary: 'Obtener historial de cierres por cuenta',
    description:
      'Obtiene la lista paginada de cierres de caja para una cuenta financiera específica.',
  })
  @ApiParam({ name: 'accountId', description: 'ID de la cuenta financiera' })
  @ApiPaginatedResponse(Object, 'Historial de cierres obtenido exitosamente')
  @RequirePermissions('READ_CASH_CLOSURES')
  async findAllByAccount(
    @Param('accountId') accountId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    const data = await this.cashClosuresService.findAllByAccount(
      accountId,
      paginationDto,
    );
    return {
      message: 'Historial de cierres obtenido exitosamente',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de un cierre de caja',
    description: 'Retorna los datos completos de un cierre de caja específico.',
  })
  @ApiParam({ name: 'id', description: 'ID del cierre de caja' })
  @ApiStandardResponse(
    Object,
    'Detalle de cierre de caja obtenido exitosamente',
  )
  @RequirePermissions('READ_CASH_CLOSURES')
  async findOne(@Param('id') id: string) {
    const data = await this.cashClosuresService.findOne(id);
    return {
      message: 'Detalle de cierre de caja obtenido exitosamente',
      data,
    };
  }
}
