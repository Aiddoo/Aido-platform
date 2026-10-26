/**
 * 1.13.0 화면 캡처용 데모 데이터. 로컬 개발 서버(Docker API + PostgreSQL) 전용이다.
 *
 * 사용: node demo-seed.ts <seed|ai|reset|reset-newbie|status> [ko|en|all]
 *
 * - seed          데모 계정을 지우고 다시 만든다(실제 가입 API + 로컬 DB). 끝나면 ai 단계까지 이어서 돌린다.
 *                 계정 비밀번호와 화면 이동에 쓰는 ID는 gitignore된 `.env.screens`에만 쓴다(출력하지 않는다).
 * - ai            프리미엄 계정에 실제 AI 경로를 돌린다. parse-todo API로 할 일을 만들고, 로컬 job 큐(pg-boss)에
 *                 주간·월간 리포트와 반복 제안 job을 넣어 서버 worker가 Gemini로 만들게 한다. 실패하면 저장 행으로 대체하고
 *                 어떤 화면이 대체됐는지 `.env.screens`의 SCREENS_<L>_AI_* 값과 출력으로 남긴다.
 * - reset         데모 계정(@demo.aido.kr)과 그 데이터를 모두 지운다.
 * - reset-newbie  초대 카드·환영 시트 캡처로 소비한 신규 계정의 수락·보상·친구 관계를 되돌린다.
 * - status        계정별 프리미엄·리포트·제안 상태만 출력한다.
 *
 * 안전장치: maestro-accounts.ts와 같은 규칙이다. API_BASE_URL과 DATABASE_URL의 host가 로컬이 아니거나
 * NODE_ENV=production, DB 이름에 prod가 있으면 어떤 요청도 보내기 전에 멈춘다. 대상은 host:port/db만 출력한다.
 * AI 키는 서버 환경 변수에만 있고 이 스크립트는 읽지 않는다.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { z } from 'zod';

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
const DEMO_EMAIL_DOMAIN = 'demo.aido.kr';
const TAG_ALPHABET = '23456789BCDFGHJKMNPQRSTVWXZ';
const DAY_MS = 86_400_000;
const AI_REPORT_QUEUE = 'ai-report-generation.v1';
const AI_SUGGESTION_QUEUE = 'ai-suggestion-analysis.v1';
const REPORT_FALLBACK_PREFIXES = [
  '이번 기간의 할 일 통계를 기반으로',
  'This report was generated from your to-do stats',
];
const LOCALES = ['ko', 'en'] as const;
type Locale = (typeof LOCALES)[number];
type Role = 'premium' | 'free' | 'grant' | 'newbie';
const ROLES: readonly Role[] = ['premium', 'free', 'grant', 'newbie'];

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = resolve(SCRIPT_DIR, '..', '.env.screens');
const CONTENT_FILE = join(SCRIPT_DIR, 'demo-content.json');

// ---------- 콘텐츠 스키마 ----------

const dayOfWeekSchema = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
type DayOfWeek = z.infer<typeof dayOfWeekSchema>;
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();
const ownerSchema = z.object({ name: z.string(), email: z.string(), icon: z.string() });
const todoSpecSchema = z.object({ title: z.string(), time: timeSchema, done: z.boolean() });
const fillerSchema = z.object({ title: z.string(), category: z.string(), time: timeSchema });
const localeContentSchema = z.object({
  timezone: z.string(),
  timeFormat: z.enum(['TWELVE_HOUR', 'TWENTY_FOUR_HOUR']),
  owners: z.object({
    premium: ownerSchema,
    free: ownerSchema,
    grant: ownerSchema,
    newbie: ownerSchema,
  }),
  categories: z.array(
    z.object({ key: z.string(), name: z.string(), color: z.string(), free: z.boolean() }),
  ),
  routines: z.array(
    z.object({
      title: z.string(),
      category: z.string(),
      days: z.array(dayOfWeekSchema),
      time: timeSchema,
      free: z.boolean(),
    }),
  ),
  weekdayFillers: z.array(fillerSchema),
  weekendFillers: z.array(fillerSchema),
  oneOffs: z.array(
    z.object({
      offset: z.number().int(),
      title: z.string(),
      category: z.string(),
      time: timeSchema,
      done: z.boolean(),
      free: z.boolean(),
      detail: z.boolean().optional(),
      items: z.array(z.object({ title: z.string(), done: z.boolean() })).optional(),
    }),
  ),
  memos: z.array(
    z.object({
      content: z.string(),
      pinned: z.boolean(),
      free: z.boolean(),
      ai: z.boolean().optional(),
    }),
  ),
  aiPrompts: z.array(z.string()),
  friends: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      icon: z.string(),
      account: z.literal('grant').optional(),
      invite: z.enum(['rewarded', 'waiting']).optional(),
      joinedDaysAgo: z.number().int().optional(),
      freeFriend: z.boolean(),
      allDone: z.boolean().optional(),
      todos: z.array(todoSpecSchema),
    }),
  ),
  stranger: z.object({ key: z.string(), name: z.string(), icon: z.string() }),
  nudge: z.object({ from: z.string(), todo: z.string(), message: z.string() }),
  cheer: z.object({ from: z.string(), message: z.string() }),
  sentNudge: z.object({ to: z.string(), todo: z.string(), message: z.string() }),
  copy: z.record(z.string(), z.string()),
  fallback: z.object({
    weeklySummary: z.string(),
    monthlySummary: z.string(),
    tips: z.array(z.string()),
    suggestions: z.array(
      z.object({
        title: z.string(),
        days: z.array(dayOfWeekSchema),
        time: timeSchema,
        category: z.string(),
        reason: z.string(),
      }),
    ),
  }),
});
type LocaleContent = z.infer<typeof localeContentSchema>;
const contentSchema = z.object({ ko: localeContentSchema, en: localeContentSchema });

// ---------- 공용 ----------

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

interface Context {
  db: PgClient;
  target: Target;
  env: Map<string, string>;
  now: Date;
}

function fail(message: string): never {
  process.stderr.write(`[demo-seed] ${message}\n`);
  process.exit(1);
}

function log(message: string): void {
  process.stdout.write(`[demo-seed] ${message}\n`);
}

/** maestro-accounts.ts와 같은 로컬 전용 확인. 어떤 변경보다 먼저 호출한다. */
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
  return { apiBaseUrl: api.origin, databaseUrl, label: `api=${api.host} db=${db.host}/${dbName}` };
}

function apiRequire() {
  // pg, pg-boss는 apps/api의 의존성이다. 모바일 패키지에 추가하지 않고 그 위치에서 해석한다
  return createRequire(join(SCRIPT_DIR, '..', '..', '..', '..', 'api', 'package.json'));
}

function isPgModule(
  value: unknown,
): value is { Client: new (config: { connectionString: string }) => PgClient } {
  return typeof value === 'object' && value !== null && 'Client' in value;
}

async function connectDatabase(databaseUrl: string): Promise<PgClient> {
  const pg: unknown = apiRequire()('pg');
  if (!isPgModule(pg)) {
    return fail('apps/api의 pg 모듈을 불러오지 못했습니다. pnpm install을 먼저 실행하세요.');
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  // TimestampString 열은 timestamp without time zone(UTC 저장)이라 세션도 UTC로 맞춘다
  await client.query("SET TIME ZONE 'UTC'");
  return client;
}

interface BossLike {
  start(): Promise<unknown>;
  stop(options?: Record<string, unknown>): Promise<void>;
  send(name: string, data: object, options?: Record<string, unknown>): Promise<string | null>;
}

function isBossModule(
  value: unknown,
): value is { PgBoss: new (options: Record<string, unknown>) => BossLike } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'PgBoss' in value &&
    typeof value.PgBoss === 'function'
  );
}

