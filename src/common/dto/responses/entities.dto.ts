import { ApiProperty } from '@nestjs/swagger';

export class PersonResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  name: string;

  @ApiProperty({
    example: 'string',
  })
  lastName: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  secondLastName?: string;

  @ApiProperty({
    required: false,
    example: '2024-01-01T00:00:00Z',
  })
  birthDate?: Date;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  imageUrl?: string;

  @ApiProperty({
    example: 'any',
  })
  documentType: any;

  @ApiProperty({
    example: 'string',
  })
  documentNumber: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  phone?: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  email?: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  address?: string;

  @ApiProperty({
    example: 'any',
  })
  gender: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  contacts: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  contactOf: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  players: any[];

  @ApiProperty({
    required: false,
    example: 'any',
  })
  staff?: any;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  transactions: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  students: any[];

  @ApiProperty({
    required: false,
    example: 'any',
  })
  user?: any;

}

export class PersonContactResponseDto {
  @ApiProperty({
    example: 'string',
  })
  personId: string;

  @ApiProperty({
    example: 'any',
  })
  person: any;

  @ApiProperty({
    example: 'string',
  })
  contactPersonId: string;

  @ApiProperty({
    example: 'any',
  })
  contactPerson: any;

  @ApiProperty({
    example: 'any',
  })
  relationship: any;

  @ApiProperty({
    example: true,
  })
  isPrimaryContact: boolean;

  @ApiProperty({
    example: true,
  })
  isEmergencyContact: boolean;

  @ApiProperty({
    example: true,
  })
  isBillingContact: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

}

export class DisciplineResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  name: string;

  @ApiProperty({
    example: 'string',
  })
  icon: string;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  clubs: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  categories: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  seasons: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  schools: any[];

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class InstitutionResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  name: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  imageUrl?: string;

  @ApiProperty({
    example: 'string',
  })
  address: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  phone?: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  email?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  clubs: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  seasons: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  schools: any[];

}

export class ClubResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  name: string;

  @ApiProperty({
    example: 'string',
  })
  institutionId: string;

  @ApiProperty({
    example: 'any',
  })
  institution: any;

  @ApiProperty({
    example: 'string',
  })
  disciplineId: string;

  @ApiProperty({
    example: 'any',
  })
  discipline: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  teams: any[];

}

export class LocationResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  name: string;

  @ApiProperty({
    example: 'string',
  })
  address: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  description?: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  phone?: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  googleMapsUrl?: string;

  @ApiProperty({
    required: false,
    example: 1,
  })
  latitude?: number;

  @ApiProperty({
    required: false,
    example: 1,
  })
  longitude?: number;

  @ApiProperty({
    example: true,
  })
  isInternal: boolean;

  @ApiProperty({
    example: true,
  })
  isRentable: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  sessions: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  schedules: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  matches: any[];

}

export class CategoryResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  name: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  description?: string;

  @ApiProperty({
    example: 1,
  })
  maxAge: number;

  @ApiProperty({
    example: 1,
  })
  minAge: number;

  @ApiProperty({
    example: 'string',
  })
  disciplineId: string;

  @ApiProperty({
    example: 'any',
  })
  discipline: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  teamSeasons: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  courseSeasons: any[];

}

export class SeasonResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  institutionId: string;

  @ApiProperty({
    example: 'any',
  })
  institution: any;

  @ApiProperty({
    example: 'string',
  })
  disciplineId: string;

  @ApiProperty({
    example: 'any',
  })
  discipline: any;

  @ApiProperty({
    example: 'string',
  })
  name: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  description?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  startDate: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  endDate: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  teamSeasons: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  courseSeasons: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  progressEvaluations: any[];

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class TeamResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  imageUrl?: string;

  @ApiProperty({
    example: 'string',
  })
  name: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  description?: string;

  @ApiProperty({
    example: 'string',
  })
  clubId: string;

  @ApiProperty({
    example: 'any',
  })
  club: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  teamSeasons: any[];

}

