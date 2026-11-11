/**
 * Maestro 흐름이 로그인하는 개발 테스트 계정(main, second)을 로컬 개발 서버에 만들고 되돌린다.
 *
 * 사용: pnpm e2e:accounts <create|reset|delete>
 *
 * - create  main·second를 실제 가입 API로 만들고 로컬 DB에서 이메일 인증만 표시한다. 비밀번호는 무작위로 만들어
 *           git이 무시하는 `.maestro/.env.maestro`에만 쓴다(출력하지 않는다).
 * - reset   second의 초대 수락·두 계정의 친구 관계·친구 알림과 그 알림 작업·보상·프리미엄을 지워 초대·알림함 흐름을
 *           다시 돌릴 수 있게 한다.
 *           초대 수락 기록은 공개 API로 지울 수 없어 이 스크립트만 DB를 만진다.
 * - delete  두 계정을 지우고 `.env.maestro`의 계정 줄을 비운다.
 *
 * 안전장치: API·DB 주소가 로컬(localhost, 127.0.0.1, ::1, db, api, host.docker.internal)이 아니거나
 * NODE_ENV=production, DB 이름에 prod가 있으면 DB를 건드리기 전에 멈춘다. 접속 대상(host:port/db)만 출력한다.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  'db',
  'api',
  'host.docker.internal',
]);
const DEFAULT_API_URL = 'http://localhost:8080';
const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/aido';
const EMAIL_DOMAIN = 'example.test';
// apps/api JOB_SCHEMA 기본값. 로컬 개발 서버는 바꾸지 않는다
const JOB_SCHEMA = 'pgboss';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = resolve(SCRIPT_DIR, '..', '.env.maestro');

const ACCOUNT_ROLES = ['main', 'second'] as const;
type AccountRole = (typeof ACCOUNT_ROLES)[number];

const ENV_KEYS = {
  main: {
    email: 'MAESTRO_MAIN_EMAIL',
    password: 'MAESTRO_MAIN_PASSWORD',
    name: 'MAESTRO_MAIN_NAME',
  },
  second: {
    email: 'MAESTRO_SECOND_EMAIL',
    password: 'MAESTRO_SECOND_PASSWORD',
    name: 'MAESTRO_SECOND_NAME',
  },
} as const satisfies Record<AccountRole, Record<'email' | 'password' | 'name', string>>;

const ACCOUNT_NAMES = { main: 'Maestro Main', second: 'Maestro Second' } as const satisfies Record<
  AccountRole,
  string
>;

interface PgClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  connect(): Promise<void>;
  end(): Promise<void>;
}

interface Target {
  apiUrl: string;
  databaseUrl: string;
  label: string;
}

function fail(message: string): never {
  process.stderr.write(`[e2e:accounts] ${message}\n`);
  process.exit(1);
}

/** 어떤 변경보다 먼저 부른다. 로컬이 아니면 멈춘다 */
function resolveTarget(): Target {
  if (process.env.NODE_ENV === 'production') {
    fail('NODE_ENV=production에서는 실행하지 않습니다.');
  }

  const apiUrl = process.env.MAESTRO_API_URL ?? DEFAULT_API_URL;
  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

  let api: URL;
  let db: URL;
  try {
    api = new URL(apiUrl);
    db = new URL(databaseUrl);
  } catch {
    return fail('MAESTRO_API_URL 또는 DATABASE_URL을 해석할 수 없습니다.');
  }

  if (api.protocol !== 'http:' || !LOCAL_HOSTS.has(api.hostname.toLowerCase())) {
    fail(`로컬 HTTP API만 허용합니다. 현재 host: ${api.hostname}`);
  }
  if (!db.protocol.startsWith('postgres') || !LOCAL_HOSTS.has(db.hostname.toLowerCase())) {
    fail(`로컬 PostgreSQL만 허용합니다. 현재 host: ${db.hostname}`);
  }
  const dbName = db.pathname.replace(/^\//, '');
  if (dbName.length === 0 || /prod/i.test(dbName)) {
    fail('DATABASE_URL의 database 이름이 비었거나 prod를 포함합니다.');
  }

  // 비밀번호·사용자 이름은 출력하지 않는다
  return { apiUrl: api.origin, databaseUrl, label: `api=${api.host} db=${db.host}/${dbName}` };
}

function isPgModule(
  value: unknown,
): value is { Client: new (config: { connectionString: string }) => PgClient } {
  return typeof value === 'object' && value !== null && 'Client' in value;
}

async function connectDatabase(databaseUrl: string): Promise<PgClient> {
  // pg는 apps/api의 의존성이다. 모바일 패키지에 추가하지 않고 그 위치에서 해석한다
  const apiRequire = createRequire(join(SCRIPT_DIR, '..', '..', '..', 'api', 'package.json'));
  const pg: unknown = apiRequire('pg');
  if (!isPgModule(pg)) {
    return fail('apps/api의 pg 모듈을 불러오지 못했습니다. pnpm install을 먼저 실행하세요.');
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

function readEnvFile(): Map<string, string> {
  const entries = new Map<string, string>();
  if (!existsSync(ENV_FILE)) {
    return entries;
  }
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match?.[1] !== undefined) {
      entries.set(match[1], (match[2] ?? '').replace(/^"(.*)"$/, '$1'));
    }
  }
  return entries;
}

function writeEnvFile(entries: Map<string, string>): void {
  // shell에서 읽는 파일이라 공백 등이 있는 값은 따옴표로 감싼다
  const quote = (value: string) => (/^[A-Za-z0-9_.@+:/-]*$/.test(value) ? value : `"${value}"`);
  const body = [...entries].map(([key, value]) => `${key}=${quote(value)}`).join('\n');
  writeFileSync(ENV_FILE, `${body}\n`, { mode: 0o600 });
}

function requireEmail(entries: Map<string, string>, role: AccountRole): string {
  const email = entries.get(ENV_KEYS[role].email);
  if (email === undefined || email.length === 0) {
    return fail(`.env.maestro에 ${ENV_KEYS[role].email}가 없습니다. 먼저 create를 실행하세요.`);
  }
  return email;
}

async function findUserId(db: PgClient, email: string): Promise<string> {
  const { rows } = await db.query('SELECT "id" FROM "User" WHERE "email" = $1', [email]);
  const id = rows[0]?.id;
  return typeof id === 'string' ? id : fail(`DB에서 ${email} 계정을 찾지 못했습니다.`);
}

async function registerAccount(
  apiUrl: string,
  input: { email: string; password: string; name: string },
): Promise<void> {
  const response = await fetch(`${apiUrl}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      passwordConfirm: input.password,
      name: input.name,
      termsAgreed: true,
      privacyAgreed: true,
    }),
  });
  if (!response.ok) {
    fail(
      `가입 API가 ${response.status}로 응답했습니다. 서버가 켜져 있는지, 분당 가입 제한에 걸리지 않았는지 확인하세요.`,
    );
  }
}

function randomPassword(): string {
  // 영문+숫자 필수 규칙을 늘 만족한다
  return `Mx${randomBytes(9)
    .toString('base64url')
    .replace(/[^A-Za-z0-9]/g, 'a')}9`;
}

async function createAccounts(target: Target): Promise<void> {
  const stamp = Date.now();
  const entries = readEnvFile();
  const db = await connectDatabase(target.databaseUrl);
  try {
    for (const role of ACCOUNT_ROLES) {
      const account = {
        email: `maestro-${role}+${stamp}@${EMAIL_DOMAIN}`,
        password: randomPassword(),
        name: ACCOUNT_NAMES[role],
      };
      await registerAccount(target.apiUrl, account);
      // 메일 인증 코드 대신 로컬 DB에서 인증 완료로 표시한다
      await db.query(
        `UPDATE "User" SET "emailVerifiedAt" = now(), "status" = 'ACTIVE', "updatedAt" = now() WHERE "email" = $1`,
        [account.email],
      );
      entries.set(ENV_KEYS[role].email, account.email);
      entries.set(ENV_KEYS[role].password, account.password);
      entries.set(ENV_KEYS[role].name, account.name);
    }
  } finally {
    await db.end();
  }
  writeEnvFile(entries);
  process.stdout.write(
    `main·second 계정을 만들고 ${ENV_FILE}에 기록했습니다(비밀번호는 출력하지 않습니다).\n`,
  );
}

/** apps/api `notificationEventJobKey`의 친구 요청·친구 됨 알림 작업 key를 두 방향 모두 */
function followNotificationJobKeys(main: string, second: string): string[] {
  return [
    `follow-new-${main}-${second}`,
    `follow-new-${second}-${main}`,
    `follow-mutual-${main}-${second}`,
    `follow-mutual-${second}-${main}`,
  ];
}

async function resetAccounts(target: Target): Promise<void> {
  const entries = readEnvFile();
  const db = await connectDatabase(target.databaseUrl);
  try {
    const main = await findUserId(db, requireEmail(entries, 'main'));
    const second = await findUserId(db, requireEmail(entries, 'second'));
    const both = [main, second];
    await db.query('BEGIN');
    try {
      // 실제 수락이 초대자에게 남긴 알림은 friendId 없이 metadata.redemptionId로만 수락과 이어진다
      await db.query(
        `DELETE FROM "Notification" WHERE "metadata"->>'redemptionId' IN (SELECT "id" FROM "InviteRedemption" WHERE "inviteeId" = $1)`,
        [second],
      );
      await db.query(
        'DELETE FROM "InviteActiveDay" WHERE "redemptionId" IN (SELECT "id" FROM "InviteRedemption" WHERE "inviteeId" = $1)',
        [second],
      );
      await db.query('DELETE FROM "InviteRedemption" WHERE "inviteeId" = $1', [second]);
      await db.query('DELETE FROM "RewardGrant" WHERE "recipientId" = ANY($1::text[])', [both]);
      await db.query('DELETE FROM "PremiumGrant" WHERE "userId" = ANY($1::text[])', [both]);
      await db.query('DELETE FROM "ResourceBonus" WHERE "userId" = ANY($1::text[])', [both]);
      // 보상 기간을 지워도 User의 구독 projection은 ACTIVE로 남아 계속 프리미엄으로 읽힌다
      await db.query(
        `UPDATE "User" SET "subscriptionStatus" = 'FREE', "subscriptionExpiresAt" = NULL, "updatedAt" = now()
          WHERE "id" = ANY($1::text[]) AND NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."userId" = "User"."id")`,
        [both],
      );
      await db.query(
        'DELETE FROM "Follow" WHERE ("followerId" = $1 AND "followingId" = $2) OR ("followerId" = $2 AND "followingId" = $1)',
        [main, second],
      );
      // 서버는 같은 친구의 친구 요청·수락 알림을 24시간 안에 다시 만들지 않는다. 알림함 흐름을 다시 돌릴 수 있게 두 계정 사이 알림을 지운다
      await db.query(
        `DELETE FROM "Notification" WHERE "userId" = ANY($1::text[]) AND "type" IN ('FOLLOW_NEW', 'FOLLOW_ACCEPTED')`,
        [both],
      );
      // 알림 작업은 key에서 만든 결정적 id로 끝난 뒤에도 하루 남아, 지우지 않으면 같은 두 계정의 친구 요청 알림 작업이 다시 들어가지 않는다
      await db.query(`DELETE FROM ${JOB_SCHEMA}.job WHERE "singleton_key" = ANY($1::text[])`, [
        followNotificationJobKeys(main, second),
      ]);
      // 기기·신원 해시에는 사용자 연결이 없어, 같은 시뮬레이터에서 다시 보상을 받으려면 로컬 기록을 모두 지운다
      await db.query('DELETE FROM "RewardClaim"');
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } finally {
    await db.end();
  }
  process.stdout.write('second의 초대 수락·두 계정의 친구 관계·보상·프리미엄을 지웠습니다.\n');
}

/** "User"를 참조하는 FK 테이블을 따라 지운다. 로컬 테스트 계정용이다 */
async function deleteUsersCascade(db: PgClient, userIds: string[]): Promise<void> {
  if (userIds.length === 0) {
    return;
  }
  const { rows: foreignKeys } = await db.query(
    `SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f' AND c.confrelid = '"User"'::regclass`,
  );
  await db.query('BEGIN');
  try {
    for (const foreignKey of foreignKeys) {
      if (typeof foreignKey.tbl === 'string' && typeof foreignKey.col === 'string') {
        await db.query(
          `DELETE FROM ${foreignKey.tbl} WHERE "${foreignKey.col}" = ANY($1::text[])`,
          [userIds],
        );
      }
    }
    await db.query('DELETE FROM "User" WHERE "id" = ANY($1::text[])', [userIds]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    const message = error instanceof Error ? error.message : String(error);
    fail(`삭제 중 FK 때문에 되돌렸습니다: ${message}`);
  }
}

async function deleteAccounts(target: Target): Promise<void> {
  const entries = readEnvFile();
  const db = await connectDatabase(target.databaseUrl);
  try {
    const userIds: string[] = [];
    for (const role of ACCOUNT_ROLES) {
      const email = entries.get(ENV_KEYS[role].email);
      if (email !== undefined && email.length > 0) {
        const { rows } = await db.query('SELECT "id" FROM "User" WHERE "email" = $1', [email]);
        const id = rows[0]?.id;
        if (typeof id === 'string') {
          userIds.push(id);
        }
      }
    }
    await db.query('DELETE FROM "RewardClaim"');
    await deleteUsersCascade(db, userIds);
    process.stdout.write(`계정 ${userIds.length}개를 지웠습니다.\n`);
  } finally {
    await db.end();
  }
  for (const role of ACCOUNT_ROLES) {
    for (const key of Object.values(ENV_KEYS[role])) {
      entries.delete(key);
    }
  }
  writeEnvFile(entries);
}

async function main(): Promise<void> {
  if (existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }
  const [command] = process.argv.slice(2);
  const target = resolveTarget();
  process.stdout.write(`[e2e:accounts] 대상: ${target.label}\n`);

  switch (command) {
    case 'create':
      return createAccounts(target);
    case 'reset':
      return resetAccounts(target);
    case 'delete':
      return deleteAccounts(target);
    default:
      return fail('사용: pnpm e2e:accounts <create|reset|delete>');
  }
}

await main();
