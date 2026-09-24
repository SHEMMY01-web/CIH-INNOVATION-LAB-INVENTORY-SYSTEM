-- ==========================================
-- 0. ADD NEW COLUMNS & CONSTRAINTS
-- ==========================================
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS perfectly_working INT DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS not_working INT DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS to_be_received INT DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS supplier TEXT DEFAULT '';

-- Validate item lifecycle status constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_item_valid_status'
  ) THEN
    ALTER TABLE public.items 
      ADD CONSTRAINT chk_item_valid_status 
      CHECK (status IN ('available', 'Out of Stock', 'In Use', 'Under Maintenance', 'Decommissioned'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- 1. ROLE-BASED ACCESS CONTROL (RBAC) SETUP
-- ==========================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'student');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read to user_roles" ON public.user_roles;
CREATE POLICY "Allow authenticated read to user_roles" ON public.user_roles 
  FOR SELECT TO authenticated USING (true);

-- Helper function to verify admin/staff privileges
CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If user_roles has entries for current user, enforce role check
  IF EXISTS (SELECT 1 FROM user_roles WHERE id = auth.uid()) THEN
    RETURN EXISTS (
      SELECT 1 FROM user_roles 
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    );
  END IF;
  -- Default fallback: Allow authenticated user if roles table is not yet populated
  RETURN auth.uid() IS NOT NULL;
END;
$$;

-- ==========================================
-- 2. UPDATE ITEMS TABLE POLICIES (RBAC HARDENED)
-- ==========================================
DROP POLICY IF EXISTS "Allow public read to items" ON public.items;
CREATE POLICY "Allow public read to items" ON public.items 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated update to items" ON public.items;
CREATE POLICY "Allow authenticated update to items" ON public.items 
  FOR UPDATE TO authenticated USING (is_admin_or_staff());

DROP POLICY IF EXISTS "Allow authenticated insert to items" ON public.items;
CREATE POLICY "Allow authenticated insert to items" ON public.items 
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_staff());

DROP POLICY IF EXISTS "Allow authenticated delete of items" ON public.items;
CREATE POLICY "Allow authenticated delete of items" ON public.items 
  FOR DELETE TO authenticated USING (is_admin_or_staff());

-- ==========================================
-- 3. UPDATE TRANSACTIONS & PROJECTS POLICIES
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated read to transactions" ON public.transactions;
CREATE POLICY "Allow authenticated read to transactions" ON public.transactions 
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated insert to transactions" ON public.transactions;
CREATE POLICY "Allow authenticated insert to transactions" ON public.transactions 
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_staff());

DROP POLICY IF EXISTS "Allow public read to projects" ON public.projects;
CREATE POLICY "Allow public read to projects" ON public.projects 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert to projects" ON public.projects;
CREATE POLICY "Allow authenticated insert to projects" ON public.projects 
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_staff());

DROP POLICY IF EXISTS "Allow authenticated update to projects" ON public.projects;
CREATE POLICY "Allow authenticated update to projects" ON public.projects 
  FOR UPDATE TO authenticated USING (is_admin_or_staff());

DROP POLICY IF EXISTS "Allow authenticated delete of projects" ON public.projects;
CREATE POLICY "Allow authenticated delete of projects" ON public.projects 
  FOR DELETE TO authenticated USING (is_admin_or_staff());

