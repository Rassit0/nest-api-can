-- Recalcular todos los balance_before y balance_after de Transactions
WITH recalculated AS (
  SELECT
    id,
    financial_account_id,
    type,
    amount,
    status,
    transaction_date,
    created_at,
    COALESCE(
      SUM(
        CASE 
          WHEN status = 'COMPLETED' THEN
            CASE WHEN type = 'INCOME' THEN amount ELSE -amount END
          ELSE 0
        END
      ) OVER (
        PARTITION BY financial_account_id
        ORDER BY transaction_date ASC, created_at ASC, id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ), 0
    ) AS calculated_balance_before,
    COALESCE(
      SUM(
        CASE 
          WHEN status = 'COMPLETED' THEN
            CASE WHEN type = 'INCOME' THEN amount ELSE -amount END
          ELSE 0
        END
      ) OVER (
        PARTITION BY financial_account_id
        ORDER BY transaction_date ASC, created_at ASC, id ASC
      ), 0
    ) AS calculated_balance_after
  FROM transactions
  WHERE financial_account_id IS NOT NULL
)
UPDATE transactions t
SET 
  balance_before = r.calculated_balance_before,
  balance_after = r.calculated_balance_after
FROM recalculated r
WHERE t.id = r.id;
