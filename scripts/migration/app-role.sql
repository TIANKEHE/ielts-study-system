-- Optional provisioning step, reviewed separately before production cutover.
-- No password is stored here. Set it interactively with psql \password kyes_app.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kyes_app') THEN
  CREATE ROLE kyes_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA kyes TO kyes_app;
DO $$ DECLARE item record; BEGIN
 FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='kyes' AND tablename<>'_prisma_migrations' LOOP
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON kyes.%I TO kyes_app',item.tablename);
  EXECUTE format('DROP POLICY IF EXISTS kyes_server_only ON kyes.%I',item.tablename);
  EXECUTE format('CREATE POLICY kyes_server_only ON kyes.%I FOR ALL TO kyes_app USING (true) WITH CHECK (true)',item.tablename);
 END LOOP;
END $$;
-- After setting a strong password using psql's hidden prompt:
-- ALTER ROLE kyes_app LOGIN;
-- Runtime DATABASE_URL uses kyes_app; DIRECT_URL remains migration-admin only.
