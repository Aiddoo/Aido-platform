-- API와 pg-boss가 접속하는 최소 권한 역할(aido_app)의 정본이다. 소유자 계정으로 실행하고 여러 번 실행해도 결과가 같다.
--   psql "<소유자 주소>" -v ON_ERROR_STOP=1 -f scripts/ops/db/app-role.sql
-- 비밀번호는 환경 변수 APP_ROLE_PASSWORD로만 넘긴다(명령 인자·shell history에 남기지 않는다). 없으면 비밀번호는 그대로 둔다.
-- migration은 계속 소유자 계정이 실행한다(apps/api/.env.migrate). 이 역할은 테이블을 만들거나 바꾸지 못한다.

SELECT NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aido_app') AS role_missing \gset
\if :role_missing
  CREATE ROLE aido_app LOGIN;
\endif
-- 연결 상한은 앱이 풀을 다 써도 소유자가 접속할 자리를 남긴다(max_connections 79).
-- SUPERUSER·REPLICATION은 적지 않는다. 관리형 DB의 소유자는 superuser가 아니라 그 속성을 건드리는 문장이 거절된다
ALTER ROLE aido_app WITH LOGIN NOCREATEDB NOCREATEROLE CONNECTION LIMIT 60;
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_roles
    WHERE rolname = 'aido_app' AND (rolsuper OR rolreplication OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'aido_app 역할에 최소 권한을 넘는 속성이 있다';
  END IF;
END
$$;

\getenv app_role_password APP_ROLE_PASSWORD
\if :{?app_role_password}
  ALTER ROLE aido_app PASSWORD :'app_role_password';
\endif

-- 앱이 접속할 때 넘기는 세션 옵션과 같은 값이다(postgres-pool.ts). 접속 옵션을 전달하지 않는 연결 풀러를 거쳐도 유지된다
ALTER ROLE aido_app SET TimeZone = 'UTC';
ALTER ROLE aido_app SET statement_timeout = '15s';
ALTER ROLE aido_app SET lock_timeout = '5s';
ALTER ROLE aido_app SET idle_in_transaction_session_timeout = '60s';

SELECT format('GRANT CONNECT ON DATABASE %I TO aido_app', current_database()) \gexec
-- PostgreSQL 14 이전에 만든 DB는 누구나 public에 테이블을 만들 수 있다
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public, pgboss TO aido_app;
-- 이 계정이 가진 테이블·시퀀스에만 준다. `ON ALL TABLES IN SCHEMA`는 확장이 만든 남의 뷰(pg_stat_statements)에서 거절된다
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO aido_app', schemaname, tablename)
FROM pg_tables
WHERE schemaname IN ('public', 'pgboss') AND tableowner = current_user \gexec
SELECT format('GRANT USAGE, SELECT, UPDATE ON SEQUENCE %I.%I TO aido_app', schemaname, sequencename)
FROM pg_sequences
WHERE schemaname IN ('public', 'pgboss') AND sequenceowner = current_user \gexec
-- 이 계정(소유자)이 앞으로 migration으로 만드는 테이블·시퀀스에도 같은 권한을 준다
ALTER DEFAULT PRIVILEGES IN SCHEMA public, pgboss GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aido_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, pgboss GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO aido_app;
