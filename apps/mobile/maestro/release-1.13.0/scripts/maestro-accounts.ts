/**
 * 1.13.0 초대 Maestro용 임시 계정(A=초대자, B=초대받는 사람) 관리. 로컬 개발 서버 전용이다.
 *
 * 사용: node maestro-accounts.ts <create|reset|delete|fill-friends|clear-friends> [a|b]
 *
 * - create        A, B를 실제 가입 API로 만들고 DB에서 이메일 인증만 표시한다. 비밀번호는 무작위로 만들어
 *                 gitignore된 `.env.maestro`에만 쓴다(출력하지 않는다).
 * - reset         B의 초대 수락·친구 관계·보상·프리미엄·기기 보상 기록을 지워 초대 흐름을 다시 돌릴 수 있게 한다.
 * - delete        A, B와 이 스크립트가 만든 더미 친구를 지운다. `.env.maestro`의 계정 키도 비운다.
 * - fill-friends  지정한 계정(a|b)의 친구 수를 한도까지 더미 친구로 채운다(2106/REQUESTED 확인용).
 * - clear-friends 더미 친구만 지운다.
 *
 * 안전장치: API_BASE_URL과 DATABASE_URL의 host가 로컬(localhost, 127.0.0.1, ::1, db, api,
 * host.docker.internal)이 아니면 DB를 건드리기 전에 멈춘다. 접속 대상(host:port/db)만 출력한다.
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
const DEFAULT_API_BASE_URL = 'http://localhost:8080';
const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/aido';
const FREE_MAX_FRIENDS = 5; // packages/api vocabulary FOLLOW_LIMITS.FREE_MAX_FRIENDS
const EMAIL_DOMAIN = 'example.test';
const DUMMY_PREFIX = 'maestro-dummy';
const INVITE_ALPHABET = '23456789BCDFGHJKMNPQRSTVWXZ';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = resolve(SCRIPT_DIR, '..', '.env.maestro');

interface PgClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  connect(): Promise<void>;
  end(): Promise<void>;
}

interface Target {
  apiBaseUrl: string;
  databaseUrl: string;
  label: string;
}

type Who = 'a' | 'b';

function fail(message: string): never {
  process.stderr.write(`[maestro-accounts] ${message}\n`);
  process.exit(1);
}

/** 어떤 변경보다 먼저 호출한다. 로컬이 아니면 멈춘다. */
function resolveTarget(): Target {
  if (process.env.NODE_ENV === 'production') {
    fail('NODE_ENV=production에서는 실행하지 않습니다.');
  }

  const apiBaseUrl = process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

  let api: URL;
  let db: URL;
  try {
    api = new URL(apiBaseUrl);
    db = new URL(databaseUrl);
  } catch {
    return fail('API_BASE_URL 또는 DATABASE_URL을 해석할 수 없습니다.');
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
  return {
    apiBaseUrl: api.origin,
    databaseUrl,
    label: `api=${api.host} db=${db.host}/${dbName}`,
  };
}

function isPgModule(
  value: unknown,
): value is { Client: new (config: { connectionString: string }) => PgClient } {
  return typeof value === 'object' && value !== null && 'Client' in value;
}

async function connectDatabase(databaseUrl: string): Promise<PgClient> {
  // pg는 apps/api의 의존성이다. 모바일 패키지에 추가하지 않고 그 위치에서 해석한다
  const apiRequire = createRequire(join(SCRIPT_DIR, '..', '..', '..', '..', 'api', 'package.json'));
  const pg: unknown = apiRequire('pg');
  if (!isPgModule(pg)) {
    return fail('apps/api의 pg 모듈을 불러오지 못했습니다. pnpm install을 먼저 실행하세요.');
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

// ---------- .env.maestro ----------

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
  // source로 읽는 파일이라 공백 등이 있는 값은 따옴표로 감싼다
  const quote = (value: string) => (/^[A-Za-z0-9_.@+:/-]*$/.test(value) ? value : `"${value}"`);
  const body = [...entries].map(([key, value]) => `${key}=${quote(value)}`).join('\n');
  writeFileSync(ENV_FILE, `${body}\n`, { mode: 0o600 });
}

function requireEnvEntry(entries: Map<string, string>, key: string): string {
  const value = entries.get(key);
  if (value === undefined || value.length === 0) {
    return fail(`.env.maestro에 ${key}가 없습니다. 먼저 create를 실행하세요.`);
  }
  return value;
}

// ---------- API ----------

async function registerAccount(
  apiBaseUrl: string,
  input: { email: string; password: string; name: string },
) {
  const response = await fetch(`${apiBaseUrl}/v1/auth/register`, {
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
      `가입 API가 ${response.status}로 응답했습니다. 서버가 켜져 있는지, 5회/분 제한에 걸리지 않았는지 확인하세요.`,
    );
  }
}

function randomPassword(): string {
  // 영문+숫자 필수 규칙을 항상 만족시킨다
  return `Mx${randomBytes(9)
    .toString('base64url')
    .replace(/[^A-Za-z0-9]/g, 'a')}9`;
}

function randomInviteLikeTag(prefix: string): string {
  const bytes = randomBytes(8 - prefix.length);
  return prefix + [...bytes].map((byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join('');
}

// ---------- DB 도우미 ----------

async function findUserId(db: PgClient, email: string): Promise<string> {
  const { rows } = await db.query('SELECT "id" FROM "User" WHERE "email" = $1', [email]);
  const id = rows[0]?.id;
  return typeof id === 'string' ? id : fail(`DB에서 ${email} 계정을 찾지 못했습니다.`);
}

async function findDummyIds(db: PgClient): Promise<string[]> {
  const { rows } = await db.query('SELECT "id" FROM "User" WHERE "email" LIKE $1', [
    `${DUMMY_PREFIX}-%@${EMAIL_DOMAIN}`,
  ]);
  return rows.flatMap((row) => (typeof row.id === 'string' ? [row.id] : []));
}

/** "User"를 참조하는 FK 테이블을 따라가며 지운다(깊이 제한). 로컬 임시 계정용이다 */
async function deleteUsersCascade(db: PgClient, userIds: string[]): Promise<void> {
  if (userIds.length === 0) {
    return;
  }
  const { rows: fks } = await db.query(
    `SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f' AND c.confrelid = '"User"'::regclass`,
  );
  await db.query('BEGIN');
  try {
    for (const fk of fks) {
      if (typeof fk.tbl === 'string' && typeof fk.col === 'string') {
        await db.query(`DELETE FROM ${fk.tbl} WHERE "${fk.col}" = ANY($1::text[])`, [userIds]);
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

// ---------- 명령 ----------

async function createAccounts(target: Target): Promise<void> {
  const stamp = Date.now();
  const accounts = {
    a: {
      email: `maestro-a+${stamp}@${EMAIL_DOMAIN}`,
      password: randomPassword(),
      name: 'Maestro A',
    },
    b: {
      email: `maestro-b+${stamp}@${EMAIL_DOMAIN}`,
      password: randomPassword(),
      name: 'Maestro B',
    },
  };
  const db = await connectDatabase(target.databaseUrl);
  try {
    for (const account of Object.values(accounts)) {
      await registerAccount(target.apiBaseUrl, account);
      // 메일 코드 대신 로컬 DB에서 인증 완료로 표시한다
      await db.query(
        `UPDATE "User" SET "emailVerifiedAt" = now(), "status" = 'ACTIVE', "updatedAt" = now() WHERE "email" = $1`,
        [account.email],
      );
    }
  } finally {
    await db.end();
  }

  const entries = readEnvFile();
  entries.set('MAESTRO_QA_INVITER_EMAIL', accounts.a.email);
  entries.set('MAESTRO_QA_INVITER_PASSWORD', accounts.a.password);
  entries.set('MAESTRO_QA_INVITER_NAME', accounts.a.name);
  entries.set('MAESTRO_QA_INVITEE_EMAIL', accounts.b.email);
  entries.set('MAESTRO_QA_INVITEE_PASSWORD', accounts.b.password);
  entries.set('MAESTRO_QA_INVITEE_NAME', accounts.b.name);
  writeEnvFile(entries);
  process.stdout.write(
    `계정 A, B를 만들고 ${ENV_FILE}에 기록했습니다(비밀번호는 출력하지 않습니다).\n`,
  );
}

async function resetInvitee(target: Target): Promise<void> {
  const entries = readEnvFile();
  const db = await connectDatabase(target.databaseUrl);
  try {
    const a = await findUserId(db, requireEnvEntry(entries, 'MAESTRO_QA_INVITER_EMAIL'));
    const b = await findUserId(db, requireEnvEntry(entries, 'MAESTRO_QA_INVITEE_EMAIL'));
    const both = [a, b];
    await db.query('BEGIN');
    try {
      // 실제 수락이 초대자에게 남긴 알림은 friendId 없이 metadata.redemptionId로만 수락과 이어진다
      await db.query(
        `DELETE FROM "Notification" WHERE "metadata"->>'redemptionId' IN (SELECT "id" FROM "InviteRedemption" WHERE "inviteeId" = $1)`,
        [b],
      );
      await db.query(
        'DELETE FROM "InviteActiveDay" WHERE "redemptionId" IN (SELECT "id" FROM "InviteRedemption" WHERE "inviteeId" = $1)',
        [b],
      );
      await db.query('DELETE FROM "InviteRedemption" WHERE "inviteeId" = $1', [b]);
      await db.query('DELETE FROM "RewardGrant" WHERE "recipientId" = ANY($1::text[])', [both]);
      await db.query('DELETE FROM "PremiumGrant" WHERE "userId" = ANY($1::text[])', [both]);
      await db.query('DELETE FROM "ResourceBonus" WHERE "userId" = ANY($1::text[])', [both]);
      // 보상 기간을 지워도 User의 구독 projection은 그대로 ACTIVE로 남아 B가 계속 프리미엄으로 읽힌다
      await db.query(
        `UPDATE "User" SET "subscriptionStatus" = 'FREE', "subscriptionExpiresAt" = NULL, "updatedAt" = now()
          WHERE "id" = ANY($1::text[]) AND NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."userId" = "User"."id")`,
        [both],
      );
      await db.query(
        'DELETE FROM "Follow" WHERE ("followerId" = $1 AND "followingId" = $2) OR ("followerId" = $2 AND "followingId" = $1)',
        [a, b],
      );
      // 기기·신원 해시에는 사용자 연결이 없어, 이 로컬 DB의 보상 기록을 모두 지워야 같은 기기에서 다시 보상을 받는다
      await db.query('DELETE FROM "RewardClaim"');
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } finally {
    await db.end();
  }
  process.stdout.write(
    'B의 초대 수락·친구 관계·보상·프리미엄과 로컬 RewardClaim 전체를 지웠습니다.\n',
  );
}

async function fillFriends(target: Target, who: Who): Promise<void> {
  const entries = readEnvFile();
  const db = await connectDatabase(target.databaseUrl);
  try {
    const email = requireEnvEntry(
      entries,
      who === 'a' ? 'MAESTRO_QA_INVITER_EMAIL' : 'MAESTRO_QA_INVITEE_EMAIL',
    );
    const ownerId = await findUserId(db, email);
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM "Follow" WHERE "status" = 'ACCEPTED' AND "followerId" = $1`,
      [ownerId],
    );
    const current = typeof rows[0]?.n === 'number' ? rows[0].n : 0;
    const missing = Math.max(0, FREE_MAX_FRIENDS - current);
    const stamp = Date.now();

    await db.query('BEGIN');
    try {
      for (let index = 0; index < missing; index += 1) {
        const id = `maestro${stamp}${index}${randomBytes(4).toString('hex')}`;
        const dummyEmail = `${DUMMY_PREFIX}-${stamp}-${index}@${EMAIL_DOMAIN}`;
        await db.query(
          `INSERT INTO "User" ("id", "email", "userTag", "status", "emailVerifiedAt", "updatedAt")
           VALUES ($1, $2, $3, 'ACTIVE', now(), now())`,
          [id, dummyEmail, randomInviteLikeTag('MD')],
        );
        await db.query(`INSERT INTO "UserProfile" ("id", "userId", "name") VALUES ($1, $2, $3)`, [
          `${id}p`,
          id,
          `더미${index + 1}`,
        ]);
        const edges = [
          { suffix: 'f0', follower: ownerId, following: id },
          { suffix: 'f1', follower: id, following: ownerId },
        ];
        for (const edge of edges) {
          await db.query(
            `INSERT INTO "Follow" ("id", "followerId", "followingId", "status", "updatedAt")
             VALUES ($1, $2, $3, 'ACCEPTED', now())`,
            [`${id}${edge.suffix}`, edge.follower, edge.following],
          );
        }
      }
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    process.stdout.write(
      `${who.toUpperCase()}의 친구를 ${FREE_MAX_FRIENDS}명(한도)으로 채웠습니다. 추가한 더미: ${missing}명\n`,
    );
  } finally {
    await db.end();
  }
}

async function clearDummyFriends(target: Target): Promise<void> {
  const db = await connectDatabase(target.databaseUrl);
  try {
    const ids = await findDummyIds(db);
    await deleteUsersCascade(db, ids);
    process.stdout.write(`더미 친구 ${ids.length}명을 지웠습니다.\n`);
  } finally {
    await db.end();
  }
}

async function deleteAccounts(target: Target): Promise<void> {
  const entries = readEnvFile();
  const db = await connectDatabase(target.databaseUrl);
  try {
    const ids = await findDummyIds(db);
    for (const key of ['MAESTRO_QA_INVITER_EMAIL', 'MAESTRO_QA_INVITEE_EMAIL']) {
      const email = entries.get(key);
      if (email !== undefined && email.length > 0) {
        const { rows } = await db.query('SELECT "id" FROM "User" WHERE "email" = $1', [email]);
        const id = rows[0]?.id;
        if (typeof id === 'string') {
          ids.push(id);
        }
      }
    }
    await db.query('DELETE FROM "RewardClaim"');
    await deleteUsersCascade(db, ids);
    process.stdout.write(`계정 ${ids.length}개(A, B, 더미 포함)를 지웠습니다.\n`);
  } finally {
    await db.end();
  }
  for (const key of [
    'MAESTRO_QA_INVITER_EMAIL',
    'MAESTRO_QA_INVITER_PASSWORD',
    'MAESTRO_QA_INVITER_NAME',
    'MAESTRO_QA_INVITEE_EMAIL',
    'MAESTRO_QA_INVITEE_PASSWORD',
    'MAESTRO_QA_INVITEE_NAME',
  ]) {
    entries.delete(key);
  }
  writeEnvFile(entries);
}

async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);
  const target = resolveTarget();
  process.stdout.write(`[maestro-accounts] 대상: ${target.label}\n`);

  const who: Who = argument === 'b' ? 'b' : 'a';
  switch (command) {
    case 'create':
      return createAccounts(target);
    case 'reset':
      return resetInvitee(target);
    case 'delete':
      return deleteAccounts(target);
    case 'fill-friends':
      if (argument !== 'a' && argument !== 'b') {
        return fail('fill-friends는 a 또는 b를 받습니다. 예: fill-friends a');
      }
      return fillFriends(target, who);
    case 'clear-friends':
      return clearDummyFriends(target);
    default:
      return fail('사용: create | reset | delete | fill-friends <a|b> | clear-friends');
  }
}

await main();