export class TeamSeasonResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  imageUrl?: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  description?: string;

  @ApiProperty({
    example: 1,
  })
  maxMembers: number;

  @ApiProperty({
    example: 1,
  })
  minMembers: number;

  @ApiProperty({
    example: 'string',
  })
  teamId: string;

  @ApiProperty({
    example: 'any',
  })
  team: any;

  @ApiProperty({
    example: 'string',
  })
  categoryId: string;

  @ApiProperty({
    example: 'any',
  })
  category: any;

  @ApiProperty({
    example: 'string',
  })
  seasonId: string;

  @ApiProperty({
    example: 'any',
  })
  season: any;

  @ApiProperty({
    example: 'any',
  })
  gender: any;

  @ApiProperty({
    example: 1,
  })
  billingDay: number;

  @ApiProperty({
    example: 'any',
  })
  registrationFee: any;

  @ApiProperty({
    example: 'any',
  })
  recurringFee: any;

  @ApiProperty({
    example: 1,
  })
  debtToleranceMonths: number;

  @ApiProperty({
    example: true,
  })
  lateFeeEnabled: boolean;

  @ApiProperty({
    example: 'any',
  })
  lateFeePerDay: any;

  @ApiProperty({
    example: 1,
  })
  graceDays: number;

  @ApiProperty({
    example: 'any',
  })
  status: any;

  @ApiProperty({
    example: 1,
  })
  chargeGenerationDaysBefore: number;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  teamSeasonStaffs: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  paymentPlans: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  playerMemberships: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  sessionTeams: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  scheduleTeams: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  matches: any[];

}

export class PaymentPlanResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  teamSeasonId?: string;

  @ApiProperty({
    required: false,
    example: 'any',
  })
  teamSeasons?: any;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  courseSeasonId?: string;

  @ApiProperty({
    required: false,
    example: 'any',
  })
  courseSeason?: any;

  @ApiProperty({
    example: 'string',
  })
  name: string;

  @ApiProperty({
    example: 'any',
  })
  registrationDiscountPercent: any;

  @ApiProperty({
    example: 'any',
  })
  recurringDiscountPercent: any;

  @ApiProperty({
    example: true,
  })
  isDefault: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  playerMemberships: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  studentMemberships: any[];

}

export class PlayerResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  personId: string;

  @ApiProperty({
    example: 'any',
  })
  person: any;

  @ApiProperty({
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  playerMemberships: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  sessionBookings: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  matchLineups: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  progressEvaluations: any[];

}

export class PlayerMembershipResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  playerId: string;

  @ApiProperty({
    example: 'any',
  })
  player: any;

  @ApiProperty({
    example: 'string',
  })
  teamSeasonId: string;

  @ApiProperty({
    example: 'any',
  })
  teamSeason: any;

  @ApiProperty({
    example: 'string',
  })
  paymentPlanId: string;

  @ApiProperty({
    example: 'any',
  })
  paymentPlan: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  startedAt: Date;

  @ApiProperty({
    required: false,
    example: '2024-01-01T00:00:00Z',
  })
  endedAt?: Date;

  @ApiProperty({
    example: 'any',
  })
  status: any;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  notes?: string;

  @ApiProperty({
    required: false,
    example: '2024-01-01T00:00:00Z',
  })
  nextRecurringChargeGenerationDate?: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  membershipDiscounts: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  membershipCharges: any[];

}

export class MembershipDiscountResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  playerMembershipId: string;

  @ApiProperty({
    example: 'any',
  })
  playerMembership: any;

  @ApiProperty({
    example: 'any',
  })
  recurringDiscountPercent: any;

  @ApiProperty({
    example: 'any',
  })
  registrationDiscountPercent: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  startDate: Date;

  @ApiProperty({
    required: false,
    example: '2024-01-01T00:00:00Z',
  })
  endDate?: Date;

  @ApiProperty({
    example: 'any',
  })
  type: any;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  reason?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class MembershipChargeResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  playerMembershipId: string;

  @ApiProperty({
    example: 'any',
  })
  playerMembership: any;

  @ApiProperty({
    example: 'string',
  })
  chargeId: string;

  @ApiProperty({
    example: 'any',
  })
  charge: any;

  @ApiProperty({
    example: 'any',
  })
  type: any;

  @ApiProperty({
    example: true,
  })
  createdByCron: boolean;

  @ApiProperty({
    required: false,
    example: 1,
  })
  billingYear?: number;

  @ApiProperty({
    required: false,
    example: 1,
  })
  billingMonth?: number;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class StaffResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  personId: string;

  @ApiProperty({
    example: 'any',
  })
  person: any;

  @ApiProperty({
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  teamSeasonStaffs: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  courseSeasonStaffs: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  progressEvaluations: any[];

}

export class TeamSeasonStaffResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  teamSeasonId: string;

  @ApiProperty({
    example: 'string',
  })
  staffId: string;

  @ApiProperty({
    example: 'any',
  })
  role: any;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  customRole?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  startedAt: Date;

  @ApiProperty({
    required: false,
    example: '2024-01-01T00:00:00Z',
  })
  endedAt?: Date;

  @ApiProperty({
    example: true,
  })
  isPrimary: boolean;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  notes?: string;

  @ApiProperty({
    example: 'any',
  })
  teamSeason: any;

  @ApiProperty({
    example: 'any',
  })
  staff: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class ChargeResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  parentChargeId?: string;

  @ApiProperty({
    required: false,
    example: 'any',
  })
  parentCharge?: any;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  childCharges: any[];

  @ApiProperty({
    required: false,
    example: 'string',
  })
  description?: string;

  @ApiProperty({
    example: 'any',
  })
  amount: any;

  @ApiProperty({
    example: 'any',
  })
  pendingAmount: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  dueDate: Date;

  @ApiProperty({
    example: 'any',
  })
  status: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  membershipCharges: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  chargeTransactions: any[];

  @ApiProperty({
    required: false,
    example: 'any',
  })
  sessionBooking?: any;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  studentCharges: any[];

}

