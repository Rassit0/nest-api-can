import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { MembershipChargesService } from './membership-charges.service';
import { CreateMembershipChargeDto } from './dto/create-membership-charge.dto';
import { UpdateMembershipChargeDto } from './dto/update-membership-charge.dto';
import { ApiStandardResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { MembershipChargeResponseDto } from '../common/dto/responses/entities.dto';
import { PreviewMembershipChargesDto } from './dto/preview-membership-charges.dto';

@Controller('membership-charges')
export class MembershipChargesController {
  constructor(
    private readonly membershipChargesService: MembershipChargesService,
  ) {}

  @Post('preview')
  async previewCharges(@Body() previewData: PreviewMembershipChargesDto) {
    const charges = await this.membershipChargesService.previewCharges(previewData);
    
    return {
      message: 'Previsualización de cargos generada correctamente.',
      data: charges,
    };
  }

  @Get('preview/:membershipId')
  async previewExistingCharges(@Param('membershipId') membershipId: string) {
    const charges = await this.membershipChargesService.previewExistingCharges(membershipId);
    
    return {
      message: 'Previsualización de cargos faltantes generada correctamente.',
      data: charges,
    };
  }

  @Post('apply')
  async applyCharges() {
    await this.membershipChargesService.applyDailyMembershipCharges();

    return {
      message: 'Proceso de generación de cargos ejecutado correctamente.',
    };
  }
}
