-- ====================================================================
-- CIH INNOVATION LAB: CONSOLIDATED PRODUCTION DATABASE SCRIPT
-- Run this complete script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/kkltrgjszsuozlrnjrnb/sql/new
-- ====================================================================

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
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read to items" ON public.items;
CREATE POLICY "Allow public read to items" ON public.items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated update to items" ON public.items;
CREATE POLICY "Allow authenticated update to items" ON public.items FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated insert to items" ON public.items;
CREATE POLICY "Allow authenticated insert to items" ON public.items FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated delete of items" ON public.items;
CREATE POLICY "Allow authenticated delete of items" ON public.items FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ==========================================
-- 2. UPDATE TRANSACTIONS TABLE POLICIES
-- ==========================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read to transactions" ON public.transactions;
CREATE POLICY "Allow authenticated read to transactions" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated insert to transactions" ON public.transactions;
CREATE POLICY "Allow authenticated insert to transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ==========================================
-- 3. UPDATE PROJECTS TABLE POLICIES
-- ==========================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read to projects" ON public.projects;
CREATE POLICY "Allow public read to projects" ON public.projects FOR SELECT USING (true);

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
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id bigint generated always as identity primary key,
  device_user_id text not null,
  punch_time timestamp with time zone not null,
  punch_type text default 'check',
  device_sn text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_time ON public.attendance_logs (device_user_id, punch_time desc);

CREATE OR REPLACE FUNCTION public.filter_duplicate_punches()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM attendance_logs
    WHERE device_user_id = NEW.device_user_id
    AND punch_time >= NEW.punch_time - interval '5 minutes'
    AND punch_time <= NEW.punch_time + interval '5 minutes'
  ) THEN 
    RETURN null; 
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_duplicate_punches ON public.attendance_logs;
CREATE TRIGGER prevent_duplicate_punches 
BEFORE INSERT ON public.attendance_logs 
FOR EACH ROW EXECUTE FUNCTION public.filter_duplicate_punches();

-- ==========================================
-- 6. SECURE ATTENDANCE LOGS TABLE (RLS)
-- ==========================================
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read to attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow authenticated read to attendance_logs" ON public.attendance_logs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow service_role to insert logs" ON public.attendance_logs;
CREATE POLICY "Allow service_role to insert logs" ON public.attendance_logs FOR INSERT TO service_role WITH CHECK (true);

-- ==========================================
-- 7. COMMUNITY COMMENTS TABLE & POLICIES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid default gen_random_uuid() primary key,
  name text,
  comment text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.comments;
CREATE POLICY "Allow public read access" ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access" ON public.comments;
CREATE POLICY "Allow public insert access" ON public.comments FOR INSERT WITH CHECK (true);

-- ==========================================
-- 8. ONLINE ITEM REQUISITIONS & ORDERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.item_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  requester_name TEXT NOT NULL,
  requester_email TEXT,
  requester_phone TEXT,
  project_name TEXT NOT NULL DEFAULT 'General',
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  needed_date DATE NOT NULL,
  return_date DATE,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'returned')),
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,

  CONSTRAINT chk_item_requests_dates CHECK (return_date IS NULL OR return_date >= needed_date),
  CONSTRAINT chk_requester_name_len CHECK (char_length(trim(requester_name)) >= 2 AND char_length(requester_name) <= 120),
  CONSTRAINT chk_project_name_len CHECK (char_length(trim(project_name)) >= 2 AND char_length(project_name) <= 150)
);

-- Idempotent column and constraint adjustment for existing databases
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'item_requests' AND column_name = 'return_date' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.item_requests ALTER COLUMN return_date DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_item_requests_dates'
  ) THEN
    ALTER TABLE public.item_requests DROP CONSTRAINT chk_item_requests_dates;
    ALTER TABLE public.item_requests ADD CONSTRAINT chk_item_requests_dates CHECK (return_date IS NULL OR return_date >= needed_date);
  END IF;
END $$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_item_requests_status ON public.item_requests(status);
CREATE INDEX IF NOT EXISTS idx_item_requests_created_at ON public.item_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_requests_item_id ON public.item_requests(item_id);
CREATE INDEX IF NOT EXISTS idx_item_requests_requester_email ON public.item_requests(lower(requester_email));

-- Enable Row Level Security (RLS)
ALTER TABLE public.item_requests ENABLE ROW LEVEL SECURITY;

-- Requisition RLS Policies
DROP POLICY IF EXISTS "Allow public insert to item_requests" ON public.item_requests;
CREATE POLICY "Allow public insert to item_requests" ON public.item_requests
  FOR INSERT WITH CHECK (
    char_length(trim(requester_name)) >= 2 AND
    quantity > 0 AND
    (return_date IS NULL OR return_date >= needed_date)
  );

DROP POLICY IF EXISTS "Allow public read to item_requests" ON public.item_requests;
CREATE POLICY "Allow public read to item_requests" ON public.item_requests
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated update to item_requests" ON public.item_requests;
CREATE POLICY "Allow authenticated update to item_requests" ON public.item_requests
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated delete to item_requests" ON public.item_requests;
CREATE POLICY "Allow authenticated delete to item_requests" ON public.item_requests
  FOR DELETE TO authenticated USING (true);

-- Enable Supabase Realtime synchronization across all admin accounts (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'item_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.item_requests;
  END IF;
END $$;
