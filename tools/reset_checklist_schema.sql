-- ==============================================================================
--                   ⚠️   CHECKLIST SCHEMA RESET SCRIPT   ⚠️
-- ==============================================================================
-- NOTICE & SAFETY WARNING:
-- 1. This script operates EXCLUSIVELY on the "checklist_web_app" schema.
-- 2. It will NEVER modify, truncate, or touch "public", "auth", "storage",
--    or any other Supabase schema.
-- 3. Data in non-preserved tables will be PERMANENTLY REMOVED.
--
-- HOW TO PRESERVE TABLES:
-- Add or remove table names from the `v_preserved_tables` array below.
-- Preserved tables will NOT be truncated or altered in any way.
-- ==============================================================================

DO $$
DECLARE
    -- SCHEMA DEFINITION (Targeted schema ONLY)
    v_target_schema CONSTANT text := 'checklist_web_app';

    -- 🛡️ TABLE PRESERVATION CONFIGURATION:
    -- Add any tables you want to KEEP/PRESERVE into this array:
    -- Examples: 'users', 'branches', 'tasks', 'refrigerators', 'cron_settings'
    v_preserved_tables text[] := ARRAY[
        -- 'users',
        -- 'branches',
        -- 'tasks',
        -- 'refrigerators',
        -- 'cron_settings'
    ];

    r RECORD;
    v_table_name text;
    v_is_preserved boolean;
    v_tables_to_wipe text[] := ARRAY[]::text[];
    v_truncate_query text;
    v_preserved_count int := 0;
    v_wiped_count int := 0;
    v_row_count bigint;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE '       ⚠️   STARTING RESET FOR SCHEMA: %   ⚠️', v_target_schema;
    RAISE NOTICE '======================================================================';

    -- Check if schema exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = v_target_schema) THEN
        RAISE EXCEPTION 'Schema % does not exist! Aborting reset.', v_target_schema;
    END IF;

    -- Inspect all tables in target schema
    FOR r IN (
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = v_target_schema 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    ) LOOP
        v_table_name := r.table_name;
        
        -- Check if current table is in preservation list
        v_is_preserved := (v_table_name = ANY(v_preserved_tables));

        -- Get current row count
        EXECUTE format('SELECT count(*) FROM %I.%I', v_target_schema, v_table_name) INTO v_row_count;

        IF v_is_preserved THEN
            v_preserved_count := v_preserved_count + 1;
            RAISE NOTICE '  🛡️  [PRESERVED] %.% (% rows - KEPT INTACT)', v_target_schema, v_table_name, v_row_count;
        ELSE
            v_wiped_count := v_wiped_count + 1;
            v_tables_to_wipe := array_append(v_tables_to_wipe, format('%I.%I', v_target_schema, v_table_name));
            RAISE NOTICE '  ⚠️  [TO BE WIPED] %.% (% rows)', v_target_schema, v_table_name, v_row_count;
        END IF;
    END LOOP;

    -- Execute TRUNCATE on non-preserved tables
    IF array_length(v_tables_to_wipe, 1) IS NOT NULL AND array_length(v_tables_to_wipe, 1) > 0 THEN
        v_truncate_query := 'TRUNCATE TABLE ' || array_to_string(v_tables_to_wipe, ', ') || ' RESTART IDENTITY CASCADE';
        RAISE NOTICE '----------------------------------------------------------------------';
        RAISE NOTICE 'Executing: %', v_truncate_query;
        EXECUTE v_truncate_query;
        RAISE NOTICE '----------------------------------------------------------------------';
        RAISE NOTICE '✓ Successfully wiped % table(s) in schema %.', v_wiped_count, v_target_schema;
    ELSE
        RAISE NOTICE 'No tables to wipe. All tables were preserved or schema is empty.';
    END IF;

    RAISE NOTICE '🛡️ Total Preserved Tables: %', v_preserved_count;
    RAISE NOTICE '⚠️ Total Wiped Tables:     %', v_wiped_count;
    RAISE NOTICE '======================================================================';
    RAISE NOTICE '✓ Schema % reset operation completed.', v_target_schema;
    RAISE NOTICE '======================================================================';
END $$;
