-- Refactor create_full_bill to handle User Creation
-- Ensures user record exists before creating a bill to satisfy FK constraints.
-- Optimized to fetch owner defaults in the same upsert operation.

CREATE OR REPLACE FUNCTION "public"."create_full_bill"("p_bill_data" "jsonb", "p_owner_uuid" "uuid") RETURNS TABLE("out_id" "uuid")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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
    -- Ensure user record exists before creating bill (FK constraint)
    -- and Fetch owner defaults in one go using UPSERT + RETURNING
    INSERT INTO users (id)
    VALUES (p_owner_uuid)
    ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id -- No-op update to ensure RETURNING works even if row exists
    RETURNING default_payment_id, default_payment_method
    INTO v_owner_payment_id, v_owner_payment_method;

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
