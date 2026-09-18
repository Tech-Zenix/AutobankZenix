CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_payment_id
  ON payments(payment_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_code
  ON payments(code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_sepay_transaction_id
  ON payments(sepay_transaction_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments(status);

CREATE INDEX IF NOT EXISTS idx_payments_expires_at
  ON payments(expires_at);

CREATE INDEX IF NOT EXISTS idx_payments_code
  ON payments(code);
