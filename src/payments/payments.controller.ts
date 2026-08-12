import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { TransactionsPaginationDto } from 'src/transactions/dto/pagination.dto';
import {
  ApiStandardResponse,
  ApiPaginatedResponse,
} from 'src/common/decorators/api-responses.decorator';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from 'src/auth/guards/user-role/user-role.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';

@ApiTags('Payments')
@Controller('payments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtener lista paginada de pagos consolidados',
    description: 'Retorna una lista paginada y filtrable de todos los pagos (Payments) realizados.',
  })
  @ApiPaginatedResponse(Object, 'Lista de pagos obtenida correctamente.')
  @RequirePermissions('READ_TRANSACTIONS') // Temporal: Reutilizar permisos de transactions
  async findAll(@Query() paginationDto: TransactionsPaginationDto) {
    return await this.paymentsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalles de un pago por ID',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del pago (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(Object, 'Pago encontrado exitosamente.')
  @RequirePermissions('READ_TRANSACTIONS')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.paymentsService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar / Anular un pago (Payment)',
    description:
      'Elimina físicamente un pago consolidado, elimina sus transacciones subyacentes, y devuelve (reversa) el saldo aplicado a los cargos asociados y cuentas financieras.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del pago a anular (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(Object, 'Pago y transacciones anulados exitosamente.')
  @RequirePermissions('DELETE_TRANSACTIONS')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.paymentsService.removePayment(id);
  }
}
