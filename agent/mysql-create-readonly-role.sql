-- MySQL: Create a read-only user for the audit agent
-- Run this as root / admin ONCE before running the agent.

-- 1. Create the user (change password!)
CREATE USER 'auditor_readonly'@'localhost'
  IDENTIFIED WITH caching_sha2_password
  BY 'CHANGE_ME_TO_A_STRONG_PASSWORD';

-- 2. Grant read-only access to system tables the agent needs
GRANT SELECT ON mysql.user TO 'auditor_readonly'@'localhost';
GRANT SELECT ON mysql.component TO 'auditor_readonly'@'localhost';
GRANT SELECT ON information_schema.* TO 'auditor_readonly'@'localhost';

-- 3. Grant SHOW DATABASES so the agent can check for 'test' db
GRANT SHOW DATABASES ON *.* TO 'auditor_readonly'@'localhost';

-- 4. Grant process privilege to view global variables
GRANT PROCESS ON *.* TO 'auditor_readonly'@'localhost';

-- 5. Apply changes
FLUSH PRIVILEGES;

-- 6. Verify (should show only SELECT + PROCESS + SHOW DATABASES):
-- SHOW GRANTS FOR 'auditor_readonly'@'localhost';
