-- Add birth_date to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;

-- Update handle_new_user function to parse birth_date from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, birth_date)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    'user',
    (new.raw_user_meta_data->>'birth_date')::date
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
