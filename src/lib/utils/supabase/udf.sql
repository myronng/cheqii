-- Clean up existing functions to prevent overloading conflicts (PGRST203)
DROP FUNCTION IF EXISTS create_full_bill(jsonb, uuid);
DROP FUNCTION IF EXISTS get_full_bill(uuid);
DROP FUNCTION IF EXISTS add_bill_item(jsonb, jsonb);
DROP FUNCTION IF EXISTS add_bill_contributor(jsonb, jsonb);
DROP FUNCTION IF EXISTS delete_bill_item(uuid);
DROP FUNCTION IF EXISTS delete_bill_contributor(uuid, uuid);
DROP FUNCTION IF EXISTS link_contributor_account(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS update_user_payment_method(uuid, uuid, payment_method);
DROP FUNCTION IF EXISTS update_user_payment_id(uuid, uuid, text);

-- 1. create_full_bill
CREATE OR REPLACE FUNCTION create_full_bill(p_bill_data jsonb, p_owner_uuid uuid)
RETURNS TABLE(out_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_new_bill_id uuid;
    v_new_invite_id uuid;
    v_new_invite_required boolean;
    v_new_name text;
    v_new_updated_at timestamptz;

    -- inputs
    v_contrib_input jsonb;
    v_item_input jsonb;
    v_split_input jsonb;

    -- db ids
    v_db_contributor_id uuid;
    v_db_item_id uuid;

    -- mapping from client contributor id -> db contributor id
    v_contributor_id_map jsonb DEFAULT '{}';

    -- owner defaults
    v_owner_payment_id text;
    v_owner_payment_method public.payment_method;
BEGIN
    -- Basic validation of incoming JSON structure
    IF p_bill_data IS NULL THEN
        RAISE EXCEPTION 'Invalid bill data: payload is null';
    END IF;

    IF (p_bill_data->>'name') IS NULL OR trim(p_bill_data->>'name') = '' THEN
        RAISE EXCEPTION 'Invalid bill data: missing or empty "name"';
    END IF;

    IF jsonb_typeof(p_bill_data->'bill_contributors') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Invalid bill data: "bill_contributors" must be a JSON array';
    END IF;

    IF jsonb_typeof(p_bill_data->'bill_items') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Invalid bill data: "bill_items" must be a JSON array';
    END IF;

    -- Insert into bills table
    INSERT INTO bills (name, invite_id, invite_required)
    VALUES (
        p_bill_data->>'name',
        COALESCE((p_bill_data->>'invite_id')::uuid, gen_random_uuid()),
        COALESCE((p_bill_data->>'invite_required')::boolean, FALSE)
    )
    RETURNING bills.id, bills.invite_id, bills.invite_required, bills.name, bills.updated_at
    INTO v_new_bill_id, v_new_invite_id, v_new_invite_required, v_new_name, v_new_updated_at;

    -- Fetch owner defaults
    SELECT default_payment_id, default_payment_method 
    INTO v_owner_payment_id, v_owner_payment_method
    FROM users
    WHERE id = p_owner_uuid;

    -- Link owner as 'owner' with profile defaults
    INSERT INTO bill_users (bill_id, user_id, authority, payment_id, payment_method)
    VALUES (v_new_bill_id, p_owner_uuid, 'owner', v_owner_payment_id, v_owner_payment_method);

    -- Insert contributors and build mapping
    FOR v_contrib_input IN SELECT * FROM jsonb_array_elements(p_bill_data->'bill_contributors')
    LOOP
        -- require each contributor to have a client-side id (string) to map
        IF (v_contrib_input->>'id') IS NULL THEN
            RAISE EXCEPTION 'Invalid contributor: missing "id" for contributor %', v_contrib_input;
        END IF;

        INSERT INTO bill_contributors (bill_id, name, sort)
        VALUES (
            v_new_bill_id,
            COALESCE(v_contrib_input->>'name', ''),
            COALESCE((v_contrib_input->>'sort')::integer, 0)
        )
        RETURNING id INTO v_db_contributor_id;

        -- store mapping from client id -> db id
        v_contributor_id_map := jsonb_set(v_contributor_id_map, ARRAY[v_contrib_input->>'id'], to_jsonb(v_db_contributor_id), TRUE);
    END LOOP;

    -- Insert items and splits with validation
    FOR v_item_input IN SELECT * FROM jsonb_array_elements(p_bill_data->'bill_items')
    LOOP
        -- validate item required fields
        IF (v_item_input->>'name') IS NULL THEN
            RAISE EXCEPTION 'Invalid item: missing "name" in item %', v_item_input;
        END IF;
        IF (v_item_input->>'cost') IS NULL THEN
            RAISE EXCEPTION 'Invalid item: missing "cost" in item %', v_item_input;
        END IF;
        IF jsonb_typeof(v_item_input->'bill_item_splits') IS DISTINCT FROM 'array' THEN
            RAISE EXCEPTION 'Invalid item: "bill_item_splits" must be an array in item %', v_item_input;
        END IF;

        -- determine buyer db id (required)
        DECLARE
            v_item_buyer_db_id uuid;
        BEGIN
            IF (v_item_input->>'contributor_id') IS NULL THEN
                RAISE EXCEPTION 'Invalid item: missing "contributor_id" in item %', v_item_input;
            END IF;

            IF (v_contributor_id_map->>(v_item_input->>'contributor_id')) IS NULL THEN
                RAISE EXCEPTION 'Invalid item buyer: contributor_id % not found in mapping', v_item_input->>'contributor_id';
            END IF;
            
            v_item_buyer_db_id := (v_contributor_id_map->>(v_item_input->>'contributor_id'))::uuid;

            INSERT INTO bill_items (bill_id, name, cost, contributor_id, sort)
            VALUES (
                v_new_bill_id,
                v_item_input->>'name',
                (v_item_input->>'cost')::numeric,
                v_item_buyer_db_id,
                COALESCE((v_item_input->>'sort')::integer, 0)
            )
            RETURNING id INTO v_db_item_id;

            -- splits
            FOR v_split_input IN SELECT * FROM jsonb_array_elements(v_item_input->'bill_item_splits')
            LOOP
                IF (v_split_input->>'contributor_id') IS NULL THEN
                    RAISE EXCEPTION 'Invalid split: missing "contributor_id" in split % for item %', v_split_input, v_item_input;
                END IF;
                IF (v_split_input->>'ratio') IS NULL THEN
                    RAISE EXCEPTION 'Invalid split: missing "ratio" in split % for item %', v_split_input, v_item_input;
                END IF;

                IF (v_contributor_id_map->>(v_split_input->>'contributor_id')) IS NULL THEN
                    RAISE EXCEPTION 'Invalid split contributor: contributor_id % not found in mapping', v_split_input->>'contributor_id';
                END IF;

                INSERT INTO bill_item_splits (bill_id, item_id, contributor_id, ratio)
                VALUES (
                    v_new_bill_id,
                    v_db_item_id,
                    (v_contributor_id_map->>(v_split_input->>'contributor_id'))::uuid,
                    (v_split_input->>'ratio')::numeric
                );
            END LOOP;
        END;
    END LOOP;

    -- Return only the new bill id
    RETURN QUERY SELECT v_new_bill_id AS out_id;
    RETURN;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to create bill: %', SQLERRM;
END;
$$;

-- 2. get_full_bill
CREATE OR REPLACE FUNCTION get_full_bill(p_bill_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_bill_record record;
    v_contributors jsonb;
    v_users jsonb;
    v_items jsonb;
BEGIN
    -- 1. Get the core bill record
    SELECT * INTO v_bill_record FROM bills WHERE id = p_bill_id;
    
    IF v_bill_record IS NULL THEN
        RETURN NULL;
    END IF;

    -- 2. Get contributors (The column headers for your UI)
    SELECT jsonb_agg(to_jsonb(c.*))
    INTO v_contributors
    FROM (
        SELECT * FROM bill_contributors 
        WHERE bill_id = p_bill_id 
        ORDER BY sort ASC
    ) c;

    -- 3. Get users associated with the bill
    SELECT jsonb_agg(to_jsonb(u.*))
    INTO v_users
    FROM (
        SELECT * FROM bill_users 
        WHERE bill_id = p_bill_id
    ) u;

    -- 4. Get items with their splits using the View
    SELECT jsonb_agg(item_data)
    INTO v_items
    FROM (
        SELECT 
            to_jsonb(i.*) || jsonb_build_object('bill_item_splits', COALESCE(s.splits, '[]'::jsonb)) as item_data
        FROM bill_items i
        LEFT JOIN LATERAL (
            SELECT jsonb_agg(to_jsonb(v.*) ORDER BY v.contributor_sort_order ASC) as splits
            FROM ordered_bill_splits v
            WHERE v.item_id = i.id
        ) s ON true
        WHERE i.bill_id = p_bill_id 
        ORDER BY i.sort ASC
    ) i;

    -- 5. Build and return the final JSON structure
    RETURN to_jsonb(v_bill_record) || jsonb_build_object(
        'bill_contributors', COALESCE(v_contributors, '[]'::jsonb),
        'bill_users', COALESCE(v_users, '[]'::jsonb),
        'bill_items', COALESCE(v_items, '[]'::jsonb)
    );
END;
$$;

-- 3. link_contributor_account
CREATE OR REPLACE FUNCTION link_contributor_account(
  p_bill_id uuid,
  p_old_contributor_id uuid,
  p_new_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- 1. Update the contributor record to allow FK references
  UPDATE bill_contributors
  SET id = p_new_user_id
  WHERE bill_id = p_bill_id
    AND id = p_old_contributor_id;

  -- 2. Update items bought by the old ID
  UPDATE bill_items
  SET contributor_id = p_new_user_id
  WHERE bill_id = p_bill_id 
    AND contributor_id = p_old_contributor_id;

  -- 3. Update splits assigned to the old ID
  UPDATE bill_item_splits
  SET contributor_id = p_new_user_id
  WHERE bill_id = p_bill_id
    AND contributor_id = p_old_contributor_id;
END;
$$;

-- 4. add_bill_item
CREATE OR REPLACE FUNCTION add_bill_item(
  p_item jsonb,
  p_splits jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Insert item
  INSERT INTO bill_items (id, bill_id, contributor_id, name, cost, sort)
  VALUES (
    (p_item->>'id')::uuid,
    (p_item->>'bill_id')::uuid,
    (p_item->>'contributor_id')::uuid,
    p_item->>'name',
    (p_item->>'cost')::numeric,
    (p_item->>'sort')::integer
  );

  -- Insert splits
  INSERT INTO bill_item_splits (id, bill_id, item_id, contributor_id, ratio)
  SELECT
    (value->>'id')::uuid,
    (value->>'bill_id')::uuid,
    (value->>'item_id')::uuid,
    (value->>'contributor_id')::uuid,
    (value->>'ratio')::numeric
  FROM jsonb_array_elements(p_splits);
END;
$$;

-- 5. add_bill_contributor
CREATE OR REPLACE FUNCTION add_bill_contributor(
  p_contributor jsonb,
  p_splits jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Insert contributor
  INSERT INTO bill_contributors (id, bill_id, name, sort)
  VALUES (
    (p_contributor->>'id')::uuid,
    (p_contributor->>'bill_id')::uuid,
    p_contributor->>'name',
    (p_contributor->>'sort')::integer
  );

  -- Insert splits
  INSERT INTO bill_item_splits (id, bill_id, item_id, contributor_id, ratio)
  SELECT
    (value->>'id')::uuid,
    (value->>'bill_id')::uuid,
    (value->>'item_id')::uuid,
    (value->>'contributor_id')::uuid,
    (value->>'ratio')::numeric
  FROM jsonb_array_elements(p_splits);
END;
$$;

-- 6. delete_bill_item
CREATE OR REPLACE FUNCTION delete_bill_item(
  p_item_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Delete splits for this item
  DELETE FROM bill_item_splits
  WHERE item_id = p_item_id;

  -- Delete the item
  DELETE FROM bill_items
  WHERE id = p_item_id;
END;
$$;

-- 7. delete_bill_contributor
CREATE OR REPLACE FUNCTION delete_bill_contributor(
  p_contributor_id uuid,
  p_reassign_to_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Reassign items bought by this contributor
  UPDATE bill_items
  SET contributor_id = p_reassign_to_id
  WHERE contributor_id = p_contributor_id;

  -- Delete splits for this contributor
  DELETE FROM bill_item_splits
  WHERE contributor_id = p_contributor_id;

  -- Delete the contributor
  DELETE FROM bill_contributors
  WHERE id = p_contributor_id;
END;
$$;

-- 8. update_user_payment_method
CREATE OR REPLACE FUNCTION update_user_payment_method(
  p_bill_id uuid,
  p_user_id uuid,
  p_payment_method payment_method
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- 1. Update the payment method for this specific bill
  UPDATE bill_users
  SET payment_method = p_payment_method
  WHERE bill_id = p_bill_id AND user_id = p_user_id;

  -- 2. Update the user's default payment method in their profile
  UPDATE users
  SET default_payment_method = p_payment_method
  WHERE id = p_user_id;
END;
$$;

-- 9. update_user_payment_id
CREATE OR REPLACE FUNCTION update_user_payment_id(
  p_bill_id uuid,
  p_user_id uuid,
  p_payment_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- 1. Update the payment ID for this specific bill
  UPDATE bill_users
  SET payment_id = p_payment_id
  WHERE bill_id = p_bill_id AND user_id = p_user_id;

  -- 2. Update the user's default payment ID in their profile
  UPDATE users
  SET default_payment_id = p_payment_id
  WHERE id = p_user_id;
END;
$$;
