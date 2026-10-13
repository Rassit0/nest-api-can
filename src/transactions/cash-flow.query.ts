import { Prisma } from 'src/generated/prisma/client';
import { TransactionsPaginationDto } from './dto/pagination.dto';

export type CashFlowOperationKind = 'TRANSACTION' | 'PAYMENT' | 'INTERNAL_TRANSFER';

export interface CashFlowOperation {
  id: string;
  kind: CashFlowOperationKind;
  transactionDate: Date;
  createdAt: Date;
  receiptSeries: string | null;
  receiptNumber: number | null;
  concept: string;
  amount: number;
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  
  accountId?: string | null;
  paymentMethod?: string | null;
  reference?: string | null;

  sourceAccountId?: string | null;
  destAccountId?: string | null;

  balanceBefore?: number | null;
  balanceAfter?: number | null;
  sourceBalanceBefore?: number | null;
  sourceBalanceAfter?: number | null;
  destBalanceBefore?: number | null;
  destBalanceAfter?: number | null;

  groupedDetails?: {
    method: string;
    account: string;
    accountId?: string;
    amount: number;
    balanceBefore: number | null;
    balanceAfter: number | null;
  }[];
}

export const buildCashFlowQuery = (dto: TransactionsPaginationDto) => {
  const {
    type,
    financialAccountIds,
    startDate,
    endDate,
    search,
  } = dto;

  const conditions: Prisma.Sql[] = [];

  if (type === 'INCOME') {
    conditions.push(Prisma.sql`op.op_type = 'INCOME' AND op.kind != 'INTERNAL_TRANSFER'`);
  } else if (type === 'EXPENSE') {
    conditions.push(Prisma.sql`op.op_type = 'EXPENSE' AND op.kind != 'INTERNAL_TRANSFER'`);
  } else if (type === 'TRANSFER') {
    conditions.push(Prisma.sql`op.kind = 'INTERNAL_TRANSFER'`);
  }

  if (financialAccountIds && financialAccountIds.length > 0) {
    const accountIdsJoined = Prisma.join(financialAccountIds);
    conditions.push(Prisma.sql`(
      op.account_id IN (${accountIdsJoined}) OR 
      op.source_account_id IN (${accountIdsJoined}) OR 
      op.dest_account_id IN (${accountIdsJoined})
    )`);
  }

  if (startDate) {
    conditions.push(Prisma.sql`op.transaction_date >= ${new Date(startDate)}`);
  }
  if (endDate) {
    conditions.push(Prisma.sql`op.transaction_date <= ${new Date(endDate)}`);
  }

  if (search && search.trim() !== '') {
    const searchWord = `%${search.trim()}%`;
    conditions.push(Prisma.sql`(
      op.receipt_series ILIKE ${searchWord} OR 
      CAST(op.receipt_number AS TEXT) ILIKE ${searchWord} OR
      op.reference ILIKE ${searchWord}
    )`);
  }

  const whereClause = conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;

  const baseCTE = Prisma.sql`
    WITH RankedTransactions AS (
      SELECT 
        t.id,
        t.created_at,
        t.transaction_date,
        t.receipt_series,
        t.receipt_number,
        t.amount,
        t.type AS op_type,
        t.payment_method,
        t.financial_account_id AS account_id,
        t.reference_number AS reference,
        t.payment_id,
        t.balance_before AS "balanceBefore",
        t.balance_after AS "balanceAfter",
        it_source.id AS it_source_id,
        it_dest.id AS it_dest_id,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(t.payment_id, it_source.id, it_dest.id, t.id)
          ORDER BY t.created_at DESC
        ) as rn
      FROM transactions t
      LEFT JOIN internal_transfers it_source ON t.id = it_source.source_transaction_id
      LEFT JOIN internal_transfers it_dest ON t.id = it_dest.destination_transaction_id
    ),
    Operations AS (
      SELECT 
        rt.id AS raw_id,
        CASE
          WHEN rt.it_source_id IS NOT NULL OR rt.it_dest_id IS NOT NULL THEN 'INTERNAL_TRANSFER'
          WHEN rt.payment_id IS NOT NULL THEN 'PAYMENT'
          ELSE 'TRANSACTION'
        END AS kind,
        COALESCE(it.id, p.id, rt.id) AS id,
        COALESCE(it.created_at, p.created_at, rt.created_at) AS created_at,
        COALESCE(it.date, p.payment_date, rt.transaction_date) AS transaction_date,
        COALESCE(it.receipt_series, p.receipt_series, rt.receipt_series) AS receipt_series,
        COALESCE(it.receipt_number, p.receipt_number, rt.receipt_number) AS receipt_number,
        COALESCE(it.amount, p.amount, rt.amount) AS amount,
        rt.op_type,
        
        rt.account_id,
        fa.name AS account_name,
        t_src.financial_account_id AS source_account_id,
        fa_src.name AS source_account_name,
        t_dst.financial_account_id AS dest_account_id,
        fa_dst.name AS dest_account_name,
        
        rt.reference,
        rt.payment_method,
        
        rt."balanceBefore",
        rt."balanceAfter",
        t_src.balance_before AS source_balance_before,
        t_src.balance_after AS source_balance_after,
        t_dst.balance_before AS dest_balance_before,
        t_dst.balance_after AS dest_balance_after
      FROM RankedTransactions rt
      LEFT JOIN internal_transfers it ON it.id = COALESCE(rt.it_source_id, rt.it_dest_id)
      LEFT JOIN payments p ON p.id = rt.payment_id
      LEFT JOIN transactions t_src ON t_src.id = it.source_transaction_id
      LEFT JOIN transactions t_dst ON t_dst.id = it.destination_transaction_id
      LEFT JOIN financial_accounts fa ON fa.id = rt.account_id
      LEFT JOIN financial_accounts fa_src ON fa_src.id = t_src.financial_account_id
      LEFT JOIN financial_accounts fa_dst ON fa_dst.id = t_dst.financial_account_id
      WHERE rt.rn = 1
    )
  `;

  return { baseCTE, whereClause };
};
