


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."bill_authority" AS ENUM (
    'owner',
    'invited',
    'public'
);


ALTER TYPE "public"."bill_authority" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'etransfer',
    'payPal'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_bill_contributor"("p_contributor" "jsonb", "p_splits" "jsonb") RETURNS "void"
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


ALTER FUNCTION "public"."add_bill_contributor"("p_contributor" "jsonb", "p_splits" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_bill_item"("p_item" "jsonb", "p_splits" "jsonb") RETURNS "void"
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


ALTER FUNCTION "public"."add_bill_item"("p_item" "jsonb", "p_splits" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_bill_allows_any_access"("p_bill_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."check_bill_allows_any_access"("p_bill_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_has_bill_read_access"("p_bill_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN (
    -- User is an owner, invited user, or public user for this bill
    (
      (
        SELECT count(1)
        FROM bill_users -- Renamed from cheque_users
        WHERE bill_users.authority IN ('owner', 'invited', 'public')
          AND bill_users.user_id = p_user_id
          AND bill_users.bill_id = p_bill_id -- Renamed from cheque_id
      ) > 0
    )
    OR
    -- The bill itself allows any access (e.g., no invite required, or no owner yet)
    check_bill_allows_any_access(p_bill_id, p_user_id) -- Calling the (now correctly defined) helper function
  );
END;
$$;


ALTER FUNCTION "public"."check_user_has_bill_read_access"("p_bill_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_has_bill_write_access"("p_bill_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN (
    -- User is an owner or an invited user for this bill
    (
      (
        SELECT count(1)
        FROM bill_users
        WHERE bill_users.authority IN ('owner', 'invited') -- Excludes 'public' compared to read access
          AND bill_users.user_id = p_user_id
          AND bill_users.bill_id = p_bill_id
      ) > 0
    )
    OR
    -- The bill itself allows any access (e.g., no invite required, or no owner yet)
    check_bill_allows_any_access(p_bill_id, p_user_id) -- Calling the helper function
  );
END;
$$;


ALTER FUNCTION "public"."check_user_has_bill_write_access"("p_bill_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."create_full_bill"("p_bill_data" "jsonb", "p_owner_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_bill_contributor"("p_contributor_id" "uuid", "p_reassign_to_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."delete_bill_contributor"("p_contributor_id" "uuid", "p_reassign_to_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_bill_item"("p_item_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."delete_bill_item"("p_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_full_bill"("p_bill_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_full_bill"("p_bill_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_contributor_account"("p_bill_id" "uuid", "p_old_contributor_id" "uuid", "p_new_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."link_contributor_account"("p_bill_id" "uuid", "p_old_contributor_id" "uuid", "p_new_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_payment_id"("p_bill_id" "uuid", "p_user_id" "uuid", "p_payment_id" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_user_payment_id"("p_bill_id" "uuid", "p_user_id" "uuid", "p_payment_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_payment_method"("p_bill_id" "uuid", "p_user_id" "uuid", "p_payment_method" "public"."payment_method") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_user_payment_method"("p_bill_id" "uuid", "p_user_id" "uuid", "p_payment_method" "public"."payment_method") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bill_contributors" (
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "sort" numeric DEFAULT '0'::numeric NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bill_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."bill_contributors" OWNER TO "postgres";


COMMENT ON TABLE "public"."bill_contributors" IS 'Contributors (columns) listed within a bill';



CREATE TABLE IF NOT EXISTS "public"."bill_item_splits" (
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bill_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contributor_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ratio" numeric DEFAULT '0'::numeric NOT NULL
);


ALTER TABLE "public"."bill_item_splits" OWNER TO "postgres";


COMMENT ON TABLE "public"."bill_item_splits" IS 'Splits (row columns) listed within an item';



CREATE TABLE IF NOT EXISTS "public"."bill_items" (
    "contributor_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "cost" numeric DEFAULT '0'::numeric NOT NULL,
    "sort" numeric NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bill_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."bill_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."bill_items" IS 'Items (rows) listed within a bill';



CREATE TABLE IF NOT EXISTS "public"."bill_users" (
    "user_id" "uuid" NOT NULL,
    "authority" "public"."bill_authority" DEFAULT 'public'::"public"."bill_authority" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bill_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "text",
    "payment_method" "public"."payment_method" DEFAULT 'etransfer'::"public"."payment_method"
);


ALTER TABLE "public"."bill_users" OWNER TO "postgres";


COMMENT ON TABLE "public"."bill_users" IS 'Users that have access to a given bills.id';



CREATE TABLE IF NOT EXISTS "public"."bills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invite_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invite_required" boolean DEFAULT false NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bills" OWNER TO "postgres";


COMMENT ON TABLE "public"."bills" IS 'Header table for all bill data';



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
     JOIN "public"."bill_contributors" "bc" ON (("bc"."id" = "bis"."contributor_id")));


ALTER VIEW "public"."ordered_bill_splits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "default_invite_required" boolean DEFAULT false NOT NULL,
    "default_payment_id" "text",
    "default_payment_method" "public"."payment_method" DEFAULT 'etransfer'::"public"."payment_method" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'Application specific data for users';



ALTER TABLE ONLY "public"."bill_contributors"
    ADD CONSTRAINT "bill_contributors_pkey" PRIMARY KEY ("bill_id", "id");



ALTER TABLE ONLY "public"."bill_item_splits"
    ADD CONSTRAINT "bill_item_splits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bill_items"
    ADD CONSTRAINT "bill_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bill_users"
    ADD CONSTRAINT "bill_users_pkey" PRIMARY KEY ("user_id", "bill_id");



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."bill_contributors" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."bill_item_splits" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."bill_items" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."bill_users" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."bills" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



ALTER TABLE ONLY "public"."bill_contributors"
    ADD CONSTRAINT "bill_contributors_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bill_item_splits"
    ADD CONSTRAINT "bill_item_splits_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bill_item_splits"
    ADD CONSTRAINT "bill_item_splits_contributor_id_bill_id_fkey" FOREIGN KEY ("contributor_id", "bill_id") REFERENCES "public"."bill_contributors"("id", "bill_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bill_item_splits"
    ADD CONSTRAINT "bill_item_splits_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."bill_items"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bill_items"
    ADD CONSTRAINT "bill_items_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bill_items"
    ADD CONSTRAINT "bill_items_contributor_id_bill_id_fkey" FOREIGN KEY ("contributor_id", "bill_id") REFERENCES "public"."bill_contributors"("id", "bill_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bill_users"
    ADD CONSTRAINT "bill_users_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bill_users"
    ADD CONSTRAINT "bill_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Enable users read/write access to their own data only" ON "public"."users" TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Read access for applicable users" ON "public"."bill_contributors" FOR SELECT TO "authenticated" USING ("public"."check_user_has_bill_read_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Read access for applicable users" ON "public"."bill_item_splits" FOR SELECT TO "authenticated" USING ("public"."check_user_has_bill_read_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Read access for applicable users" ON "public"."bill_items" FOR SELECT TO "authenticated" USING ("public"."check_user_has_bill_read_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Read access for applicable users" ON "public"."bill_users" FOR SELECT TO "authenticated" USING ("public"."check_user_has_bill_read_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Read access for applicable users" ON "public"."bills" FOR SELECT TO "authenticated" USING ("public"."check_user_has_bill_read_access"("id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Write access for applicable users (INSERT)" ON "public"."bill_contributors" FOR INSERT TO "authenticated" WITH CHECK ("public"."check_user_has_bill_write_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Write access for applicable users (UPDATE)" ON "public"."bill_contributors" FOR UPDATE TO "authenticated" USING ("public"."check_user_has_bill_write_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Write access for applicable users (DELETE)" ON "public"."bill_contributors" FOR DELETE TO "authenticated" USING ("public"."check_user_has_bill_write_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Write access for applicable users (INSERT)" ON "public"."bill_item_splits" FOR INSERT TO "authenticated" WITH CHECK ("public"."check_user_has_bill_write_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Write access for applicable users (UPDATE)" ON "public"."bill_item_splits" FOR UPDATE TO "authenticated" USING ("public"."check_user_has_bill_write_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Write access for applicable users (DELETE)" ON "public"."bill_item_splits" FOR DELETE TO "authenticated" USING ("public"."check_user_has_bill_write_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Write access for applicable users (INSERT)" ON "public"."bill_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."check_user_has_bill_write_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Write access for applicable users (UPDATE)" ON "public"."bill_items" FOR UPDATE TO "authenticated" USING ("public"."check_user_has_bill_write_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Write access for applicable users (DELETE)" ON "public"."bill_items" FOR DELETE TO "authenticated" USING ("public"."check_user_has_bill_write_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Write access for applicable users (INSERT)" ON "public"."bill_users" FOR INSERT TO "authenticated" WITH CHECK ("public"."check_user_has_bill_write_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Write access for applicable users (UPDATE)" ON "public"."bill_users" FOR UPDATE TO "authenticated" USING ("public"."check_user_has_bill_write_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Write access for applicable users (DELETE)" ON "public"."bill_users" FOR DELETE TO "authenticated" USING ("public"."check_user_has_bill_write_access"("bill_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Write access for applicable users (INSERT)" ON "public"."bills" FOR INSERT TO "authenticated" WITH CHECK ("public"."check_user_has_bill_write_access"("id", ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Write access for applicable users (UPDATE)" ON "public"."bills" FOR UPDATE TO "authenticated" USING ("public"."check_user_has_bill_write_access"("id", ( SELECT "auth"."uid"() AS "uid")));
CREATE POLICY "Write access for applicable users (DELETE)" ON "public"."bills" FOR DELETE TO "authenticated" USING ("public"."check_user_has_bill_write_access"("id", ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."bill_contributors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bill_item_splits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bill_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bill_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bill_contributors";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bill_item_splits";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bill_items";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bill_users";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bills";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



























































































































SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;

































SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;






GRANT ALL ON FUNCTION "public"."add_bill_contributor"("p_contributor" "jsonb", "p_splits" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_bill_contributor"("p_contributor" "jsonb", "p_splits" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_bill_contributor"("p_contributor" "jsonb", "p_splits" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_bill_item"("p_item" "jsonb", "p_splits" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_bill_item"("p_item" "jsonb", "p_splits" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_bill_item"("p_item" "jsonb", "p_splits" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_bill_allows_any_access"("p_bill_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_bill_allows_any_access"("p_bill_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_bill_allows_any_access"("p_bill_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_has_bill_read_access"("p_bill_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_has_bill_read_access"("p_bill_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_has_bill_read_access"("p_bill_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_has_bill_write_access"("p_bill_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_has_bill_write_access"("p_bill_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_has_bill_write_access"("p_bill_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_full_bill"("p_bill_data" "jsonb", "p_owner_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_full_bill"("p_bill_data" "jsonb", "p_owner_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_full_bill"("p_bill_data" "jsonb", "p_owner_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_bill_contributor"("p_contributor_id" "uuid", "p_reassign_to_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_bill_contributor"("p_contributor_id" "uuid", "p_reassign_to_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_bill_contributor"("p_contributor_id" "uuid", "p_reassign_to_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_bill_item"("p_item_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_bill_item"("p_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_bill_item"("p_item_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_full_bill"("p_bill_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_full_bill"("p_bill_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_full_bill"("p_bill_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_contributor_account"("p_bill_id" "uuid", "p_old_contributor_id" "uuid", "p_new_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."link_contributor_account"("p_bill_id" "uuid", "p_old_contributor_id" "uuid", "p_new_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_contributor_account"("p_bill_id" "uuid", "p_old_contributor_id" "uuid", "p_new_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_payment_id"("p_bill_id" "uuid", "p_user_id" "uuid", "p_payment_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_payment_id"("p_bill_id" "uuid", "p_user_id" "uuid", "p_payment_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_payment_id"("p_bill_id" "uuid", "p_user_id" "uuid", "p_payment_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_payment_method"("p_bill_id" "uuid", "p_user_id" "uuid", "p_payment_method" "public"."payment_method") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_payment_method"("p_bill_id" "uuid", "p_user_id" "uuid", "p_payment_method" "public"."payment_method") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_payment_method"("p_bill_id" "uuid", "p_user_id" "uuid", "p_payment_method" "public"."payment_method") TO "service_role";


















GRANT ALL ON TABLE "public"."bill_contributors" TO "anon";
GRANT ALL ON TABLE "public"."bill_contributors" TO "authenticated";
GRANT ALL ON TABLE "public"."bill_contributors" TO "service_role";



GRANT ALL ON TABLE "public"."bill_item_splits" TO "anon";
GRANT ALL ON TABLE "public"."bill_item_splits" TO "authenticated";
GRANT ALL ON TABLE "public"."bill_item_splits" TO "service_role";



GRANT ALL ON TABLE "public"."bill_items" TO "anon";
GRANT ALL ON TABLE "public"."bill_items" TO "authenticated";
GRANT ALL ON TABLE "public"."bill_items" TO "service_role";



GRANT ALL ON TABLE "public"."bill_users" TO "anon";
GRANT ALL ON TABLE "public"."bill_users" TO "authenticated";
GRANT ALL ON TABLE "public"."bill_users" TO "service_role";



GRANT ALL ON TABLE "public"."bills" TO "anon";
GRANT ALL ON TABLE "public"."bills" TO "authenticated";
GRANT ALL ON TABLE "public"."bills" TO "service_role";



GRANT ALL ON TABLE "public"."ordered_bill_splits" TO "anon";
GRANT ALL ON TABLE "public"."ordered_bill_splits" TO "authenticated";
GRANT ALL ON TABLE "public"."ordered_bill_splits" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


