-- Refactor create_full_bill to use Client-Generated IDs
-- Removes internal ID mapping and directly uses UUIDs provided by the client.
-- Preserves user upsert and default payment retrieval optimization.

CREATE OR REPLACE FUNCTION "public"."create_full_bill"("p_bill_data" "jsonb", "p_owner_uuid" "uuid") RETURNS TABLE("out_id" "uuid")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_new_bill_id uuid;
    
    -- inputs
    v_contrib_input jsonb;
    v_item_input jsonb;
    v_split_input jsonb;

    -- owner defaults
    v_owner_payment_id text;
    v_owner_payment_method public.payment_method;
BEGIN
    -- Ensure user record exists before creating bill (FK constraint)
    -- and Fetch owner defaults in one go using UPSERT + RETURNING
    INSERT INTO users (id)
    VALUES (p_owner_uuid)
    ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
    RETURNING default_payment_id, default_payment_method
    INTO v_owner_payment_id, v_owner_payment_method;

    -- Basic validation of incoming JSON structure
    IF p_bill_data IS NULL THEN
        RAISE EXCEPTION 'Invalid bill data: payload is null';
    END IF;

    IF (p_bill_data->>'id') IS NULL THEN
        RAISE EXCEPTION 'Invalid bill data: missing "id"';
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
    INSERT INTO bills (id, name, invite_id, invite_required)
    VALUES (
        (p_bill_data->>'id')::uuid,
        p_bill_data->>'name',
        COALESCE((p_bill_data->>'invite_id')::uuid, gen_random_uuid()),
        COALESCE((p_bill_data->>'invite_required')::boolean, FALSE)
    )
    RETURNING bills.id INTO v_new_bill_id;

    -- Link owner as 'owner' with profile defaults
    INSERT INTO bill_users (bill_id, user_id, authority, payment_id, payment_method)
    VALUES (v_new_bill_id, p_owner_uuid, 'owner', v_owner_payment_id, v_owner_payment_method);

    -- Insert contributors
    FOR v_contrib_input IN SELECT * FROM jsonb_array_elements(p_bill_data->'bill_contributors')
    LOOP
        IF (v_contrib_input->>'id') IS NULL THEN
            RAISE EXCEPTION 'Invalid contributor: missing "id"';
        END IF;

        INSERT INTO bill_contributors (id, bill_id, name, sort)
        VALUES (
            (v_contrib_input->>'id')::uuid,
            v_new_bill_id,
            COALESCE(v_contrib_input->>'name', ''),
            COALESCE((v_contrib_input->>'sort')::integer, 0)
        )
        ON CONFLICT (id, bill_id) DO NOTHING;
    END LOOP;

    -- Insert items and splits
    FOR v_item_input IN SELECT * FROM jsonb_array_elements(p_bill_data->'bill_items')
    LOOP
        IF (v_item_input->>'id') IS NULL THEN
            RAISE EXCEPTION 'Invalid item: missing "id"';
        END IF;

        INSERT INTO bill_items (id, bill_id, name, cost, contributor_id, sort)
        VALUES (
            (v_item_input->>'id')::uuid,
            v_new_bill_id,
            v_item_input->>'name',
            (v_item_input->>'cost')::numeric,
            (v_item_input->>'contributor_id')::uuid,
            COALESCE((v_item_input->>'sort')::integer, 0)
        )
        ON CONFLICT (id) DO NOTHING;

        -- splits
        FOR v_split_input IN SELECT * FROM jsonb_array_elements(v_item_input->'bill_item_splits')
        LOOP
            IF (v_split_input->>'id') IS NULL THEN
                RAISE EXCEPTION 'Invalid split: missing "id"';
            END IF;

            INSERT INTO bill_item_splits (id, bill_id, item_id, contributor_id, ratio)
            VALUES (
                (v_split_input->>'id')::uuid,
                v_new_bill_id,
                (v_item_input->>'id')::uuid,
                (v_split_input->>'contributor_id')::uuid,
                (v_split_input->>'ratio')::numeric
            )
            ON CONFLICT (id) DO NOTHING;
        END LOOP;
    END LOOP;

    -- Return only the new bill id
    RETURN QUERY SELECT v_new_bill_id AS out_id;
    RETURN;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to create bill: %', SQLERRM;
END;
$$;

-- Rename add_bill_contributor to create_bill_contributor
CREATE OR REPLACE FUNCTION "public"."create_bill_contributor"("p_contributor" "jsonb", "p_splits" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Insert contributor
  INSERT INTO bill_contributors (id, bill_id, name, sort)
  VALUES (
    (p_contributor->>'id')::uuid,
    (p_contributor->>'bill_id')::uuid,
    p_contributor->>'name',
    (p_contributor->>'sort')::integer
  )
  ON CONFLICT (id, bill_id) DO NOTHING;

  -- Insert splits
  INSERT INTO bill_item_splits (id, bill_id, item_id, contributor_id, ratio)
  SELECT
    (value->>'id')::uuid,
    (value->>'bill_id')::uuid,
    (value->>'item_id')::uuid,
    (value->>'contributor_id')::uuid,
    (value->>'ratio')::numeric
  FROM jsonb_array_elements(p_splits)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

DROP FUNCTION IF EXISTS "public"."add_bill_contributor"("jsonb", "jsonb");

-- Rename add_bill_item to create_bill_item
CREATE OR REPLACE FUNCTION "public"."create_bill_item"("p_item" "jsonb", "p_splits" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert splits
  INSERT INTO bill_item_splits (id, bill_id, item_id, contributor_id, ratio)
  SELECT
    (value->>'id')::uuid,
    (value->>'bill_id')::uuid,
    (value->>'item_id')::uuid,
    (value->>'contributor_id')::uuid,
    (value->>'ratio')::numeric
  FROM jsonb_array_elements(p_splits)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

DROP FUNCTION IF EXISTS "public"."add_bill_item"("jsonb", "jsonb");

-- Fix ordered_bill_splits view to prevent duplicate rows when joining contributors across bills
CREATE OR REPLACE VIEW "public"."ordered_bill_splits" WITH ("security_invoker"='true') AS
 SELECT "bis"."id",
    "bis"."ratio",
    "bis"."item_id",
    "bis"."contributor_id",
    "bi"."name" AS "item_name",
    "bc"."name" AS "contributor_name",
    "bi"."sort" AS "item_sort_order",
    "bc"."sort" AS "contributor_sort_order"
   FROM (("public"."bill_item_splits" "bis"
     JOIN "public"."bill_items" "bi" ON (("bis"."item_id" = "bi"."id")))
     JOIN "public"."bill_contributors" "bc" ON (("bc"."id" = "bis"."contributor_id" AND "bc"."bill_id" = "bis"."bill_id")));
