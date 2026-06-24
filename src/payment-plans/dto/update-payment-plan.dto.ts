import { PartialType } from '@nestjs/swagger';
import { CreatePaymentPlanDto } from './create-payment-plan.dto';

export class UpdatePaymentPlanDto extends PartialType(CreatePaymentPlanDto) {}