async function openJobQueue(databaseUrl: string): Promise<BossLike> {
  const resolved = apiRequire().resolve('pg-boss');
  const imported: unknown = await import(pathToFileURL(resolved).href);
  if (!isBossModule(imported)) {
    return fail('apps/api의 pg-boss 모듈 형태가 예상과 다릅니다.');
  }
  // 서버가 이미 스키마와 큐를 만들어 둔다. 여기서는 job만 넣고 유지보수·스케줄러는 돌리지 않는다
  const boss = new imported.PgBoss({
    connectionString: databaseUrl,
    schema: process.env.JOB_SCHEMA ?? 'pgboss',
    migrate: false,
    createSchema: false,
    supervise: false,
    schedule: false,
    max: 2,
  });
  await boss.start();
  return boss;
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
  const quote = (value: string) => (/^[A-Za-z0-9_.@+:/-]*$/.test(value) ? value : `"${value}"`);
  const body = [...entries]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${quote(value)}`)
    .join('\n');
  writeFileSync(ENV_FILE, `${body}\n`, { mode: 0o600 });
}

function envKey(locale: Locale, ...parts: string[]): string {
  return ['SCREENS', locale.toUpperCase(), ...parts.map((part) => part.toUpperCase())].join('_');
}

function loadContent(): z.infer<typeof contentSchema> {
  return contentSchema.parse(JSON.parse(readFileSync(CONTENT_FILE, 'utf8')));
}

function cuidLike(): string {
  // 서버 응답 스키마가 cuid 형식을 검사하므로 c로 시작하는 소문자 25자로 만든다
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return `c${[...randomBytes(24)].map((byte) => alphabet[byte % alphabet.length]).join('')}`;
}

function randomTag(): string {
  return [...randomBytes(8)].map((byte) => TAG_ALPHABET[byte % TAG_ALPHABET.length]).join('');
}

function randomPassword(): string {
  return `Ad${randomBytes(9)
    .toString('base64url')
    .replace(/[^A-Za-z0-9]/g, 'a')}7`;
}

/** 같은 입력이면 같은 값을 주는 0~99 */
function stableRoll(...parts: string[]): number {
  return (createHash('sha256').update(parts.join('|')).digest()[0] ?? 0) % 100;
}

function friendEmail(key: string, locale: Locale): string {
  return `${key}.${locale}@${DEMO_EMAIL_DOMAIN}`;
}

function utc(date: Date): string {
  return date.toISOString();
}

// ---------- 날짜 (사용자 timezone 기준 달력) ----------

function localDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const value = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return value.toISOString().slice(0, 10);
}

function dayOfWeek(dateKey: string): DayOfWeek {
  const index = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  const days: readonly DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return days[index] ?? 'MON';
}

function offsetOf(dateKey: string, timezone: string): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${dateKey}T12:00:00Z`))
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = /GMT([+-]\d{2}:\d{2})/.exec(name ?? '');
  return match?.[1] ?? '+00:00';
}

function instant(dateKey: string, time: string, timezone: string): Date {
  return new Date(`${dateKey}T${time}:00${offsetOf(dateKey, timezone)}`);
}

// ---------- API ----------

const loginResponseSchema = z.object({
  data: z.object({ accessToken: z.string(), userId: z.string() }),
});

async function sleep(ms: number): Promise<void> {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function register(
  target: Target,
  input: { email: string; password: string; name: string },
): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${target.apiBaseUrl}/v1/auth/register`, {
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
    if (response.ok) {
      return;
    }
    if (response.status === 429) {
      // 가입은 분당 5회로 제한된다. 기다렸다가 다시 시도한다
      log('가입 API 분당 제한에 걸려 15초 기다립니다.');
      await sleep(15_000);
      continue;
    }
    fail(`가입 API가 ${response.status}로 응답했습니다. 로컬 API가 켜져 있는지 확인하세요.`);
  }
  fail('가입 API 제한이 풀리지 않았습니다. 잠시 후 다시 실행하세요.');
}

async function login(target: Target, email: string, password: string): Promise<string> {
  const response = await fetch(`${target.apiBaseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password, deviceName: 'screens-seed', deviceType: 'IOS' }),
  });
  if (!response.ok) {
    return fail(`로그인 API가 ${response.status}로 응답했습니다.`);
  }
  return loginResponseSchema.parse(await response.json()).data.accessToken;
}

async function callApi(
  target: Target,
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const response = await fetch(`${target.apiBaseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json };
}

const parsedTodoSchema = z.object({
  title: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: timeSchema,
  isAllDay: z.boolean(),
  isRecurring: z.boolean().optional(),
  recurrence: z
    .object({ daysOfWeek: z.array(dayOfWeekSchema), endDate: z.string() })
    .nullable()
    .optional(),
});
type ParsedTodo = z.infer<typeof parsedTodoSchema>;

/** 응답 봉투 모양에 기대지 않고 parse 결과 객체를 찾는다 */
function findParsedTodo(value: unknown, depth = 0): ParsedTodo | null {
  const parsed = parsedTodoSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  if (depth > 3 || typeof value !== 'object' || value === null) {
    return null;
  }
  for (const child of Object.values(value)) {
    const found = findParsedTodo(child, depth + 1);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

const inviteCodeSchema = z.object({ code: z.string().regex(/^[2-9A-Z]{6}$/) });

function findInviteCode(value: unknown, depth = 0): string | null {
  const parsed = inviteCodeSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data.code;
  }
  if (depth > 3 || typeof value !== 'object' || value === null) {
    return null;
  }
  for (const child of Object.values(value)) {
    const found = findInviteCode(child, depth + 1);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

// ---------- DB 도우미 ----------

async function insertReturningId(db: PgClient, sql: string, values: unknown[]): Promise<number> {
  const { rows } = await db.query(`${sql} RETURNING "id"`, values);
  const id = rows[0]?.id;
  return typeof id === 'number' ? id : fail('INSERT 결과에 숫자 id가 없습니다.');
}

async function findUserId(db: PgClient, email: string): Promise<string | null> {
  const { rows } = await db.query('SELECT "id" FROM "User" WHERE "email" = $1', [email]);
  const id = rows[0]?.id;
  return typeof id === 'string' ? id : null;
}

/** "User"를 참조하는 FK 테이블을 따라 지운다. maestro-accounts.ts의 삭제와 같은 방식이다 */
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
    // 할 일이 카테고리를 Restrict로 잡고 있어 먼저 지운다
    await db.query('DELETE FROM "Todo" WHERE "userId" = ANY($1::text[])', [userIds]);
    await db.query('DELETE FROM "Notification" WHERE "friendId" = ANY($1::text[])', [userIds]);
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
    fail(`삭제 중 오류로 되돌렸습니다: ${message}`);
  }
}

function demoEmails(content: LocaleContent, locale: Locale): string[] {
  return [
    ...ROLES.map((role) => content.owners[role].email),
    ...content.friends
      .filter((friend) => friend.account !== 'grant')
      .map((f) => friendEmail(f.key, locale)),
    friendEmail(content.stranger.key, locale),
  ];
}

// ---------- 씨드 ----------

interface Owner {
  role: Role;
  id: string;
  email: string;
  password: string;
  name: string;
}

interface SeedState {
  locale: Locale;
  content: LocaleContent;
  today: string;
  owners: Record<Role, Owner>;
  friendIds: Map<string, string>;
  strangerId: string;
  categoryIds: Map<string, Map<string, number>>;
  todayTodoIds: Map<string, Map<string, number>>;
  friendTodayTodoIds: Map<string, Map<string, number>>;
}

async function upsertProfile(
  ctx: Context,
  userId: string,
  input: { name: string; icon: string; timezone: string; locale: Locale; timeFormat: string },
): Promise<void> {
  const { db } = ctx;
  await db.query(
    `INSERT INTO "UserProfile" ("id", "userId", "name", "profileImage") VALUES ($1, $2, $3, $4)
     ON CONFLICT ("userId") DO UPDATE SET "name" = EXCLUDED."name", "profileImage" = EXCLUDED."profileImage"`,
    [cuidLike(), userId, input.name, input.icon],
  );
  await db.query(
    `INSERT INTO "UserPreference" ("id", "userId", "pushEnabled", "timezone", "locale", "timeFormat")
     VALUES ($1, $2, true, $3, $4, $5)
     ON CONFLICT ("userId") DO UPDATE SET "pushEnabled" = true, "timezone" = EXCLUDED."timezone",
       "locale" = EXCLUDED."locale", "timeFormat" = EXCLUDED."timeFormat"`,
    [cuidLike(), userId, input.timezone, input.locale, input.timeFormat],
  );
  const agreedAt = utc(ctx.now);
  await db.query(
    `INSERT INTO "UserConsent" ("id", "userId", "termsAgreedAt", "privacyAgreedAt", "marketingAgreedAt", "marketingPushAgreedAt")
     VALUES ($1, $2, $3, $3, $3, $3)
     ON CONFLICT ("userId") DO UPDATE SET "marketingAgreedAt" = EXCLUDED."marketingAgreedAt",
       "marketingPushAgreedAt" = EXCLUDED."marketingPushAgreedAt"`,
    [cuidLike(), userId, agreedAt],
  );
}

async function createOwner(
  ctx: Context,
  state: Pick<SeedState, 'content' | 'locale'>,
  role: Role,
  createdDaysAgo: number,
): Promise<Owner> {
  const spec = state.content.owners[role];
  const password = randomPassword();
  await register(ctx.target, { email: spec.email, password, name: spec.name });
  const id =
    (await findUserId(ctx.db, spec.email)) ?? fail(`${role} 계정을 DB에서 찾지 못했습니다.`);
  const createdAt = utc(new Date(ctx.now.getTime() - createdDaysAgo * DAY_MS));
  await ctx.db.query(
    `UPDATE "User" SET "emailVerifiedAt" = $2, "status" = 'ACTIVE', "createdAt" = $2, "updatedAt" = $3,
       "aiUsageCount" = 0, "aiUsageResetAt" = $3 WHERE "id" = $1`,
    [id, createdAt, utc(ctx.now)],
  );
  await upsertProfile(ctx, id, {
    name: spec.name,
    icon: spec.icon,
    timezone: state.content.timezone,
    locale: state.locale,
    timeFormat: state.content.timeFormat,
  });
  // 가입 때 생긴 기본 카테고리는 지우고 데모 카테고리로 채운다(무료 한도 3개)
  await ctx.db.query('DELETE FROM "TodoCategory" WHERE "userId" = $1', [id]);
  return { role, id, email: spec.email, password, name: spec.name };
}

async function createDbUser(
  ctx: Context,
  state: Pick<SeedState, 'content' | 'locale'>,
  input: { email: string; name: string; icon: string; createdDaysAgo: number },
): Promise<string> {
  const id = cuidLike();
  const createdAt = utc(new Date(ctx.now.getTime() - input.createdDaysAgo * DAY_MS));
  await ctx.db.query(
    `INSERT INTO "User" ("id", "email", "userTag", "status", "emailVerifiedAt", "createdAt", "updatedAt", "lastActiveAt")
     VALUES ($1, $2, $3, 'ACTIVE', $4, $4, $5, $5)`,
    [id, input.email, randomTag(), createdAt, utc(ctx.now)],
  );
  await upsertProfile(ctx, id, {
    name: input.name,
    icon: input.icon,
    timezone: state.content.timezone,
    locale: state.locale,
    timeFormat: state.content.timeFormat,
  });
  return id;
}

async function createCategories(
  ctx: Context,
  userId: string,
  categories: readonly { key: string; name: string; color: string }[],
): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const [index, category] of categories.entries()) {
    const id = await insertReturningId(
      ctx.db,
      `INSERT INTO "TodoCategory" ("userId", "name", "color", "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [userId, category.name, category.color, index, utc(ctx.now)],
    );
    ids.set(category.key, id);
  }
  return ids;
}

