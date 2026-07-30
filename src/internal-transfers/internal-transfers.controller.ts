import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { InternalTransfersService } from './internal-transfers.service';
import { CreateInternalTransferDto } from './dto/create-internal-transfer.dto';
import { InternalTransfersPaginationDto } from './dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ApiStandardResponse, ApiStandardCreatedResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';

@ApiTags('Internal Transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserRoleGuard)
@Controller('internal-transfers')
export class InternalTransfersController {
  constructor(private readonly internalTransfersService: InternalTransfersService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar una transferencia interna', description: 'Crea un movimiento de traspaso de fondos entre dos cajas/bancos.' })
  @ApiStandardCreatedResponse(Object, 'Transferencia interna procesada exitosamente.')
  @RequirePermissions('CREATE_INTERNAL_TRANSFERS')
  create(@Body() createInternalTransferDto: CreateInternalTransferDto, @Req() req: any) {
    const user = req.user;
    return this.internalTransfersService.create(createInternalTransferDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar transferencias internas', description: 'Obtiene una lista paginada de transferencias internas.' })
  @ApiPaginatedResponse(Object, 'Transferencias listadas exitosamente.')
  @RequirePermissions('READ_INTERNAL_TRANSFERS')
  findAll(@Query() paginationDto: InternalTransfersPaginationDto) {
    return this.internalTransfersService.findAll(paginationDto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Anular una transferencia interna', description: 'Revierte los saldos de ambas cuentas y marca la transferencia como cancelada.' })
  @ApiParam({ name: 'id', description: 'UUID de la transferencia' })
  @ApiStandardResponse(Object, 'Transferencia cancelada exitosamente.')
  @RequirePermissions('DELETE_INTERNAL_TRANSFERS')
  cancel(@Param('id') id: string) {
    return this.internalTransfersService.cancel(id);
  }
}
