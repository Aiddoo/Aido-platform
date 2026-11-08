import { entitlementSnapshotSchema } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG, PLAN_FEATURE_KEYS } from "@aido/api/vocabulary";
import { eq } from "drizzle-orm";
import request from "supertest";

import { user } from "#api/platform/database/schema/index";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const AT = new Date("2027-01-04T12:00:00.000Z");
const MONTH_RESET = "2027-01-31T15:00:00.000Z";
const KST_DAY_RESET = "2027-01-04T15:00:00.000Z";
/** 가입 때 만드는 기본 카테고리 수 */
const DEFAULT_CATEGORY_COUNT = 2;

describe("GET /v1/entitlements 서버 계산 권한 스냅샷 (실제 PostgreSQL)", () => {
  let context: E2eTestContext;

  beforeAll(async () => {
    context = await createE2eApp();
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await destroyE2eApp(context);
  });

  async function entitlements(accessToken: string) {
    const response = await request(context.app.getHttpServer())
      .get("/v1/entitlements")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", "Asia/Seoul")
      .expect(200);
    return entitlementSnapshotSchema.parse(response.body.data);
  }

  function createCategory(accessToken: string, name: string) {
    return request(context.app.getHttpServer())
      .post("/v1/todo-categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name, color: "#00FF00" });
  }

  async function updateUser(userId: string, values: Partial<typeof user.$inferInsert>) {
    await context.testDatabase.getClient().update(user).set(values).where(eq(user.id, userId));
  }

  it("FREE 사용자는 모든 기능의 무료 한도와 이번 달·오늘 사용량을 받는다", async () => {
    // Given
    const free = await context.helpers.createVerifiedUser("ent-free@test.com", "Test1234!");
    await updateUser(free.userId, { aiUsageCount: 4, aiUsageResetAt: AT });

    // When
    const snapshot = await entitlements(free.accessToken);

    // Then
    expect(snapshot).toMatchObject({ isPremium: false, tier: "FREE" });
    expect(Object.keys(snapshot.features)).toEqual([...PLAN_FEATURE_KEYS]);
    expect(snapshot.features.AI_PARSE).toEqual({
      feature: "AI_PARSE",
      allowed: true,
      limit: PLAN_CATALOG.AI_PARSE.free,
      used: 4,
      remaining: PLAN_CATALOG.AI_PARSE.free - 4,
      period: "month",
      resetsAt: MONTH_RESET,
      isFairUse: false,
      perUse: null,
    });
    expect(snapshot.features.VOICE_NOTE).toMatchObject({
      limit: PLAN_CATALOG.VOICE_NOTE.free,
      used: 0,
      perUse: {
        maxSeconds: PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.free,
        maxCharacters: PLAN_CATALOG.VOICE_NOTE.perUse.maxCharacters.free,
      },
    });
    expect(snapshot.features.CHEER).toMatchObject({
      limit: PLAN_CATALOG.CHEER.free,
      used: 0,
      period: "day",
      resetsAt: KST_DAY_RESET,
    });
    expect(snapshot.features.TODO_CATEGORY).toMatchObject({
      limit: PLAN_CATALOG.TODO_CATEGORY.free,
      used: DEFAULT_CATEGORY_COUNT,
      remaining: PLAN_CATALOG.TODO_CATEGORY.free - DEFAULT_CATEGORY_COUNT,
      period: null,
      resetsAt: null,
    });
    expect(snapshot.features.FRIEND).toMatchObject({
      limit: PLAN_CATALOG.FRIEND.free,
      used: 0,
      remaining: PLAN_CATALOG.FRIEND.free,
      resetsAt: null,
    });
    expect(snapshot.features.AI_REPORT).toMatchObject({ allowed: false, limit: null });
  });

  it("FREE 사용자가 카테고리 한도를 채우면 남은 0을 받고, 다음 만들기 거절도 같은 featureQuota다", async () => {
    // Given - 기본 카테고리 2개에 하나를 더해 무료 한도를 채운다
    const free = await context.helpers.createVerifiedUser("ent-category@test.com", "Test1234!");
    const before = await entitlements(free.accessToken);
    await createCategory(free.accessToken, "세 번째").expect(201);

    // When
    const after = await entitlements(free.accessToken);
    const rejected = await createCategory(free.accessToken, "네 번째").expect(403);

    // Then
    expect(before.features.TODO_CATEGORY).toMatchObject({ used: DEFAULT_CATEGORY_COUNT });
    expect(after.features.TODO_CATEGORY).toEqual({
      feature: "TODO_CATEGORY",
      allowed: true,
      limit: PLAN_CATALOG.TODO_CATEGORY.free,
      used: PLAN_CATALOG.TODO_CATEGORY.free,
      remaining: 0,
      period: null,
      resetsAt: null,
      isFairUse: false,
      perUse: null,
    });
    expect(rejected.body.error.code).toBe(ErrorCode.TODO_CATEGORY_0857);
    expect(rejected.body.error.details.featureQuota).toEqual(after.features.TODO_CATEGORY);
  });

  it("PREMIUM 사용자는 공정 사용 상한을 숫자와 isFairUse로 받고 길이 상한이 커진다", async () => {
    // Given
    const premium = await context.helpers.createVerifiedUser("ent-premium@test.com", "Test1234!");
    await updateUser(premium.userId, { subscriptionStatus: "ACTIVE" });

    // When
    const snapshot = await entitlements(premium.accessToken);

    // Then
    expect(snapshot).toMatchObject({ isPremium: true, tier: "PREMIUM" });
    expect(snapshot.features.AI_PARSE).toMatchObject({
      limit: PLAN_CATALOG.AI_PARSE.fairUse.premium,
      isFairUse: true,
    });
    expect(snapshot.features.VOICE_NOTE).toMatchObject({
      limit: PLAN_CATALOG.VOICE_NOTE.fairUse.premium,
      isFairUse: true,
      perUse: {
        maxSeconds: PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.premium,
        maxCharacters: PLAN_CATALOG.VOICE_NOTE.perUse.maxCharacters.premium,
      },
    });
    expect(snapshot.features.CHEER).toMatchObject({ limit: null, remaining: null });
    expect(snapshot.features.FRIEND).toMatchObject({ limit: null, used: null, remaining: null });
    expect(snapshot.features.TODO_CATEGORY).toMatchObject({
      limit: PLAN_CATALOG.TODO_CATEGORY.premium,
      used: DEFAULT_CATEGORY_COUNT,
      remaining: PLAN_CATALOG.TODO_CATEGORY.premium - DEFAULT_CATEGORY_COUNT,
    });
    expect(snapshot.features.AI_REPORT).toMatchObject({ allowed: true });
  });

  it("ADMIN은 모든 기능을 쓸 수 있고 횟수 한도가 정말 무제한(null)이다", async () => {
    // Given
    const admin = await context.helpers.createVerifiedUser("ent-admin@test.com", "Test1234!");
    await updateUser(admin.userId, { role: "ADMIN" });

    // When
    const snapshot = await entitlements(admin.accessToken);

    // Then
    expect(snapshot).toMatchObject({ isPremium: false, tier: "ADMIN" });
    expect(snapshot.features.AI_PARSE).toMatchObject({
      limit: null,
      remaining: null,
      isFairUse: false,
    });
    expect(snapshot.features.APP_ICON).toMatchObject({ allowed: true });
  });

  it("인증 없이 요청하면 401 AUTH_0101이다", async () => {
    // When
    const response = await request(context.app.getHttpServer()).get("/v1/entitlements");

    // Then
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ErrorCode.AUTH_0101);
  });
});