export class ChargeTransactionResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  chargeId: string;

  @ApiProperty({
    example: 'any',
  })
  charge: any;

  @ApiProperty({
    example: 'string',
  })
  transactionId: string;

  @ApiProperty({
    example: 'any',
  })
  transaction: any;

  @ApiProperty({
    example: 'any',
  })
  amountApplied: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class TransactionResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  payerPersonId?: string;

  @ApiProperty({
    required: false,
    example: 'any',
  })
  payerPerson?: any;

  @ApiProperty({
    example: 'any',
  })
  amount: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  transactionDate: Date;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  description?: string;

  @ApiProperty({
    example: 'any',
  })
  type: any;

  @ApiProperty({
    example: 'any',
  })
  paymentMethod: any;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  reference?: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  notes?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  chargeTransactions: any[];

}

export class UserResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  email: string;

  @ApiProperty({
    example: 'string',
  })
  passwordHash: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  personId?: string;

  @ApiProperty({
    required: false,
    example: 'any',
  })
  person?: any;

  @ApiProperty({
    example: 'string',
  })
  roleId: string;

  @ApiProperty({
    example: 'any',
  })
  role: any;

  @ApiProperty({
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class RoleResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  name: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  description?: string;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  permissions: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  users: any[];

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class PermissionResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  name: string;

  @ApiProperty({
    example: 'string',
  })
  module: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  description?: string;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  roles: any[];

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class RolePermissionResponseDto {
  @ApiProperty({
    example: 'string',
  })
  roleId: string;

  @ApiProperty({
    example: 'any',
  })
  role: any;

  @ApiProperty({
    example: 'string',
  })
  permissionId: string;

  @ApiProperty({
    example: 'any',
  })
  permission: any;

}

export class SchoolResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  name: string;

  @ApiProperty({
    example: 'string',
  })
  institutionId: string;

  @ApiProperty({
    example: 'any',
  })
  institution: any;

  @ApiProperty({
    example: 'string',
  })
  disciplineId: string;

  @ApiProperty({
    example: 'any',
  })
  discipline: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  courses: any[];

}

export class CourseResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  imageUrl?: string;

  @ApiProperty({
    example: 'string',
  })
  name: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  description?: string;

  @ApiProperty({
    example: 'string',
  })
  schoolId: string;

  @ApiProperty({
    example: 'any',
  })
  school: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  courseSeasons: any[];

}

export class CourseSeasonResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  imageUrl?: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  description?: string;

  @ApiProperty({
    example: 1,
  })
  maxMembers: number;

  @ApiProperty({
    example: 1,
  })
  minMembers: number;

  @ApiProperty({
    example: 'string',
  })
  courseId: string;

  @ApiProperty({
    example: 'any',
  })
  course: any;

  @ApiProperty({
    example: 'string',
  })
  categoryId: string;

  @ApiProperty({
    example: 'any',
  })
  category: any;

  @ApiProperty({
    example: 'string',
  })
  seasonId: string;

  @ApiProperty({
    example: 'any',
  })
  season: any;

  @ApiProperty({
    example: 'any',
  })
  gender: any;

  @ApiProperty({
    example: 1,
  })
  billingDay: number;

  @ApiProperty({
    example: 'any',
  })
  registrationFee: any;

  @ApiProperty({
    example: 'any',
  })
  recurringFee: any;

  @ApiProperty({
    example: 1,
  })
  debtToleranceMonths: number;

  @ApiProperty({
    example: true,
  })
  lateFeeEnabled: boolean;

  @ApiProperty({
    example: 'any',
  })
  lateFeePerDay: any;

  @ApiProperty({
    example: 1,
  })
  graceDays: number;

  @ApiProperty({
    example: 'any',
  })
  status: any;

  @ApiProperty({
    example: 1,
  })
  chargeGenerationDaysBefore: number;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  studentMemberships: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  paymentPlans: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  courseSeasonStaffs: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  sessionCourses: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  scheduleCourses: any[];

}

