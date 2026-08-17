import { Controller, Post, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { StudentLateFeeService } from './student-late-fee.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Student Late Fees')
@Controller('student-charges')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class StudentLateFeeController {
  constructor(private readonly studentLateFeeService: StudentLateFeeService) {}

  @Post(':id/late-fee/preview')
  @ApiOperation({
    summary: 'Previsualizar recargo por mora',
    description: 'Calcula y previsualiza la mora correspondiente a un cargo vencido.',
  })
  @ApiParam({ name: 'id', description: 'ID del cargo base' })
  @ApiResponse({ status: 200, description: 'Previsualización generada correctamente.' })
  @RequirePermissions('CREATE_STUDENT_CHARGES')
  async previewLateFee(@Param('id', ParseUUIDPipe) chargeId: string) {
    const preview = await this.studentLateFeeService.previewLateFee(chargeId);
    return {
      message: 'Previsualización de recargo generada',
      data: preview,
    };
  }

  @Post(':id/late-fee/apply')
  @ApiOperation({
    summary: 'Aplicar recargo por mora',
    description: 'Calcula y aplica la mora sobre un cargo vencido creando un nuevo cargo de tipo LATE_FEE.',
  })
  @ApiParam({ name: 'id', description: 'ID del cargo base' })
  @ApiResponse({ status: 201, description: 'Recargo aplicado exitosamente.' })
  @RequirePermissions('CREATE_STUDENT_CHARGES')
  async applyLateFee(@Param('id', ParseUUIDPipe) chargeId: string) {
    return await this.studentLateFeeService.applyLateFee(chargeId);
  }
}
