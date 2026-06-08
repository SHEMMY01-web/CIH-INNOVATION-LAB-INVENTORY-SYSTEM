-- ==========================================
-- 0. ADD NEW COLUMNS
-- ==========================================
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS perfectly_working INT DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS not_working INT DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS to_be_received INT DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS supplier TEXT DEFAULT '';

-- ==========================================
-- 1. UPDATE ITEMS TABLE POLICIES
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated update to items" ON public.items;
CREATE POLICY "Allow authenticated update to items" ON public.items FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated insert to items" ON public.items;
CREATE POLICY "Allow authenticated insert to items" ON public.items FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated delete of items" ON public.items;
CREATE POLICY "Allow authenticated delete of items" ON public.items FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ==========================================
-- 2. UPDATE TRANSACTIONS TABLE POLICIES
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated insert to transactions" ON public.transactions;
CREATE POLICY "Allow authenticated insert to transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ==========================================
-- 3. UPDATE PROJECTS TABLE POLICIES
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated insert to projects" ON public.projects;
CREATE POLICY "Allow authenticated insert to projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated update to projects" ON public.projects;
CREATE POLICY "Allow authenticated update to projects" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated delete of projects" ON public.projects;
CREATE POLICY "Allow authenticated delete of projects" ON public.projects FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ==========================================
-- 4. FIX RPC SECURITY WARNINGS
-- ==========================================
CREATE OR REPLACE FUNCTION public.decrement_stock(item_id UUID, check_amount INT)
RETURNS void AS $$
BEGIN
  UPDATE items
  SET amount = amount - check_amount
  WHERE id = item_id AND amount >= check_amount;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.decrement_stock(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_stock(UUID, INT) TO authenticated;

-- ==========================================
-- 5. CREATE ATTENDANCE LOGS TABLE & TRIGGER
-- ==========================================
create table if not exists attendance_logs (
  id bigint generated always as identity primary key,
  device_user_id text not null,
  punch_time timestamp with time zone not null,
  punch_type text default 'check',
  device_sn text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_attendance_user_time on attendance_logs (device_user_id, punch_time desc);

create or replace function filter_duplicate_punches()
returns trigger as $$
begin
  if exists (
    select 1 from attendance_logs
    where device_user_id = NEW.device_user_id
    and punch_time >= NEW.punch_time - interval '5 minutes'
    and punch_time <= NEW.punch_time + interval '5 minutes'
  ) then return null; end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists prevent_duplicate_punches on attendance_logs;
create trigger prevent_duplicate_punches before insert on attendance_logs for each row execute function filter_duplicate_punches();

-- ==========================================
-- 6. SECURE ATTENDANCE LOGS TABLE (RLS)
-- ==========================================
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read to attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow authenticated read to attendance_logs" ON public.attendance_logs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow service_role to insert logs" ON public.attendance_logs;
CREATE POLICY "Allow service_role to insert logs" ON public.attendance_logs FOR INSERT TO service_role WITH CHECK (true);

create table public.comments (
  id uuid default gen_random_uuid() primary key,
  name text,
  comment text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Allow public insert and select
alter table public.comments enable row level security;
create policy "Allow public read access" on public.comments for select using (true);
create policy "Allow public insert access" on public.comments for insert with check (true);