export class CourseSeasonStaffResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  courseSeasonId: string;

  @ApiProperty({
    example: 'any',
  })
  courseSeason: any;

  @ApiProperty({
    example: 'string',
  })
  staffId: string;

  @ApiProperty({
    example: 'any',
  })
  staff: any;

  @ApiProperty({
    example: 'any',
  })
  role: any;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  customRole?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  startedAt: Date;

  @ApiProperty({
    required: false,
    example: '2024-01-01T00:00:00Z',
  })
  endedAt?: Date;

  @ApiProperty({
    example: true,
  })
  isPrimary: boolean;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  notes?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class StudentResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  personId: string;

  @ApiProperty({
    example: 'any',
  })
  person: any;

  @ApiProperty({
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  studentMemberships: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  sessionBookings: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  progressEvaluations: any[];

}

export class StudentMembershipResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  studentId: string;

  @ApiProperty({
    example: 'any',
  })
  student: any;

  @ApiProperty({
    example: 'string',
  })
  courseSeasonId: string;

  @ApiProperty({
    example: 'any',
  })
  courseSeason: any;

  @ApiProperty({
    example: 'string',
  })
  paymentPlanId: string;

  @ApiProperty({
    example: 'any',
  })
  paymentPlan: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  startedAt: Date;

  @ApiProperty({
    required: false,
    example: '2024-01-01T00:00:00Z',
  })
  endedAt?: Date;

  @ApiProperty({
    example: 'any',
  })
  status: any;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  notes?: string;

  @ApiProperty({
    required: false,
    example: '2024-01-01T00:00:00Z',
  })
  nextRecurringChargeGenerationDate?: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  studentDiscounts: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  studentCharges: any[];

}

export class StudentDiscountResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  studentMembershipId: string;

  @ApiProperty({
    example: 'any',
  })
  studentMembership: any;

  @ApiProperty({
    example: 'any',
  })
  recurringDiscountPercent: any;

  @ApiProperty({
    example: 'any',
  })
  registrationDiscountPercent: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  startDate: Date;

  @ApiProperty({
    required: false,
    example: '2024-01-01T00:00:00Z',
  })
  endDate?: Date;

  @ApiProperty({
    example: 'any',
  })
  type: any;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  reason?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class StudentChargeResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  studentMembershipId: string;

  @ApiProperty({
    example: 'any',
  })
  studentMembership: any;

  @ApiProperty({
    example: 'string',
  })
  chargeId: string;

  @ApiProperty({
    example: 'any',
  })
  charge: any;

  @ApiProperty({
    example: 'any',
  })
  type: any;

  @ApiProperty({
    example: true,
  })
  createdByCron: boolean;

  @ApiProperty({
    required: false,
    example: 1,
  })
  billingYear?: number;

  @ApiProperty({
    required: false,
    example: 1,
  })
  billingMonth?: number;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class SessionIncidentResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  sessionBookingId: string;

  @ApiProperty({
    example: 'any',
  })
  sessionBooking: any;

  @ApiProperty({
    example: 'string',
  })
  description: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class ProgressEvaluationResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  playerId?: string;

  @ApiProperty({
    required: false,
    example: 'any',
  })
  player?: any;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  studentId?: string;

  @ApiProperty({
    required: false,
    example: 'any',
  })
  student?: any;

  @ApiProperty({
    example: 'string',
  })
  evaluatorStaffId: string;

  @ApiProperty({
    example: 'any',
  })
  evaluatorStaff: any;

  @ApiProperty({
    example: 'string',
  })
  seasonId: string;

  @ApiProperty({
    example: 'any',
  })
  season: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  evaluationDate: Date;

  @ApiProperty({
    required: false,
    example: 1,
  })
  technicalScore?: number;

  @ApiProperty({
    required: false,
    example: 1,
  })
  tacticalScore?: number;

  @ApiProperty({
    required: false,
    example: 1,
  })
  physicalScore?: number;

  @ApiProperty({
    required: false,
    example: 1,
  })
  behaviorScore?: number;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  notes?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class SessionResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  locationId?: string;

  @ApiProperty({
    required: false,
    example: 'any',
  })
  location?: any;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  title?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  dateTime: Date;

  @ApiProperty({
    example: 1,
  })
  durationMin: number;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  sessionTeams: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  sessionCourses: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  bookings: any[];

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class SessionTeamResponseDto {
  @ApiProperty({
    example: 'string',
  })
  sessionId: string;

  @ApiProperty({
    example: 'any',
  })
  session: any;

  @ApiProperty({
    example: 'string',
  })
  teamSeasonId: string;

  @ApiProperty({
    example: 'any',
  })
  teamSeason: any;

}

