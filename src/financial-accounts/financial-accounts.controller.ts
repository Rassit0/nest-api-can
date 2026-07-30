import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { CreateFinancialAccountDto } from './dto/create-financial-account.dto';
import { UpdateFinancialAccountDto } from './dto/update-financial-account.dto';
import { FinancialAccountsService } from './financial-accounts.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ApiStandardResponse, ApiStandardCreatedResponse } from '../common/decorators/api-responses.decorator';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Financial Accounts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('financial-accounts')
export class FinancialAccountsController {
  constructor(private readonly financialAccountsService: FinancialAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las cuentas financieras', description: 'Retorna una lista completa de cajas y bancos activos e inactivos.' })
  @ApiStandardResponse(Object, 'Cuentas financieras obtenidas exitosamente.')
  @RequirePermissions('READ_FINANCIAL_ACCOUNTS')
  async findAll() {
    const data = await this.financialAccountsService.findAll();
    return {
      message: 'Cuentas financieras obtenidas exitosamente',
      data,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Crear una cuenta financiera', description: 'Crea una nueva caja o cuenta bancaria.' })
  @ApiStandardCreatedResponse(Object, 'Cuenta financiera creada exitosamente.')
  @RequirePermissions('CREATE_FINANCIAL_ACCOUNTS')
  async create(@Body() createDto: CreateFinancialAccountDto) {
    const data = await this.financialAccountsService.create(createDto);
    return {
      message: 'Cuenta financiera creada exitosamente',
      data,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una cuenta financiera', description: 'Modifica los datos de una caja o cuenta bancaria.' })
  @ApiParam({ name: 'id', description: 'ID de la cuenta financiera (UUID)' })
  @ApiStandardResponse(Object, 'Cuenta financiera actualizada exitosamente.')
  @RequirePermissions('UPDATE_FINANCIAL_ACCOUNTS')
  async update(@Param('id') id: string, @Body() updateDto: UpdateFinancialAccountDto) {
    const data = await this.financialAccountsService.update(id, updateDto);
    return {
      message: 'Cuenta financiera actualizada exitosamente',
      data,
    };
  }
}
