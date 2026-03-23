-- 1. Unified Signatures & Ownership Fix for sync_delete_bill
CREATE OR REPLACE FUNCTION "public"."sync_delete_bill"(
  "p_mutation_id" uuid, 
  "p_user_id" uuid, 
  "p_created_at" timestamptz, 
  "p_bill_id" uuid, 
  "p_payload" jsonb DEFAULT '{}'::jsonb
) RETURNS void
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_member_ids uuid[];
  v_is_owner boolean;
BEGIN
  -- 1. Check if user is an owner
  SELECT EXISTS (
    SELECT 1 FROM bill_users 
    WHERE bill_id = p_bill_id 
    AND user_id = p_user_id 
    AND authority = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can delete bills';
  END IF;

  -- 2. Capture member snapshot for tombstone propagation
  SELECT array_agg(user_id) INTO v_member_ids
  FROM bill_users
  WHERE bill_id = p_bill_id;

  -- 3. Log mutation with snapshot
  IF NOT log_mutation_execution(
    p_mutation_id, 
    p_bill_id, 
    p_user_id, 
    'DELETE_BILL', 
    jsonb_build_object('member_ids', v_member_ids), 
    p_created_at
  ) THEN
    RETURN; -- Already processed
  END IF;

  -- 4. Hard Delete
  DELETE FROM bills WHERE id = p_bill_id;
END;
$$;

-- 2. Update RLS for mutation_logs to support snapshot-based visibility
-- This allows users to see deletions for bills they WERE members of.
DROP POLICY IF EXISTS "Users can view mutation logs for bills they belong to" ON "public"."mutation_logs";

CREATE POLICY "Users can view mutation logs for bills they belong to" ON "public"."mutation_logs"
FOR SELECT USING (
  -- Option A: Bill still exists and user is a member
  EXISTS (
    SELECT 1 FROM "public"."bill_users"
    WHERE "bill_users"."bill_id" = "mutation_logs"."entity_id"
    AND "bill_users"."user_id" = "auth"."uid"()
  )
  OR 
  -- Option B: User is the one who performed the mutation
  "user_id" = "auth"."uid"()
  OR
  -- Option C: User was in the member snapshot (for deletions)
  (
    "payload"->'member_ids' @> jsonb_build_array("auth"."uid"()::text)
  )
);

-- 3. Robust sync_leave_bill with consistent signature
CREATE OR REPLACE FUNCTION "public"."sync_leave_bill"(
  "p_mutation_id" uuid, 
  "p_user_id" uuid, 
  "p_created_at" timestamptz, 
  "p_bill_id" uuid, 
  "p_payload" jsonb DEFAULT '{}'::jsonb
) RETURNS void
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT log_mutation_execution(p_mutation_id, p_bill_id, p_user_id, 'LEAVE_BILL', p_payload, p_created_at) THEN
    RETURN;
  END IF;

  DELETE FROM bill_users WHERE bill_id = p_bill_id AND user_id = p_user_id;
END;
$$;

-- 4. Ensure ALL sync_ functions have consistent signatures (adding p_payload where missing or fixing params)
-- sync_create_bill already has it (as p_bill_data, but let's rename for consistency)
CREATE OR REPLACE FUNCTION "public"."sync_create_bill"(
  "p_mutation_id" uuid, 
  "p_user_id" uuid, 
  "p_created_at" timestamptz, 
  "p_bill_id" uuid, -- This will be the ID from p_payload.bill.id
  "p_payload" jsonb
) RETURNS void
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_new_bill_id uuid;
    v_bill_data jsonb;
    v_contrib_input jsonb;
    v_item_input jsonb;
    v_split_input jsonb;
    v_owner_payment_id text;
    v_owner_payment_method public.payment_method;
BEGIN
  v_bill_data := p_payload->'bill';
  
  IF NOT log_mutation_execution(p_mutation_id, (v_bill_data->>'id')::uuid, p_user_id, 'CREATE_BILL', p_payload, p_created_at) THEN
    RETURN;
  END IF;

  -- Ensure user record exists and Fetch owner defaults
  INSERT INTO users (id)
  VALUES (p_user_id)
  ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
  RETURNING default_payment_id, default_payment_method
  INTO v_owner_payment_id, v_owner_payment_method;

  -- Insert into bills table
  INSERT INTO bills (id, name, invite_id, invite_required, updated_at)
  VALUES (
      (v_bill_data->>'id')::uuid,
      v_bill_data->>'name',
      COALESCE((v_bill_data->>'invite_id')::uuid, gen_random_uuid()),
      COALESCE((v_bill_data->>'invite_required')::boolean, FALSE),
      p_created_at
  )
  RETURNING bills.id INTO v_new_bill_id;

  -- Link owner as 'owner'
  INSERT INTO bill_users (bill_id, user_id, authority, payment_id, payment_method, updated_at)
  VALUES (v_new_bill_id, p_user_id, 'owner', v_owner_payment_id, v_owner_payment_method, p_created_at)
  ON CONFLICT (bill_id, user_id) DO NOTHING;

  -- Insert contributors
  FOR v_contrib_input IN SELECT * FROM jsonb_array_elements(v_bill_data->'bill_contributors')
  LOOP
      INSERT INTO bill_contributors (id, bill_id, name, sort, updated_at)
      VALUES (
          (v_contrib_input->>'id')::uuid,
          v_new_bill_id,
          COALESCE(v_contrib_input->>'name', ''),
          COALESCE((v_contrib_input->>'sort')::numeric, 0),
          p_created_at
      )
      ON CONFLICT (id, bill_id) DO NOTHING;
  END LOOP;

  -- Insert items and splits
  FOR v_item_input IN SELECT * FROM jsonb_array_elements(v_bill_data->'bill_items')
  LOOP
      INSERT INTO bill_items (id, bill_id, name, cost, contributor_id, sort, updated_at)
      VALUES (
          (v_item_input->>'id')::uuid,
          v_new_bill_id,
          v_item_input->>'name',
          (v_item_input->>'cost')::numeric,
          (v_item_input->>'contributor_id')::uuid,
          COALESCE((v_item_input->>'sort')::numeric, 0),
          p_created_at
      )
      ON CONFLICT (id) DO NOTHING;

      FOR v_split_input IN SELECT * FROM jsonb_array_elements(v_item_input->'bill_item_splits')
      LOOP
          INSERT INTO bill_item_splits (id, bill_id, item_id, contributor_id, ratio, updated_at)
          VALUES (
              (v_split_input->>'id')::uuid,
              v_new_bill_id,
              (v_item_input->>'id')::uuid,
              (v_split_input->>'contributor_id')::uuid,
              (v_split_input->>'ratio')::numeric,
              p_created_at
          )
          ON CONFLICT (id) DO NOTHING;
      END LOOP;
  END LOOP;
END;
$$;

-- 5. Rename/Update sync_update_user signature for consistency
CREATE OR REPLACE FUNCTION "public"."sync_update_user"(
  "p_mutation_id" uuid, 
  "p_user_id" uuid, 
  "p_created_at" timestamptz, 
  "p_bill_id" uuid, -- entity_id (user_id)
  "p_payload" jsonb
) RETURNS void
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_updated_at timestamptz;
BEGIN
  IF NOT log_mutation_execution(p_mutation_id, p_bill_id, p_user_id, 'UPDATE_USER', p_payload, p_created_at) THEN
    RETURN;
  END IF;

  SELECT updated_at INTO v_updated_at FROM users WHERE id = p_bill_id;
  IF v_updated_at IS NULL OR p_created_at > v_updated_at THEN
    UPDATE users
    SET
      default_invite_required = COALESCE((p_payload->>'default_invite_required')::boolean, default_invite_required),
      default_payment_id = COALESCE(p_payload->>'default_payment_id', default_payment_id),
      default_payment_method = COALESCE((p_payload->>'default_payment_method')::payment_method, default_payment_method),
      updated_at = p_created_at
    WHERE id = p_bill_id;
  END IF;
END;
$$;
