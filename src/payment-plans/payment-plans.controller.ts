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
import { PaymentPlansService } from './payment-plans.service';
import { CreatePaymentPlanDto } from './dto/create-payment-plan.dto';
import { UpdatePaymentPlanDto } from './dto/update-payment-plan.dto';
import { PaymentPlansPaginationDto } from './dto/pagination.dto';

@Controller('payment-plans')
export class PaymentPlansController {
  constructor(private readonly paymentPlansService: PaymentPlansService) {}

  @Post()
  async create(@Body() createPaymentPlanDto: CreatePaymentPlanDto) {
    return await this.paymentPlansService.create(createPaymentPlanDto);
  }

  @Get()
  async findAll(@Query() paginationDto: PaymentPlansPaginationDto) {
    return await this.paymentPlansService.findAll(paginationDto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.paymentPlansService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePaymentPlanDto: UpdatePaymentPlanDto,
  ) {
    return await this.paymentPlansService.update(id, updatePaymentPlanDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.paymentPlansService.remove(id);
  }
}