export class SessionCourseResponseDto {
  @ApiProperty({
    example: 'string',
  })
  sessionId: string;

  @ApiProperty({
    example: 'any',
  })
  session: any;

  @ApiProperty({
    example: 'string',
  })
  courseSeasonId: string;

  @ApiProperty({
    example: 'any',
  })
  courseSeason: any;

}

export class SessionBookingResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  sessionId: string;

  @ApiProperty({
    example: 'any',
  })
  session: any;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  playerId?: string;

  @ApiProperty({
    required: false,
    example: 'any',
  })
  player?: any;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  studentId?: string;

  @ApiProperty({
    required: false,
    example: 'any',
  })
  student?: any;

  @ApiProperty({
    example: true,
  })
  isExternal: boolean;

  @ApiProperty({
    example: true,
  })
  attended: boolean;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  chargeId?: string;

  @ApiProperty({
    required: false,
    example: 'any',
  })
  charge?: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  incidents: any[];

}

export class ScheduleResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  locationId?: string;

  @ApiProperty({
    required: false,
    example: 'any',
  })
  location?: any;

  @ApiProperty({
    example: 'any',
  })
  dayOfWeek: any;

  @ApiProperty({
    example: 'string',
  })
  startTime: string;

  @ApiProperty({
    example: 'string',
  })
  endTime: string;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  scheduleTeams: any[];

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  scheduleCourses: any[];

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class ScheduleTeamResponseDto {
  @ApiProperty({
    example: 'string',
  })
  scheduleId: string;

  @ApiProperty({
    example: 'any',
  })
  schedule: any;

  @ApiProperty({
    example: 'string',
  })
  teamSeasonId: string;

  @ApiProperty({
    example: 'any',
  })
  teamSeason: any;

}

export class ScheduleCourseResponseDto {
  @ApiProperty({
    example: 'string',
  })
  scheduleId: string;

  @ApiProperty({
    example: 'any',
  })
  schedule: any;

  @ApiProperty({
    example: 'string',
  })
  courseSeasonId: string;

  @ApiProperty({
    example: 'any',
  })
  courseSeason: any;

}

export class MatchResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  teamSeasonId: string;

  @ApiProperty({
    example: 'any',
  })
  teamSeason: any;

  @ApiProperty({
    required: false,
    example: 'string',
  })
  locationId?: string;

  @ApiProperty({
    required: false,
    example: 'any',
  })
  location?: any;

  @ApiProperty({
    example: 'string',
  })
  opponentName: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  matchDate: Date;

  @ApiProperty({
    example: 'any',
  })
  type: any;

  @ApiProperty({
    required: false,
    example: 1,
  })
  ourScore?: number;

  @ApiProperty({
    required: false,
    example: 1,
  })
  theirScore?: number;

  @ApiProperty({
    example: 'any',
  })
  result: any;

  @ApiProperty({
    isArray: true,
    example: 'any',
  })
  lineups: any[];

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

export class MatchLineupResponseDto {
  @ApiProperty({
    example: 'string',
  })
  id: string;

  @ApiProperty({
    example: 'string',
  })
  matchId: string;

  @ApiProperty({
    example: 'any',
  })
  match: any;

  @ApiProperty({
    example: 'string',
  })
  playerId: string;

  @ApiProperty({
    example: 'any',
  })
  player: any;

  @ApiProperty({
    example: 1,
  })
  minutesPlayed: number;

  @ApiProperty({
    example: 1,
  })
  goals: number;

  @ApiProperty({
    example: 1,
  })
  assists: number;

  @ApiProperty({
    example: 1,
  })
  yellowCards: number;

  @ApiProperty({
    example: 1,
  })
  redCards: number;

  @ApiProperty({
    example: true,
  })
  isStarter: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

}