interface TodoInsert {
  userId: string;
  title: string;
  categoryId: number;
  date: string;
  time: string | null;
  done: boolean;
  sortOrder: number;
  recurrenceGroupId: string | null;
  timezone: string;
}

async function insertTodo(ctx: Context, todo: TodoInsert): Promise<number> {
  const scheduled = todo.time === null ? null : instant(todo.date, todo.time, todo.timezone);
  const completedAt = todo.done
    ? utc(
        new Date((scheduled ?? instant(todo.date, '20:30', todo.timezone)).getTime() + 25 * 60_000),
      )
    : null;
  const createdAt = utc(
    new Date(instant(todo.date, '00:00', todo.timezone).getTime() - 2 * DAY_MS),
  );
  return insertReturningId(
    ctx.db,
    `INSERT INTO "Todo" ("userId", "title", "categoryId", "sortOrder", "completed", "completedAt", "startDate",
       "scheduledTime", "isAllDay", "visibility", "recurrenceGroupId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PUBLIC', $10, $11, $11)`,
    [
      todo.userId,
      todo.title,
      todo.categoryId,
      todo.sortOrder,
      todo.done,
      completedAt,
      todo.date,
      scheduled === null ? null : utc(scheduled),
      scheduled === null,
      todo.recurrenceGroupId,
      createdAt,
    ],
  );
}

interface PlannedTodo {
  title: string;
  category: string;
  time: string | null;
  done: boolean;
  recurrenceKey: string | null;
  items?: readonly { title: string; done: boolean }[];
  detail?: boolean;
}

/** 하루치 할 일 계획. 과거는 약 85% 완료, 오늘은 오전 일만 완료, 미래는 미완료 */
function planDay(
  content: LocaleContent,
  role: 'premium' | 'free',
  offset: number,
  date: string,
): PlannedTodo[] {
  const dow = dayOfWeek(date);
  const isFree = role === 'free';
  const freeCategory = (key: string) =>
    isFree && !content.categories.some((category) => category.key === key && category.free)
      ? 'life'
      : key;
  const doneFor = (title: string, time: string | null) => {
    if (offset < 0) {
      return stableRoll(title, date) < 85;
    }
    if (offset === 0) {
      return time !== null && time < '12:00';
    }
    return false;
  };
  const plan: PlannedTodo[] = [];
  for (const routine of content.routines) {
    if (!routine.days.includes(dow) || (isFree && !routine.free)) {
      continue;
    }
    plan.push({
      title: routine.title,
      category: freeCategory(routine.category),
      time: routine.time,
      done: doneFor(routine.title, routine.time),
      recurrenceKey: routine.title,
    });
  }
  for (const oneOff of content.oneOffs) {
    if (oneOff.offset !== offset || (isFree && !oneOff.free)) {
      continue;
    }
    plan.push({
      title: oneOff.title,
      category: freeCategory(oneOff.category),
      time: oneOff.time,
      done: oneOff.done,
      recurrenceKey: null,
      items: oneOff.items,
      detail: oneOff.detail,
    });
  }
  const weekend = dow === 'SAT' || dow === 'SUN';
  const fillers = weekend ? content.weekendFillers : content.weekdayFillers;
  const fillerCount = isFree ? 1 : 2;
  const dayNumber = Math.abs(offset) + 100;
  for (let index = 0; index < fillerCount && fillers.length > 0; index += 1) {
    const filler = fillers[(dayNumber * 2 + index) % fillers.length];
    if (filler === undefined || plan.some((todo) => todo.title === filler.title)) {
      continue;
    }
    plan.push({
      title: filler.title,
      category: freeCategory(filler.category),
      time: filler.time,
      done: doneFor(filler.title, filler.time),
      recurrenceKey: null,
    });
  }
  return plan.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
}

