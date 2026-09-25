-- ====================================================================
-- CIH INNOVATION LAB: ONLINE EQUIPMENT REQUISITIONS & ORDERS TABLE
-- Run this script in your Supabase Project SQL Editor:
-- https://supabase.com/dashboard/project/kkltrgjszsuozlrnjrnb/sql
-- ====================================================================

-- 1. Create the item_requests table
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

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_item_requests_status ON public.item_requests(status);
CREATE INDEX IF NOT EXISTS idx_item_requests_created_at ON public.item_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_requests_item_id ON public.item_requests(item_id);
CREATE INDEX IF NOT EXISTS idx_item_requests_requester_email ON public.item_requests(lower(requester_email));

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.item_requests ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Allow anyone (public/students) to submit an equipment requisition
DROP POLICY IF EXISTS "Allow public insert to item_requests" ON public.item_requests;
CREATE POLICY "Allow public insert to item_requests" ON public.item_requests
  FOR INSERT WITH CHECK (
    char_length(trim(requester_name)) >= 2 AND
    quantity > 0 AND
    (return_date IS NULL OR return_date >= needed_date)
  );

-- Allow anyone to read requisitions (to check status via email)
DROP POLICY IF EXISTS "Allow public read to item_requests" ON public.item_requests;
CREATE POLICY "Allow public read to item_requests" ON public.item_requests
  FOR SELECT USING (true);

-- Allow authenticated staff/admins to update requisitions (approve/decline/add notes)
DROP POLICY IF EXISTS "Allow authenticated update to item_requests" ON public.item_requests;
CREATE POLICY "Allow authenticated update to item_requests" ON public.item_requests
  FOR UPDATE TO authenticated USING (true);

-- Allow authenticated staff/admins to delete requisitions
DROP POLICY IF EXISTS "Allow authenticated delete to item_requests" ON public.item_requests;
CREATE POLICY "Allow authenticated delete to item_requests" ON public.item_requests
  FOR DELETE TO authenticated USING (true);

-- 5. Enable Supabase Realtime synchronization across all devices & admins
ALTER PUBLICATION supabase_realtime ADD TABLE public.item_requests;
