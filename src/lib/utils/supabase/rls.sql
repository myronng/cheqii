-- Clean up existing functions to prevent overloading conflicts
DROP FUNCTION IF EXISTS check_user_has_bill_write_access(uuid, uuid);
DROP FUNCTION IF EXISTS check_user_has_bill_read_access(uuid, uuid);
DROP FUNCTION IF EXISTS check_bill_allows_any_access(uuid, uuid);

-- 1. check_bill_allows_any_access
CREATE OR REPLACE FUNCTION check_bill_allows_any_access(
    p_bill_id uuid,
    p_user_id uuid 
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    -- The bill does not require an invite
    (
      (
        SELECT bills.invite_required
        FROM bills
        WHERE bills.id = p_bill_id
      ) = false
    )
    OR
    -- There is no owner to the bill (should only happen during initial insert of the record or similar states)
    (
      (
        SELECT count(1)
        FROM bill_users
        WHERE bill_users.bill_id = p_bill_id
          AND bill_users.authority = 'owner'
      ) = 0
    )
  );
END;
$$;

-- 2. check_user_has_bill_read_access
CREATE OR REPLACE FUNCTION check_user_has_bill_read_access(
    p_bill_id uuid,
    p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
STABLE
SECURITY DEFINER 
AS $$
BEGIN
  RETURN (
    -- User is an owner, invited user, or public user for this bill
    (
      (
        SELECT count(1)
        FROM bill_users
        WHERE bill_users.authority IN ('owner', 'invited', 'public')
          AND bill_users.user_id = p_user_id
          AND bill_users.bill_id = p_bill_id
      ) > 0
    )
    OR
    -- The bill itself allows any access (e.g., no invite required, or no owner yet)
    check_bill_allows_any_access(p_bill_id, p_user_id)
  );
END;
$$;

-- 3. check_user_has_bill_write_access
CREATE OR REPLACE FUNCTION check_user_has_bill_write_access(
    p_bill_id uuid,
    p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    -- User is an owner or an invited user for this bill
    (
      (
        SELECT count(1)
        FROM bill_users
        WHERE bill_users.authority IN ('owner', 'invited')
          AND bill_users.user_id = p_user_id
          AND bill_users.bill_id = p_bill_id
      ) > 0
    )
    OR
    -- The bill itself allows any access (e.g., no invite required, or no owner yet)
    check_bill_allows_any_access(p_bill_id, p_user_id)
  );
END;
$$;

-- RLS POLICIES

-- public.bill_contributors
DROP POLICY IF EXISTS "Read access for applicable users" ON public.bill_contributors;
CREATE POLICY "Read access for applicable users"
  ON public.bill_contributors
  FOR SELECT
  TO authenticated
  USING (check_user_has_bill_read_access(bill_id, auth.uid()));

DROP POLICY IF EXISTS "Read/write access for applicable users" ON public.bill_contributors;
CREATE POLICY "Read/write access for applicable users"
  ON public.bill_contributors
  FOR ALL
  TO authenticated
  USING (check_user_has_bill_write_access(bill_id, auth.uid()));

-- public.bill_item_splits
DROP POLICY IF EXISTS "Read access for applicable users" ON public.bill_item_splits;
CREATE POLICY "Read access for applicable users"
  ON public.bill_item_splits
  FOR SELECT
  TO authenticated
  USING (check_user_has_bill_read_access(bill_id, auth.uid()));

DROP POLICY IF EXISTS "Read/write access for applicable users" ON public.bill_item_splits;
CREATE POLICY "Read/write access for applicable users"
  ON public.bill_item_splits
  FOR ALL
  TO authenticated
  USING (check_user_has_bill_write_access(bill_id, auth.uid()));

-- public.bill_items
DROP POLICY IF EXISTS "Read access for applicable users" ON public.bill_items;
CREATE POLICY "Read access for applicable users"
  ON public.bill_items
  FOR SELECT
  TO authenticated
  USING (check_user_has_bill_read_access(bill_id, auth.uid()));

DROP POLICY IF EXISTS "Read/write access for applicable users" ON public.bill_items;
CREATE POLICY "Read/write access for applicable users"
  ON public.bill_items
  FOR ALL
  TO authenticated
  USING (check_user_has_bill_write_access(bill_id, auth.uid()));

-- public.bill_users
DROP POLICY IF EXISTS "Read access for applicable users" ON public.bill_users;
CREATE POLICY "Read access for applicable users"
  ON public.bill_users
  FOR SELECT
  TO authenticated
  USING (check_user_has_bill_read_access(bill_id, auth.uid()));

DROP POLICY IF EXISTS "Read/write access for applicable users" ON public.bill_users;
CREATE POLICY "Read/write access for applicable users"
  ON public.bill_users
  FOR ALL
  TO authenticated
  USING (check_user_has_bill_write_access(bill_id, auth.uid()));

-- public.bills
DROP POLICY IF EXISTS "Read access for applicable users" ON public.bills;
CREATE POLICY "Read access for applicable users"
  ON public.bills
  FOR SELECT
  TO authenticated
  USING (check_user_has_bill_read_access(id, auth.uid()));

DROP POLICY IF EXISTS "Read/write access for applicable users" ON public.bills;
CREATE POLICY "Read/write access for applicable users"
  ON public.bills
  FOR ALL
  TO authenticated
  USING (check_user_has_bill_write_access(id, auth.uid()));

-- public.users
DROP POLICY IF EXISTS "Enable users read/write access to their own data only" ON public.users;
CREATE POLICY "Enable users read/write access to their own data only"
  ON public.users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id);
