CREATE OR REPLACE FUNCTION join_bill_via_invite(
  p_bill_id uuid,
  p_invite_id uuid,
  p_user_id uuid
) RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill bills%ROWTYPE;
  v_user_payment_id text;
  v_user_payment_method payment_method;
  v_current_authority bill_authority;
BEGIN
  -- 1. Fetch Bill (Bypass RLS)
  SELECT * INTO v_bill FROM bills WHERE id = p_bill_id;
  
  IF v_bill IS NULL THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;

  -- 2. Validate Invite
  -- Strict check: Invite ID must match, regardless of public/private status
  -- This ensures the user actually has the link.
  IF v_bill.invite_id IS DISTINCT FROM p_invite_id THEN
     RAISE EXCEPTION 'Invalid invite token';
  END IF;
  
  -- 3. Check existing membership
  SELECT authority INTO v_current_authority 
  FROM bill_users 
  WHERE bill_id = p_bill_id AND user_id = p_user_id;
  
  -- If already a full member (owner or invited), we are done.
  -- If they were 'public' (from a previous public join), we upgrade them to 'invited' below.
  IF v_current_authority IS NOT NULL AND v_current_authority != 'public' THEN
    RETURN;
  END IF;
  
  -- 4. Get User Defaults
  SELECT default_payment_id, default_payment_method 
  INTO v_user_payment_id, v_user_payment_method
  FROM users WHERE id = p_user_id;

  -- 5. Insert/Update Member
  INSERT INTO bill_users (bill_id, user_id, authority, payment_id, payment_method)
  VALUES (p_bill_id, p_user_id, 'invited', v_user_payment_id, v_user_payment_method)
  ON CONFLICT (bill_id, user_id) DO UPDATE SET
    authority = 'invited', -- Upgrade to invited
    updated_at = now();
    
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION join_bill_via_invite(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION join_bill_via_invite(uuid, uuid, uuid) TO service_role;