async function seedOwnerTodos(
  ctx: Context,
  state: SeedState,
  owner: Owner,
  role: 'premium' | 'free',
  fromOffset: number,
  toOffset: number,
): Promise<void> {
  const { content } = state;
  const categoryIds = state.categoryIds.get(owner.id) ?? fail('카테고리가 없습니다.');
  const groupIds = new Map<string, string>();
  const todayIds = new Map<string, number>();
  const dayTotals: { date: string; total: number; completed: number }[] = [];

  for (let offset = fromOffset; offset <= toOffset; offset += 1) {
    const date = addDays(state.today, offset);
    const plan = planDay(content, role, offset, date);
    let completed = 0;
    for (const [index, todo] of plan.entries()) {
      const categoryId = categoryIds.get(todo.category) ?? categoryIds.values().next().value;
      if (categoryId === undefined) {
        continue;
      }
      let groupId: string | null = null;
      if (todo.recurrenceKey !== null) {
        groupId = groupIds.get(todo.recurrenceKey) ?? randomUUID();
        groupIds.set(todo.recurrenceKey, groupId);
      }
      const id = await insertTodo(ctx, {
        userId: owner.id,
        title: todo.title,
        categoryId,
        date,
        time: todo.time,
        done: todo.done,
        sortOrder: index,
        recurrenceGroupId: groupId,
        timezone: content.timezone,
      });
      if (todo.done) {
        completed += 1;
      }
      if (offset === 0) {
        todayIds.set(todo.title, id);
      }
      if (todo.detail === true && offset === 0) {
        ctx.env.set(envKey(state.locale, role, 'TODO_ID'), String(id));
      }
      if (todo.items !== undefined) {
        for (const [itemIndex, item] of todo.items.entries()) {
          await ctx.db.query(
            `INSERT INTO "TodoItem" ("todoId", "title", "completed", "sortOrder", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $5)`,
            [id, item.title, item.done, itemIndex, utc(ctx.now)],
          );
        }
        ctx.env.set(envKey(state.locale, role, 'CHECKLIST_TODO_ID'), String(id));
      }
      // 다음 반복 할 일(오늘 이후 첫 회차)은 반복 편집 화면에 쓴다
      if (
        groupId !== null &&
        offset > 0 &&
        !ctx.env.has(envKey(state.locale, role, 'RECURRING_TODO_ID'))
      ) {
        ctx.env.set(envKey(state.locale, role, 'RECURRING_TODO_ID'), String(id));
        ctx.env.set(envKey(state.locale, role, 'RECURRING_DATE'), date);
      }
    }
    if (offset < 0 && plan.length > 0) {
      dayTotals.push({ date, total: plan.length, completed });
    }
  }
  state.todayTodoIds.set(owner.id, todayIds);

  // 다 끝낸 날의 완료 기록, 연속 기록, 지난 주차 달성 기록
  for (const day of dayTotals) {
    if (day.completed === day.total) {
      await ctx.db.query(
        `INSERT INTO "DailyCompletion" ("id", "userId", "date", "totalTodos", "completedTodos", "achievedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $4, $5, $5, $5)`,
        [
          cuidLike(),
          owner.id,
          day.date,
          day.total,
          utc(instant(day.date, '22:00', content.timezone)),
        ],
      );
    }
  }
  const allDone = (date: string) =>
    dayTotals.some((day) => day.date === date && day.completed === day.total);
  let streak = 0;
  while (allDone(addDays(state.today, -(streak + 1)))) {
    streak += 1;
  }
  let longest = 0;
  let run = 0;
  for (const day of dayTotals) {
    run = day.completed === day.total ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  await ctx.db.query(
    `UPDATE "UserPreference" SET "currentStreak" = $2, "longestStreak" = $3, "lastCompletedDate" = $4 WHERE "userId" = $1`,
    [owner.id, streak, Math.max(longest, streak), streak > 0 ? addDays(state.today, -1) : null],
  );
  const weeks = new Map<string, { year: number; week: number; total: number; completed: number }>();
  for (const day of dayTotals) {
    const { year, week } = isoWeek(day.date);
    const key = `${year}-${week}`;
    const entry = weeks.get(key) ?? { year, week, total: 0, completed: 0 };
    entry.total += day.total;
    entry.completed += day.completed;
    weeks.set(key, entry);
  }
  const currentWeek = isoWeek(state.today);
  for (const entry of weeks.values()) {
    if (entry.year === currentWeek.year && entry.week === currentWeek.week) {
      continue;
    }
    await ctx.db.query(
      `INSERT INTO "WeeklyAchievement" ("userId", "year", "week", "totalTodos", "completedTodos", "achievedAt", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [owner.id, entry.year, entry.week, entry.total, entry.completed, utc(ctx.now)],
    );
  }
}

function isoWeek(dateKey: string): { year: number; week: number } {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const day = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

async function seedFriendTodos(ctx: Context, state: SeedState): Promise<void> {
  const { content } = state;
  const dailyName = state.locale === 'ko' ? '일상' : 'Daily';
  for (const friend of content.friends) {
    const friendId = state.friendIds.get(friend.key);
    if (friendId === undefined) {
      continue;
    }
    const categories =
      state.categoryIds.get(friendId) ??
      (await createCategories(ctx, friendId, [
        { key: 'daily', name: dailyName, color: '#20C997' },
      ]));
    state.categoryIds.set(friendId, categories);
    const categoryId = categories.values().next().value;
    if (categoryId === undefined) {
      continue;
    }
    const todayIds = new Map<string, number>();
    for (const [index, todo] of friend.todos.entries()) {
      const id = await insertTodo(ctx, {
        userId: friendId,
        title: todo.title,
        categoryId,
        date: state.today,
        time: todo.time,
        done: todo.done,
        sortOrder: index,
        recurrenceGroupId: null,
        timezone: content.timezone,
      });
      todayIds.set(todo.title, id);
    }
    // 친구 캘린더가 비어 보이지 않게 지난 3일도 조금 채운다
    for (let offset = -3; offset <= -1; offset += 1) {
      for (const [index, todo] of friend.todos.slice(0, 2).entries()) {
        await insertTodo(ctx, {
          userId: friendId,
          title: todo.title,
          categoryId,
          date: addDays(state.today, offset),
          time: todo.time,
          done: stableRoll(friend.key, todo.title, String(offset)) < 80,
          sortOrder: index,
          recurrenceGroupId: null,
          timezone: content.timezone,
        });
      }
    }
    state.friendTodayTodoIds.set(friendId, todayIds);
  }
}

async function befriend(
  ctx: Context,
  a: string,
  b: string,
  sortOrder: number,
  daysAgo: number,
): Promise<void> {
  const createdAt = utc(new Date(ctx.now.getTime() - daysAgo * DAY_MS));
  const edges: [string, string][] = [
    [a, b],
    [b, a],
  ];
  for (const [follower, following] of edges) {
    await ctx.db.query(
      `INSERT INTO "Follow" ("id", "followerId", "followingId", "status", "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ACCEPTED', $4, $5, $5)
       ON CONFLICT ("followerId", "followingId") DO NOTHING`,
      [cuidLike(), follower, following, sortOrder, createdAt],
    );
  }
}

async function addNotification(
  ctx: Context,
  input: {
    userId: string;
    type: string;
    title: string;
    body: string;
    minutesAgo: number;
    isRead?: boolean;
    todoId?: number;
    friendId?: string;
    nudgeId?: number;
    cheerId?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const createdAt = new Date(ctx.now.getTime() - input.minutesAgo * 60_000);
  await ctx.db.query(
    `INSERT INTO "Notification" ("userId", "type", "title", "body", "isRead", "todoId", "friendId", "nudgeId",
       "cheerId", "metadata", "createdAt", "readAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      input.userId,
      input.type,
      input.title,
      input.body,
      input.isRead ?? false,
      input.todoId ?? null,
      input.friendId ?? null,
      input.nudgeId ?? null,
      input.cheerId ?? null,
      input.metadata === undefined ? null : JSON.stringify(input.metadata),
      utc(createdAt),
      input.isRead === true ? utc(createdAt) : null,
    ],
  );
}

function fill(template: string | undefined, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template ?? '',
  );
}

async function seedSocial(ctx: Context, state: SeedState, owner: Owner): Promise<void> {
  const { content } = state;
  const isPremium = owner.role === 'premium';
  const friendsOf = content.friends.filter((friend) => isPremium || friend.freeFriend);
  for (const [index, friend] of friendsOf.entries()) {
    const friendId = state.friendIds.get(friend.key);
    if (friendId !== undefined) {
      await befriend(ctx, owner.id, friendId, index, friend.joinedDaysAgo ?? 30 + index);
    }
  }
  const nameOf = (key: string) => content.friends.find((friend) => friend.key === key)?.name ?? '';
  const ownerToday = state.todayTodoIds.get(owner.id) ?? new Map<string, number>();

  // 받은 콕(메시지 포함)
  const nudgeFrom = state.friendIds.get(content.nudge.from);
  const nudgeTodoId = ownerToday.get(content.nudge.todo);
  if (nudgeFrom !== undefined && nudgeTodoId !== undefined) {
    const nudgeId = await insertReturningId(
      ctx.db,
      `INSERT INTO "Nudge" ("senderId", "receiverId", "todoId", "message", "createdAt") VALUES ($1, $2, $3, $4, $5)`,
      [
        nudgeFrom,
        owner.id,
        nudgeTodoId,
        content.nudge.message,
        utc(new Date(ctx.now.getTime() - 18 * 60_000)),
      ],
    );
    ctx.env.set(envKey(state.locale, owner.role, 'NUDGE_ID'), String(nudgeId));
    ctx.env.set(envKey(state.locale, owner.role, 'FRIEND_ID'), nudgeFrom);
    await addNotification(ctx, {
      userId: owner.id,
      type: 'NUDGE_RECEIVED',
      title: fill(content.copy.nudgeWithMessageTitle, { name: nameOf(content.nudge.from) }),
      body: fill(content.copy.nudgeWithMessageBody, {
        todo: content.nudge.todo,
        message: content.nudge.message,
      }),
      minutesAgo: 18,
      todoId: nudgeTodoId,
      friendId: nudgeFrom,
      nudgeId,
    });
  }

  // 보낸 콕
  const sentTo = state.friendIds.get(content.sentNudge.to);
  const sentTodoId =
    sentTo === undefined
      ? undefined
      : state.friendTodayTodoIds.get(sentTo)?.get(content.sentNudge.todo);
  if (sentTo !== undefined && sentTodoId !== undefined) {
    await ctx.db.query(
      `INSERT INTO "Nudge" ("senderId", "receiverId", "todoId", "message", "createdAt", "readAt", "replyKind", "repliedAt")
       VALUES ($1, $2, $3, $4, $5, $5, 'THANKFUL', $5)`,
      [
        owner.id,
        sentTo,
        sentTodoId,
        content.sentNudge.message,
        utc(new Date(ctx.now.getTime() - 95 * 60_000)),
      ],
    );
  }

  // 응원
  const cheerFrom = state.friendIds.get(content.cheer.from);
  if (cheerFrom !== undefined) {
    const cheerId = await insertReturningId(
      ctx.db,
      `INSERT INTO "Cheer" ("senderId", "receiverId", "message", "createdAt") VALUES ($1, $2, $3, $4)`,
      [
        cheerFrom,
        owner.id,
        content.cheer.message,
        utc(new Date(ctx.now.getTime() - 3 * 3_600_000)),
      ],
    );
    await addNotification(ctx, {
      userId: owner.id,
      type: 'CHEER_RECEIVED',
      title: fill(content.copy.cheerTitle, { name: nameOf(content.cheer.from) }),
      body: content.cheer.message,
      minutesAgo: 180,
      friendId: cheerFrom,
      cheerId,
    });
  }

  for (const friend of friendsOf) {
    const friendId = state.friendIds.get(friend.key);
    if (friendId === undefined) {
      continue;
    }
    if (friend.allDone === true) {
      await addNotification(ctx, {
        userId: owner.id,
        type: 'FRIEND_COMPLETED',
        title: fill(content.copy.friendCompletedTitle, { name: friend.name }),
        body: content.copy.friendCompletedBody ?? '',
        minutesAgo: 62,
        friendId,
      });
    }
  }
  const lastFriend = friendsOf.find(
    (friend) => friend.key !== content.nudge.from && friend.invite === undefined,
  );
  const lastFriendId = lastFriend === undefined ? undefined : state.friendIds.get(lastFriend.key);
  if (lastFriend !== undefined && lastFriendId !== undefined) {
    await addNotification(ctx, {
      userId: owner.id,
      type: 'FOLLOW_ACCEPTED',
      title: fill(content.copy.followAcceptedTitle, { name: lastFriend.name }),
      body: content.copy.followAcceptedBody ?? '',
      minutesAgo: 5 * 24 * 60,
      isRead: true,
      friendId: lastFriendId,
    });
  }
}

async function seedMemos(ctx: Context, state: SeedState, owner: Owner): Promise<void> {
  const memos = state.content.memos.filter((memo) => owner.role === 'premium' || memo.free);
  for (const [index, memo] of memos.entries()) {
    const createdAt = utc(new Date(ctx.now.getTime() - (index * 2 + 1) * DAY_MS));
    const id = await insertReturningId(
      ctx.db,
      `INSERT INTO "Memo" ("userId", "content", "isPinned", "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [owner.id, memo.content, memo.pinned, index, createdAt],
    );
    if (memo.ai === true) {
      ctx.env.set(envKey(state.locale, owner.role, 'MEMO_ID'), String(id));
    }
  }
}

async function ensureInvite(ctx: Context, owner: Owner): Promise<{ id: string; code: string }> {
  // 초대 코드는 실제 API(GET /v1/invites/me)로 만든다. 기능 플래그가 꺼져 있으면 로컬 DB에 같은 모양으로 넣는다
  const token = await login(ctx.target, owner.email, owner.password);
  const response = await callApi(ctx.target, 'GET', '/v1/invites/me', token);
  const code = response.ok ? findInviteCode(response.json) : null;
  if (code !== null) {
    const { rows } = await ctx.db.query('SELECT "id" FROM "Invite" WHERE "code" = $1', [code]);
    const id = rows[0]?.id;
    if (typeof id === 'string') {
      return { id, code };
    }
  }
  log(
    `초대 API가 ${response.status}로 응답해 로컬 DB에 초대 코드를 만듭니다(INVITE_ENABLED 확인).`,
  );
  const fallbackCode = randomTag().slice(0, 6);
  const id = cuidLike();
  await ctx.db.query(
    `INSERT INTO "Invite" ("id", "inviterId", "code", "status", "createdAt", "updatedAt") VALUES ($1, $2, $3, 'ACTIVE', $4, $4)`,
    [id, owner.id, fallbackCode, utc(ctx.now)],
  );
  return { id, code: fallbackCode };
}

/**
 * 초대 보상 상태를 실제 지급 결과와 같은 행으로 만든다. 활동일은 지난 날짜라 API로 기록할 수 없다.
 * - rewarded: 수락 → 2일 활동 → 초대자 프리미엄 7일(구독 중이라 BANKED)·친구 한도 +1, 초대받은 사람 프리미엄 7일
 * - waiting: 수락 후 활동 1일(D-1)
 */
async function seedInvites(ctx: Context, state: SeedState, premium: Owner): Promise<void> {
  const { content } = state;
  const invite = await ensureInvite(ctx, premium);
  ctx.env.set(envKey(state.locale, 'INVITE_CODE'), invite.code);
  ctx.env.set(envKey(state.locale, 'PREMIUM_USER_ID'), premium.id);

  for (const friend of content.friends) {
    const inviteeId = state.friendIds.get(friend.key);
    if (friend.invite === undefined || inviteeId === undefined) {
      continue;
    }
    const joinedAt = new Date(ctx.now.getTime() - (friend.joinedDaysAgo ?? 7) * DAY_MS);
    const qualifiedAt = new Date(joinedAt.getTime() + 2 * DAY_MS);
    const redemptionId = cuidLike();
    const rewarded = friend.invite === 'rewarded';
    await ctx.db.query(
      `INSERT INTO "InviteRedemption" ("id", "inviteId", "inviterId", "inviteeId", "status", "joinedAt", "qualifiedAt",
         "rewardedAt", "expiresAt", "createdAt", "updatedAt", "timezone", "inviterRewardEligible")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $6, $9, $10, true)`,
      [
        redemptionId,
        invite.id,
        premium.id,
        inviteeId,
        rewarded ? 'REWARDED' : 'JOINED',
        utc(joinedAt),
        rewarded ? utc(qualifiedAt) : null,
        utc(new Date(joinedAt.getTime() + 14 * DAY_MS)),
        utc(ctx.now),
        content.timezone,
      ],
    );
    const activeDays = rewarded ? 2 : 1;
    for (let day = 0; day < activeDays; day += 1) {
      await ctx.db.query(
        `INSERT INTO "InviteActiveDay" ("redemptionId", "localDate", "createdAt") VALUES ($1, $2, $3)`,
        [
          redemptionId,
          localDate(new Date(joinedAt.getTime() + day * DAY_MS), content.timezone),
          utc(joinedAt),
        ],
      );
    }
    if (rewarded) {
      const grants = [
        { recipient: premium.id, type: 'PREMIUM_DAYS', quantity: 7 },
        { recipient: premium.id, type: 'FRIEND_SLOT', quantity: 1 },
        { recipient: inviteeId, type: 'PREMIUM_DAYS', quantity: 7 },
      ];
      for (const grant of grants) {
        const grantId = cuidLike();
        await ctx.db.query(
          `INSERT INTO "RewardGrant" ("id", "recipientId", "sourceType", "sourceId", "rewardType", "quantity", "status",
             "attempts", "createdAt", "updatedAt", "appliedAt")
           VALUES ($1, $2, 'INVITE_REDEMPTION', $3, $4, $5, 'APPLIED', 1, $6, $6, $6)`,
          [grantId, grant.recipient, redemptionId, grant.type, grant.quantity, utc(qualifiedAt)],
        );
        const sourceKey = `reward-grant:${grantId}`;
        if (grant.type === 'FRIEND_SLOT') {
          await ctx.db.query(
            `INSERT INTO "ResourceBonus" ("id", "userId", "resource", "quantity", "sourceKey", "createdAt")
             VALUES ($1, $2, 'FRIEND', 1, $3, $4)`,
            [cuidLike(), grant.recipient, sourceKey, utc(qualifiedAt)],
          );
          continue;
        }
        if (grant.recipient === premium.id) {
          // 스토어 구독 중이라 끝난 뒤 이어 쓰도록 쌓아 둔다
          await ctx.db.query(
            `INSERT INTO "PremiumGrant" ("id", "userId", "source", "sourceKey", "durationDays", "status", "createdAt", "updatedAt")
             VALUES ($1, $2, 'INVITE', $3, 7, 'BANKED', $4, $4)`,
            [cuidLike(), premium.id, sourceKey, utc(qualifiedAt)],
          );
          continue;
        }
        // 초대받은 사람: grant 계정은 내일 끝나는 보상 기간(D-1 안내), 나머지는 이미 끝난 기간
        const isGrantAccount = friend.account === 'grant';
        const endsAt = isGrantAccount
          ? instant(addDays(state.today, 1), '12:00', content.timezone)
          : new Date(qualifiedAt.getTime() + 7 * DAY_MS);
        const startsAt = new Date(endsAt.getTime() - 7 * DAY_MS);
        await ctx.db.query(
          `INSERT INTO "PremiumGrant" ("id", "userId", "source", "sourceKey", "durationDays", "status", "startsAt", "endsAt",
             "createdAt", "updatedAt", "endingNotifiedAt")
           VALUES ($1, $2, 'INVITE', $3, 7, $4, $5, $6, $7, $7, $8)`,
          [
            cuidLike(),
            inviteeId,
            sourceKey,
            isGrantAccount ? 'ACTIVE' : 'ENDED',
            utc(startsAt),
            utc(endsAt),
            utc(qualifiedAt),
            // 끝나기 24시간 전 안내 작업이 같은 알림을 한 번 더 만들지 않게, 아래에서 넣는 알림 시각으로 발송 완료를 표시한다
            isGrantAccount ? utc(new Date(ctx.now.getTime() - 40 * 60_000)) : null,
          ],
        );
        if (isGrantAccount) {
          await ctx.db.query(
            `UPDATE "User" SET "subscriptionStatus" = 'ACTIVE', "subscriptionExpiresAt" = $2 WHERE "id" = $1`,
            [inviteeId, utc(endsAt)],
          );
          await addNotification(ctx, {
            userId: inviteeId,
            type: 'PREMIUM_GRANT_ENDING',
            title: content.copy.grantEndingTitle ?? '',
            body: content.copy.grantEndingBody ?? '',
            minutesAgo: 40,
          });
        }
      }
      await addNotification(ctx, {
        userId: premium.id,
        type: 'INVITE_REWARDED',
        title: content.copy.inviteRewardedTitle ?? '',
        body: content.copy.inviteRewardedBody ?? '',
        minutesAgo: Math.round((ctx.now.getTime() - qualifiedAt.getTime()) / 60_000),
        isRead: true,
        friendId: inviteeId,
      });
    } else {
      await addNotification(ctx, {
        userId: premium.id,
        type: 'INVITE_JOINED',
        title: fill(content.copy.inviteJoinedTitle, { name: friend.name }),
        body: content.copy.inviteJoinedBody ?? '',
        minutesAgo: Math.round((ctx.now.getTime() - joinedAt.getTime()) / 60_000),
        friendId: inviteeId,
      });
    }
  }
}

async function seedStoreSubscription(ctx: Context, owner: Owner): Promise<void> {
  const startedAt = new Date(ctx.now.getTime() - 40 * DAY_MS);
  const expiresAt = new Date(startedAt.getTime() + 365 * DAY_MS);
  await ctx.db.query(
    `INSERT INTO "Subscription" ("userId", "revenueCatId", "productId", "status", "startedAt", "expiresAt", "createdAt", "updatedAt")
     VALUES ($1, $2, 'aido_premium_annual', 'ACTIVE', $3, $4, $3, $3)`,
    [owner.id, `demo_${randomBytes(8).toString('hex')}`, utc(startedAt), utc(expiresAt)],
  );
  // 스토어 구독 행은 User projection이 ACTIVE일 때만 믿는다(PremiumAccessPolicy)
  await ctx.db.query(
    `UPDATE "User" SET "subscriptionStatus" = 'ACTIVE', "subscriptionExpiresAt" = $2 WHERE "id" = $1`,
    [owner.id, utc(expiresAt)],
  );
}

async function seedLocale(ctx: Context, locale: Locale, content: LocaleContent): Promise<void> {
  log(`[${locale}] 기존 데모 계정을 지웁니다.`);
  await resetLocale(ctx, locale, content);
  const today = localDate(ctx.now, content.timezone);
  ctx.env.set('SCREENS_TODAY', today);
  ctx.env.set('SCREENS_YESTERDAY', addDays(today, -1));

  const partial = { content, locale };
  log(`[${locale}] 로그인 계정 4개를 가입 API로 만듭니다(분당 제한 때문에 몇 분 걸릴 수 있음).`);
  const premium = await createOwner(ctx, partial, 'premium', 60);
  // 프리미엄 상태는 첫 로그인 전에 넣어 엔타이틀먼트 캐시에 무료가 남지 않게 한다
  await seedStoreSubscription(ctx, premium);
  const free = await createOwner(ctx, partial, 'free', 14);
  const grantFriend = content.friends.find((friend) => friend.account === 'grant');
  const grant = await createOwner(ctx, partial, 'grant', grantFriend?.joinedDaysAgo ?? 7);
  const newbie = await createOwner(ctx, partial, 'newbie', 0);
  await ctx.db.query(
    `UPDATE "User" SET "aiUsageCount" = 5 WHERE "id" = $1`, // 무료 월 5회를 다 쓴 상태(한도 안내 화면)
    [free.id],
  );

  const state: SeedState = {
    locale,
    content,
    today,
    owners: { premium, free, grant, newbie },
    friendIds: new Map(),
    strangerId: '',
    categoryIds: new Map(),
    todayTodoIds: new Map(),
    friendTodayTodoIds: new Map(),
  };
  for (const owner of [premium, free, grant, newbie]) {
    ctx.env.set(envKey(locale, owner.role, 'EMAIL'), owner.email);
    ctx.env.set(envKey(locale, owner.role, 'PASSWORD'), owner.password);
    ctx.env.set(envKey(locale, owner.role, 'NAME'), owner.name);
  }

  log(`[${locale}] 친구·카테고리·할 일·메모를 채웁니다.`);
  for (const [index, friend] of content.friends.entries()) {
    const id =
      friend.account === 'grant'
        ? grant.id
        : await createDbUser(ctx, partial, {
            email: friendEmail(friend.key, locale),
            name: friend.name,
            icon: friend.icon,
            createdDaysAgo: (friend.joinedDaysAgo ?? 40) + index,
          });
    state.friendIds.set(friend.key, id);
  }
  state.strangerId = await createDbUser(ctx, partial, {
    email: friendEmail(content.stranger.key, locale),
    name: content.stranger.name,
    icon: content.stranger.icon,
    createdDaysAgo: 3,
  });
  ctx.env.set(envKey(locale, 'STRANGER_NAME'), content.stranger.name);

  state.categoryIds.set(premium.id, await createCategories(ctx, premium.id, content.categories));
  state.categoryIds.set(
    free.id,
    await createCategories(
      ctx,
      free.id,
      content.categories.filter((category) => category.free),
    ),
  );
  // 서연(grant)은 친구로서의 오늘 할 일만 가진다(seedFriendTodos)
  state.categoryIds.set(
    newbie.id,
    await createCategories(ctx, newbie.id, content.categories.slice(0, 1)),
  );

  await seedOwnerTodos(ctx, state, premium, 'premium', -35, 7);
  await seedOwnerTodos(ctx, state, free, 'free', -10, 3);
  await seedFriendTodos(ctx, state);
  await seedSocial(ctx, state, premium);
  await seedSocial(ctx, state, free);
  // 받은 친구 요청 1건(프리미엄의 받은 요청 탭). 무료 계정은 같은 사람에게 추가를 눌러 친구 한도 안내를 본다
  await ctx.db.query(
    `INSERT INTO "Follow" ("id", "followerId", "followingId", "status", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'PENDING', $4, $4)`,
    [cuidLike(), state.strangerId, premium.id, utc(new Date(ctx.now.getTime() - 50 * 60_000))],
  );
  await seedMemos(ctx, state, premium);
  await seedMemos(ctx, state, free);
  for (const owner of [premium, free]) {
    await ctx.db.query(
      `INSERT INTO "UserLocation" ("id", "userId", "latitude", "longitude", "gridX", "gridY", "updatedAt")
       VALUES ($1, $2, 37.5446, 127.0557, 61, 127, $3) ON CONFLICT ("userId") DO NOTHING`,
      [cuidLike(), owner.id, utc(ctx.now)],
    );
  }
  log(`[${locale}] 초대·보상 상태를 만듭니다.`);
  await seedInvites(ctx, state, premium);
  writeEnvFile(ctx.env);
}

// ---------- AI ----------

async function waitFor<T>(
  check: () => Promise<T | null>,
  timeoutMs: number,
  label: string,
): Promise<T | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await check();
    if (value !== null) {
      return value;
    }
    await sleep(5_000);
  }
  log(`${label}: ${Math.round(timeoutMs / 1000)}초 안에 결과가 오지 않았습니다.`);
  return null;
}

async function runAiForLocale(ctx: Context, locale: Locale, content: LocaleContent): Promise<void> {
  const email = ctx.env.get(envKey(locale, 'premium', 'EMAIL'));
  const password = ctx.env.get(envKey(locale, 'premium', 'PASSWORD'));
  if (email === undefined || password === undefined) {
    fail(`[${locale}] .env.screens에 프리미엄 계정이 없습니다. 먼저 seed를 실행하세요.`);
  }
  const userId = (await findUserId(ctx.db, email)) ?? fail('프리미엄 계정을 찾지 못했습니다.');
  const token = await login(ctx.target, email, password);
  const timeoutMs = Number(process.env.SCREENS_AI_TIMEOUT_SECONDS ?? '300') * 1000;
  const today = localDate(ctx.now, content.timezone);

  // 1) parse-todo: 자연어 문장을 실제 AI로 할 일로 바꿔 저장한다
  const { rows: categoryRows } = await ctx.db.query(
    'SELECT "id", "name" FROM "TodoCategory" WHERE "userId" = $1 ORDER BY "sortOrder"',
    [userId],
  );
  const lifeName = content.categories.find((category) => category.key === 'life')?.name;
  const categoryId =
    categoryRows.find((row) => row.name === lifeName)?.id ?? categoryRows[0]?.id ?? null;
  let parsedCount = 0;
  for (const text of content.aiPrompts) {
    const response = await callApi(ctx.target, 'POST', '/v1/ai/parse-todo', token, {
      text,
      ...(typeof categoryId === 'number' ? { categoryId } : {}),
    });
    const parsed = response.ok ? findParsedTodo(response.json) : null;
    if (parsed === null || typeof categoryId !== 'number') {
      log(`[${locale}] parse-todo 실패(${response.status}). 이 문장은 건너뜁니다.`);
      continue;
    }
    parsedCount += 1;
    const dates =
      parsed.isRecurring === true && parsed.recurrence != null
        ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
            .map((offset) => addDays(today, offset))
            .filter((date) => parsed.recurrence?.daysOfWeek.includes(dayOfWeek(date)))
        : [parsed.startDate];
    const groupId = dates.length > 1 ? randomUUID() : null;
    for (const date of dates) {
      await insertTodo(ctx, {
        userId,
        title: parsed.title,
        categoryId,
        date,
        time: parsed.isAllDay ? null : parsed.scheduledTime,
        done: false,
        sortOrder: 50,
        recurrenceGroupId: groupId,
        timezone: content.timezone,
      });
    }
  }
  ctx.env.set(envKey(locale, 'AI_PARSE_TODO'), `${parsedCount}/${content.aiPrompts.length}`);

  // 2) 리포트·반복 제안: 서버 worker가 처리하는 job을 넣는다(실제 Gemini 호출은 서버가 한다)
  const boss = await openJobQueue(ctx.target.databaseUrl);
  const stamp = Date.now();
  try {
    for (const reportType of ['WEEKLY', 'MONTHLY'] as const) {
      await boss.send(
        AI_REPORT_QUEUE,
        {
          name: 'generate-report',
          data: { userId, timezone: content.timezone, locale, reportType },
        },
        { singletonKey: `screens_${reportType}_${userId}_${stamp}`, retryLimit: 1 },
      );
    }
    await boss.send(
      AI_SUGGESTION_QUEUE,
      {
        name: 'analyze-suggestion',
        data: { userId, timezone: content.timezone, weatherGrid: null },
      },
      { singletonKey: `screens_suggestion_${userId}_${stamp}`, retryLimit: 1 },
    );
  } finally {
    await boss.stop({ graceful: true, close: true, timeout: 5_000 });
  }
  log(
    `[${locale}] 리포트·제안 job을 넣었습니다. 서버 worker 결과를 기다립니다(최대 ${timeoutMs / 1000}초).`,
  );

  for (const reportType of ['WEEKLY', 'MONTHLY'] as const) {
    const report = await waitFor(
      async () => {
        const { rows } = await ctx.db.query(
          `SELECT "id", "aiSummary" FROM "AiReport" WHERE "userId" = $1 AND "type" = $2 ORDER BY "generatedAt" DESC LIMIT 1`,
          [userId, reportType],
        );
        const row = rows[0];
        return typeof row?.id === 'number' && typeof row.aiSummary === 'string'
          ? { id: row.id, summary: row.aiSummary }
          : null;
      },
      timeoutMs,
      `${reportType} 리포트`,
    );
    const key = envKey(locale, `${reportType}_REPORT`);
    if (report === null) {
      const id = await insertFallbackReport(ctx, userId, locale, content, reportType);
      ctx.env.set(`${key}_ID`, String(id));
      ctx.env.set(`${key}_SOURCE`, 'fallback-row');
    } else {
      const isServerFallback = REPORT_FALLBACK_PREFIXES.some((prefix) =>
        report.summary.startsWith(prefix),
      );
      if (isServerFallback) {
        // 서버가 AI 실패로 기본 문구를 저장했다. 사람이 쓴 요약으로 바꾸고 대체로 표시한다
        await ctx.db.query(
          `UPDATE "AiReport" SET "aiSummary" = $2, "aiTips" = $3 WHERE "id" = $1`,
          [
            report.id,
            reportType === 'WEEKLY'
              ? content.fallback.weeklySummary
              : content.fallback.monthlySummary,
            JSON.stringify(content.fallback.tips),
          ],
        );
      }
      ctx.env.set(`${key}_ID`, String(report.id));
      ctx.env.set(`${key}_SOURCE`, isServerFallback ? 'fallback-text' : 'ai');
    }
    const copyKey = reportType === 'WEEKLY' ? 'weeklyReport' : 'monthlyReport';
    await addNotification(ctx, {
      userId,
      type: `${reportType}_REPORT`,
      title: content.copy[`${copyKey}Title`] ?? '',
      body: content.copy[`${copyKey}Body`] ?? '',
      minutesAgo: reportType === 'WEEKLY' ? 7 * 60 : 26 * 60,
      isRead: reportType === 'MONTHLY',
    });
  }

  const suggestionCount = await waitFor(
    async () => {
      const { rows } = await ctx.db.query(
        `SELECT count(*)::int AS n FROM "RecurringSuggestion" WHERE "userId" = $1 AND "status" = 'PENDING'`,
        [userId],
      );
      const count = rows[0]?.n;
      return typeof count === 'number' && count > 0 ? count : null;
    },
    timeoutMs,
    '반복 제안',
  );
  if (suggestionCount === null) {
    await insertFallbackSuggestions(ctx, userId, content);
    ctx.env.set(envKey(locale, 'SUGGESTIONS_SOURCE'), 'fallback-row');
  } else {
    ctx.env.set(envKey(locale, 'SUGGESTIONS_SOURCE'), 'ai');
  }
  await addNotification(ctx, {
    userId,
    type: 'AI_SUGGESTION',
    title: content.copy.suggestionTitle ?? '',
    body: content.copy.suggestionBody ?? '',
    minutesAgo: 5 * 60,
  });
  writeEnvFile(ctx.env);
}

async function insertFallbackReport(
  ctx: Context,
  userId: string,
  locale: Locale,
  content: LocaleContent,
  reportType: 'WEEKLY' | 'MONTHLY',
): Promise<number> {
  const today = localDate(ctx.now, content.timezone);
  let start: string;
  let end: string;
  let year: number;
  let period: number;
  if (reportType === 'WEEKLY') {
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
    const thisMonday = addDays(today, -((dow + 6) % 7));
    start = addDays(thisMonday, -7);
    end = thisMonday;
    ({ year, week: period } = isoWeek(start));
  } else {
    const [y, m] = today.split('-').map(Number);
    const month = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 2, 1));
    start = month.toISOString().slice(0, 10);
    end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))
      .toISOString()
      .slice(0, 10);
    year = month.getUTCFullYear();
    period = month.getUTCMonth() + 1;
  }
  const { rows } = await ctx.db.query(
    `SELECT t."startDate"::text AS date, t."completed", t."scheduledTime", c."name", c."color"
       FROM "Todo" t JOIN "TodoCategory" c ON c."id" = t."categoryId"
      WHERE t."userId" = $1 AND t."startDate" >= $2 AND t."startDate" < $3`,
    [userId, start, end],
  );
  const total = rows.length;
  const completed = rows.filter((row) => row.completed === true).length;
  const rate = (done: number, all: number) => (all === 0 ? 0 : Math.round((done / all) * 100));
  const byCategory = new Map<string, { color: string; total: number; completed: number }>();
  const byDay = new Map<DayOfWeek, { total: number; completed: number }>();
  const byHour = new Map<number, number>();
  for (const row of rows) {
    const name = typeof row.name === 'string' ? row.name : '';
    const category = byCategory.get(name) ?? {
      color: typeof row.color === 'string' ? row.color : '#868E96',
      total: 0,
      completed: 0,
    };
    category.total += 1;
    category.completed += row.completed === true ? 1 : 0;
    byCategory.set(name, category);
    const dow = dayOfWeek(typeof row.date === 'string' ? row.date.slice(0, 10) : today);
    const day = byDay.get(dow) ?? { total: 0, completed: 0 };
    day.total += 1;
    day.completed += row.completed === true ? 1 : 0;
    byDay.set(dow, day);
    if (row.scheduledTime instanceof Date && row.completed === true) {
      const hour = Number(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: content.timezone,
          hour: '2-digit',
          hourCycle: 'h23',
        }).format(row.scheduledTime),
      );
      byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    }
  }
  const { rows: streakRows } = await ctx.db.query(
    'SELECT "currentStreak" FROM "UserPreference" WHERE "userId" = $1',
    [userId],
  );
  const streak = streakRows[0]?.currentStreak;
  return insertReturningId(
    ctx.db,
    `INSERT INTO "AiReport" ("userId", "type", "year", "period", "stats", "categoryBreakdown", "dayPatterns",
       "timePatterns", "aiSummary", "aiTips", "hasActivity", "generatedAt", "createdAt", "locale")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $13)`,
    [
      userId,
      reportType,
      year,
      period,
      JSON.stringify({
        totalTodos: total,
        completedTodos: completed,
        completionRate: rate(completed, total),
        prevCompletionRate: Math.max(0, rate(completed, total) - 6),
        streakDays: typeof streak === 'number' ? streak : 0,
      }),
      JSON.stringify(
        [...byCategory].map(([name, value]) => ({
          name,
          color: value.color,
          total: value.total,
          completed: value.completed,
          rate: rate(value.completed, value.total),
        })),
      ),
      JSON.stringify(
        [...byDay].map(([day, value]) => ({
          day,
          total: value.total,
          completed: value.completed,
          rate: rate(value.completed, value.total),
        })),
      ),
      JSON.stringify(
        [...byHour].sort(([a], [b]) => a - b).map(([hour, count]) => ({ hour, count })),
      ),
      reportType === 'WEEKLY' ? content.fallback.weeklySummary : content.fallback.monthlySummary,
      JSON.stringify(content.fallback.tips),
      total > 0,
      utc(instant(today, '09:00', content.timezone)),
      locale,
    ],
  );
}

async function insertFallbackSuggestions(
  ctx: Context,
  userId: string,
  content: LocaleContent,
): Promise<void> {
  const { rows } = await ctx.db.query(
    'SELECT "id", "name" FROM "TodoCategory" WHERE "userId" = $1',
    [userId],
  );
  for (const [index, suggestion] of content.fallback.suggestions.entries()) {
    const categoryName = content.categories.find((c) => c.key === suggestion.category)?.name;
    const categoryId = rows.find((row) => row.name === categoryName)?.id;
    await ctx.db.query(
      `INSERT INTO "RecurringSuggestion" ("userId", "title", "daysOfWeek", "scheduledTime", "confidence", "reason",
         "matchedTodos", "status", "expiresAt", "createdAt", "updatedAt", "suggestedCategoryId")
       VALUES ($1, $2, $3, $4, $5, $6, '[]', 'PENDING', $7, $8, $8, $9)`,
      [
        userId,
        suggestion.title,
        JSON.stringify(suggestion.days),
        suggestion.time,
        0.92 - index * 0.07,
        suggestion.reason,
        utc(new Date(ctx.now.getTime() + 7 * DAY_MS)),
        utc(ctx.now),
        typeof categoryId === 'number' ? categoryId : null,
      ],
    );
  }
}

// ---------- reset ----------

async function resetLocale(ctx: Context, locale: Locale, content: LocaleContent): Promise<void> {
  const ids: string[] = [];
  for (const email of demoEmails(content, locale)) {
    const id = await findUserId(ctx.db, email);
    if (id !== null) {
      ids.push(id);
    }
  }
  await deleteUsersCascade(ctx.db, ids);
  for (const key of [...ctx.env.keys()]) {
    if (key.startsWith(`SCREENS_${locale.toUpperCase()}_`)) {
      ctx.env.delete(key);
    }
  }
}

/** 초대 카드 → 수락 → 환영 시트 캡처로 바뀐 신규 계정 상태를 되돌린다(같은 기기에서 다시 보상받게) */
async function resetNewbie(ctx: Context, content: LocaleContent): Promise<void> {
  const newbie = await findUserId(ctx.db, content.owners.newbie.email);
  const premium = await findUserId(ctx.db, content.owners.premium.email);
  if (newbie === null || premium === null) {
    fail('신규·프리미엄 데모 계정이 없습니다. 먼저 seed를 실행하세요.');
  }
  await ctx.db.query('BEGIN');
  try {
    const { rows } = await ctx.db.query(
      'SELECT "id" FROM "InviteRedemption" WHERE "inviteeId" = $1',
      [newbie],
    );
    const redemptionIds = rows.flatMap((row) => (typeof row.id === 'string' ? [row.id] : []));
    // 서버가 실제 수락에서 만든 초대 알림(INVITE_JOINED 등)은 friendId 없이 metadata.redemptionId로만 수락과 이어진다
    await ctx.db.query(
      `DELETE FROM "Notification" WHERE "metadata"->>'redemptionId' = ANY($1::text[])`,
      [redemptionIds],
    );
    const { rows: grantRows } = await ctx.db.query(
      'SELECT "id" FROM "RewardGrant" WHERE "sourceId" = ANY($1::text[])',
      [redemptionIds],
    );
    const sourceKeys = grantRows.flatMap((row) =>
      typeof row.id === 'string' ? [`reward-grant:${row.id}`] : [],
    );
    await ctx.db.query('DELETE FROM "PremiumGrant" WHERE "sourceKey" = ANY($1::text[])', [
      sourceKeys,
    ]);
    await ctx.db.query('DELETE FROM "ResourceBonus" WHERE "sourceKey" = ANY($1::text[])', [
      sourceKeys,
    ]);
    await ctx.db.query('DELETE FROM "RewardGrant" WHERE "sourceId" = ANY($1::text[])', [
      redemptionIds,
    ]);
    await ctx.db.query('DELETE FROM "InviteRedemption" WHERE "inviteeId" = $1', [newbie]);
    await ctx.db.query(`DELETE FROM "Follow" WHERE "followerId" = $1 OR "followingId" = $1`, [
      newbie,
    ]);
    await ctx.db.query(
      `DELETE FROM "Notification" WHERE "userId" = $1 OR ("userId" = $2 AND "friendId" = $1)`,
      [newbie, premium],
    );
    await ctx.db.query(
      `UPDATE "User" SET "subscriptionStatus" = 'FREE', "subscriptionExpiresAt" = NULL WHERE "id" = $1`,
      [newbie],
    );
    // 기기·신원 해시에는 사용자 연결이 없어 로컬 RewardClaim 전체를 지운다(maestro-accounts reset과 같음)
    await ctx.db.query('DELETE FROM "RewardClaim"');
    await ctx.db.query('COMMIT');
  } catch (error) {
    await ctx.db.query('ROLLBACK');
    throw error;
  }
}

async function printStatus(ctx: Context, locale: Locale, content: LocaleContent): Promise<void> {
  for (const role of ROLES) {
    const id = await findUserId(ctx.db, content.owners[role].email);
    if (id === null) {
      log(`[${locale}] ${role}: 없음`);
      continue;
    }
    const { rows } = await ctx.db.query(
      `SELECT u."subscriptionStatus" AS status,
              (SELECT count(*)::int FROM "Todo" t WHERE t."userId" = u."id") AS todos,
              (SELECT count(*)::int FROM "Follow" f WHERE f."followerId" = u."id" AND f."status" = 'ACCEPTED') AS friends,
              (SELECT count(*)::int FROM "AiReport" r WHERE r."userId" = u."id") AS reports,
              (SELECT count(*)::int FROM "RecurringSuggestion" s WHERE s."userId" = u."id" AND s."status" = 'PENDING') AS suggestions
         FROM "User" u WHERE u."id" = $1`,
      [id],
    );
    const row = rows[0] ?? {};
    log(
      `[${locale}] ${role}: ${String(row.status)} 할일=${String(row.todos)} 친구=${String(row.friends)} 리포트=${String(row.reports)} 제안=${String(row.suggestions)}`,
    );
  }
  for (const key of [
    'AI_PARSE_TODO',
    'WEEKLY_REPORT_SOURCE',
    'MONTHLY_REPORT_SOURCE',
    'SUGGESTIONS_SOURCE',
  ]) {
    log(`[${locale}] ${key}=${ctx.env.get(envKey(locale, key)) ?? '-'}`);
  }
}

async function main(): Promise<void> {
  const [command, argument = 'ko'] = process.argv.slice(2);
  const target = resolveTarget();
  log(`대상: ${target.label}`);
  const locales: Locale[] =
    argument === 'all' ? [...LOCALES] : LOCALES.filter((locale) => locale === argument);
  if (locales.length === 0) {
    fail('언어는 ko, en, all 중 하나입니다.');
  }
  const content = loadContent();
  const db = await connectDatabase(target.databaseUrl);
  const ctx: Context = { db, target, env: readEnvFile(), now: new Date() };
  try {
    for (const locale of locales) {
      const localeContent = content[locale];
      switch (command) {
        case 'seed':
          await seedLocale(ctx, locale, localeContent);
          await runAiForLocale(ctx, locale, localeContent);
          await printStatus(ctx, locale, localeContent);
          break;
        case 'ai':
          await runAiForLocale(ctx, locale, localeContent);
          await printStatus(ctx, locale, localeContent);
          break;
        case 'reset':
          await resetLocale(ctx, locale, localeContent);
          writeEnvFile(ctx.env);
          log(`[${locale}] 데모 계정을 지웠습니다.`);
          break;
        case 'reset-newbie':
          await resetNewbie(ctx, localeContent);
          log(`[${locale}] 신규 계정의 초대 수락 상태를 되돌렸습니다.`);
          break;
        case 'status':
          await printStatus(ctx, locale, localeContent);
          break;
        default:
          fail('사용: seed | ai | reset | reset-newbie | status [ko|en|all]');
      }
    }
  } finally {
    await db.end();
  }
}

await main();
