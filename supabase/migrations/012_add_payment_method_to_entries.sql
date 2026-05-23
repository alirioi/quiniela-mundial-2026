-- Rename the column
ALTER TABLE public.entries RENAME COLUMN binance_pay_user TO payment_reference;

-- Add the new column
ALTER TABLE public.entries ADD COLUMN payment_method text not null default 'binance_pay';
