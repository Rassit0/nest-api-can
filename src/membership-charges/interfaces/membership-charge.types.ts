import { TypeMembershipCharge } from 'src/generated/prisma/client';
import { SimulatedCycle } from '../membership-cycles.engine';

export interface PreviewCharge {
  type: TypeMembershipCharge;
  description: string;
  amount: number;
  baseAmount?: number;
  adjustmentAmount?: number;
  discountPercent?: number;
  dueDate: Date;
  billingYear: number;
  billingMonth: number;
  billingCycle?: number | null;
  parentChargeType?: TypeMembershipCharge;
}

export interface ChargeBreakdown {
  totalBaseAmount: number;
  totalDiscount: number;
  totalLateFee?: number;
  totalNetAmount: number;
  currency: string;
}

export interface PreviewResult {
  charges: PreviewCharge[];
  breakdown: ChargeBreakdown;
}

export interface ExistingChargeMinimal {
  type: TypeMembershipCharge;
  billingYear: number | null;
  billingMonth: number | null;
  billingCycle: number | null;
}

export interface CycleBatch {
  cycles: SimulatedCycle[];
  groupDueDate: Date;
  lastCycleNextDueDate: Date;
}