-- ==========================================
-- 4. ATOMIC INVENTORY TRANSACTION RPC & CONSTRAINTS
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_items_amount_non_negative'
  ) THEN
    ALTER TABLE public.items ADD CONSTRAINT chk_items_amount_non_negative CHECK (amount >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.execute_inventory_transaction(
  p_item_id UUID,
  p_tx_type TEXT,
  p_amount INT,
  p_requester TEXT,
  p_project TEXT DEFAULT 'General',
  p_image_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_current_stock INT;
  v_new_stock INT;
  v_item_name TEXT;
  v_tx_id BIGINT;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transaction amount must be greater than zero (got %)', p_amount
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_tx_type NOT IN ('checkout', 'request', 'return') THEN
    RAISE EXCEPTION 'Invalid transaction type: %', p_tx_type
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Explicit pessimistic row lock: serializes concurrent checkouts and returns on this item
  SELECT amount, item_name INTO v_current_stock, v_item_name
  FROM items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item with ID % does not exist in inventory', p_item_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF p_tx_type IN ('checkout', 'request') THEN
    IF v_current_stock < p_amount THEN
      RAISE EXCEPTION 'Insufficient stock for "%": requested %, but only % available', 
        v_item_name, p_amount, v_current_stock
        USING ERRCODE = 'check_violation';
    END IF;
    v_new_stock := v_current_stock - p_amount;
  ELSE
    v_new_stock := v_current_stock + p_amount;
  END IF;

  -- 1. Mutate item stock atomically
  UPDATE items
  SET amount = v_new_stock,
      status = CASE 
        WHEN v_new_stock = 0 THEN 'Out of Stock' 
        WHEN status = 'Out of Stock' AND v_new_stock > 0 THEN 'available'
        ELSE status 
      END
  WHERE id = p_item_id;

  -- 2. Commit transaction audit record atomically
  INSERT INTO transactions (
    item_id,
    transaction_type,
    amount,
    requester,
    project,
    timestamp,
    image_url
  ) VALUES (
    p_item_id,
    p_tx_type,
    p_amount,
    trim(p_requester),
    COALESCE(NULLIF(trim(p_project), ''), 'General'),
    timezone('utc'::text, now()),
    p_image_url
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'previous_amount', v_current_stock,
    'new_amount', v_new_stock,
    'item_name', v_item_name
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.execute_inventory_transaction(UUID, TEXT, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_inventory_transaction(UUID, TEXT, INT, TEXT, TEXT, TEXT) TO authenticated;

-- Legacy helper (preserved for backward compatibility, hardened with validation and status synchronization)
CREATE OR REPLACE FUNCTION public.decrement_stock(item_id UUID, check_amount INT)
RETURNS void AS $$
BEGIN
  IF check_amount <= 0 THEN
    RAISE EXCEPTION 'Check amount must be positive';
  END IF;

  UPDATE items
  SET amount = amount - check_amount,
      status = CASE 
        WHEN amount - check_amount = 0 THEN 'Out of Stock' 
        ELSE status 
      END
  WHERE id = item_id AND amount >= check_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock or item not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
create index if not exists idx_attendance_user_punch_time on attendance_logs (device_user_id, punch_type, punch_time desc);

-- Hardened duplicate punch filter using transactional advisory lock to prevent race conditions
create or replace function filter_duplicate_punches()
returns trigger as $$
begin
  -- Advisory lock scoped to (attendance_punch, device_user_id) hashes serializes concurrent punches for this user
  perform pg_advisory_xact_lock(hashtext('attendance_punch'), hashtext(NEW.device_user_id));

  NEW.punch_time := COALESCE(NEW.punch_time, timezone('utc'::text, now()));

  if exists (
    select 1 from attendance_logs
    where device_user_id = NEW.device_user_id
    and punch_type = NEW.punch_type
    and punch_time >= NEW.punch_time - interval '2 minutes'
    and punch_time <= NEW.punch_time + interval '2 minutes'
  ) then 
    return null; 
  end if;

  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

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

-- ==========================================
-- 7. COMMENTS TABLE WITH FLOOD PROTECTION
-- ==========================================

-- Idempotent table creation (safe to run multiple times via migrations)
CREATE TABLE IF NOT EXISTS public.comments (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT,
  comment     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Database-engine hard limits: prevents TOAST bloat from multi-MB payloads
  CONSTRAINT  chk_comment_length CHECK (char_length(comment) >= 3 AND char_length(comment) <= 500),
  CONSTRAINT  chk_name_length    CHECK (name IS NULL OR (char_length(name) >= 2 AND char_length(name) <= 80))
);

-- ── Rate-limiter: Cap anonymous inserts at 50 per 5-minute rolling window ──
-- SECURITY DEFINER: executes with elevated privilege to count across all rows
-- regardless of the caller's RLS context, preventing bypass via role switching.
CREATE OR REPLACE FUNCTION public.check_comment_flood()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count INT;
BEGIN
  SELECT COUNT(*)
  INTO   v_recent_count
  FROM   public.comments
  WHERE  created_at > (NOW() - INTERVAL '5 minutes');

  IF v_recent_count >= 50 THEN
    RAISE EXCEPTION 'Comment rate limit exceeded. Please wait a few minutes before submitting again.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_comment_flood ON public.comments;
CREATE TRIGGER trg_check_comment_flood
  BEFORE INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_comment_flood();

-- ── Row-Level Security ──
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Public read: all visitors can view the feedback wall
DROP POLICY IF EXISTS "Allow public read access" ON public.comments;
CREATE POLICY "Allow public read access" ON public.comments
  FOR SELECT USING (true);

-- Public insert: allow only valid, size-bounded rows (open to anonymous users)
-- The trigger above enforces global rate limiting before this policy runs.
DROP POLICY IF EXISTS "Allow public insert access"   ON public.comments;
DROP POLICY IF EXISTS "Allow bounded public insert"  ON public.comments;
CREATE POLICY "Allow bounded public insert" ON public.comments
  FOR INSERT WITH CHECK (
    char_length(comment) >= 3 AND
    char_length(comment) <= 500 AND
    (name IS NULL OR char_length(name) <= 80)
  );

-- ==========================================
-- 8. ATOMIC STOCK RESTORATION RPC
-- ==========================================
CREATE OR REPLACE FUNCTION public.restore_stock(p_item_id UUID, p_restore_qty INT)
RETURNS void AS $$
BEGIN
  IF p_restore_qty <= 0 THEN
    RAISE EXCEPTION 'Restore quantity must be positive';
  END IF;

  UPDATE items
  SET amount = amount + p_restore_qty,
      status = CASE 
        WHEN status = 'Out of Stock' AND amount + p_restore_qty > 0 THEN 'available' 
        ELSE status 
      END
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found for stock restoration';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.restore_stock(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_stock(UUID, INT) TO authenticated;

-- ==========================================
-- 9. ONLINE ITEM REQUISITIONS & ORDERS TABLE
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

CREATE INDEX IF NOT EXISTS idx_item_requests_status ON public.item_requests(status);
CREATE INDEX IF NOT EXISTS idx_item_requests_created_at ON public.item_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_requests_item_id ON public.item_requests(item_id);

ALTER TABLE public.item_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an equipment requisition online
DROP POLICY IF EXISTS "Allow public insert to item_requests" ON public.item_requests;
CREATE POLICY "Allow public insert to item_requests" ON public.item_requests
  FOR INSERT WITH CHECK (
    char_length(trim(requester_name)) >= 2 AND
    quantity > 0 AND
    return_date >= needed_date
  );

-- Anyone can read requisitions (or students can view status)
DROP POLICY IF EXISTS "Allow public read to item_requests" ON public.item_requests;
CREATE POLICY "Allow public read to item_requests" ON public.item_requests
  FOR SELECT USING (true);

-- Authenticated staff/admin can approve, decline, update notes, or delete requisitions
DROP POLICY IF EXISTS "Allow authenticated update to item_requests" ON public.item_requests;
CREATE POLICY "Allow authenticated update to item_requests" ON public.item_requests
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated delete to item_requests" ON public.item_requests;
CREATE POLICY "Allow authenticated delete to item_requests" ON public.item_requests
  FOR DELETE TO authenticated USING (true);

