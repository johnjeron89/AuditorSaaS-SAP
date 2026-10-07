-- PostgreSQL: Create a read-only role for the audit agent
-- Run this as a superuser / database owner ONCE before running the agent.

-- 1. Create the role
CREATE ROLE auditor_readonly WITH LOGIN PASSWORD 'CHANGE_ME_TO_A_STRONG_PASSWORD';

-- 2. Grant CONNECT to the target database
-- Replace 'your_database' with the actual database name
GRANT CONNECT ON DATABASE your_database TO auditor_readonly;

-- 3. Grant USAGE on schemas the agent needs to inspect
GRANT USAGE ON SCHEMA public TO auditor_readonly;

-- 4. Grant SELECT on system catalogs (already available to all by default)
-- These are used by the agent:
--   pg_roles, pg_extension, pg_hba_file_rules (view)

-- 5. Grant pg_read_all_settings so the agent can run SHOW commands
GRANT pg_read_all_settings TO auditor_readonly;

-- 6. Allow reading pg_hba_file_rules (requires pg_read_all_settings, PG 10+)
-- Already covered by step 5.

-- 7. No write permissions — this role is strictly read-only.
-- Verify with:
--   SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin
--   FROM pg_roles WHERE rolname = 'auditor_readonly';
