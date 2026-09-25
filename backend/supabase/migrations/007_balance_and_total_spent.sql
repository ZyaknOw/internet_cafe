-- Add balance and total_spent to account_profiles for customer billing and wallet top-ups
ALTER TABLE public.account_profiles 
ADD COLUMN IF NOT EXISTS balance NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_spent NUMERIC(10,2) DEFAULT 0.00;
