/**
 * 현재 local development 계정의 PUBLIC Todo에 실제 댓글 API로 대화 fixture를 만듭니다.
 *
 * 안전장치:
 * - NODE_ENV=development, loopback HTTP API, local PostgreSQL만 허용합니다.
 * - --owner-id와 --todo-id가 정확히 일치하고 Todo가 PUBLIC일 때만 mutation합니다.
 * - --apply가 없으면 DB와 API를 읽기만 하고 계획을 출력합니다.
 *
 * 정리 식별자:
 * - fixture user email suffix: @todo-comment-fixture.aido.dev
 * - fixture session userAgent: aido-todo-comment-development-fixture/v1
 * - comment clientRequestId: FIXTURE_COMMENTS의 결정적 UUID 목록
 */
import { createHash, createHmac } from "node:crypto";
import { parseArgs } from "node:util";

import {
  currentUserSchema,
  deleteTodoCommentResponseSchema,
  todoCommentChainResponseSchema,
  todoCommentLikeResponseSchema,
  todoCommentOverviewResponseSchema,
  todoConversationResponseSchema,
  todoDetailsResponseSchema,
  z,
} from "@aido/api";
import { ErrorCode, type ErrorCodeType, HttpStatus } from "@aido/api/errors";
import { and, count, eq, inArray, isNull, or } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import {
  follow,
  session,
  todoComment,
  user,
  userProfile,
} from "#api/platform/database/schema/index";
import { createTestClient, type TestDatabaseClient } from "#test/setup/database-context";

import { assertTodoCommentDevelopmentFixtureTarget } from "../setup/todo-comment-development-fixture-target.guard.js";

const FIXTURE_VERSION = "v1";
const FIXTURE_EMAIL_SUFFIX = "@todo-comment-fixture.aido.dev";
const FIXTURE_SESSION_USER_AGENT = `aido-todo-comment-development-fixture/${FIXTURE_VERSION}`;
const FIXTURE_OWNER_SESSION_USER_AGENT = `${FIXTURE_SESSION_USER_AGENT}/todo-owner`;
const EXPECTED_FIXTURE_COMMENT_ROW_COUNT = 17;
const EXPECTED_FIXTURE_LIVE_COMMENT_COUNT = 16;
const EXPECTED_FIXTURE_TOMBSTONE_COUNT = 1;

interface FixturePerson {
  key: string;
  email: string;
  userTag: string;
  name: string;
  profileImage: string;
}

interface AuthenticatedActor {
  userId: string;
  name: string;
  accessToken: string;
}

interface FixtureActor extends FixturePerson, AuthenticatedActor {
  sessionId: string;
}

interface FixtureOptions {
  ownerId: string;
  todoId: number;
  apply: boolean;
}

interface FixtureComment {
  id: string;
  clientRequestId: string;
}

const JIYUN: FixturePerson = {
  key: "jiyun",
  email: `jiyun${FIXTURE_EMAIL_SUFFIX}`,
  userTag: "FXJIYUN1",
  name: "지윤",
  profileImage: "https://api.dicebear.com/9.x/notionists/png?seed=Jiyun&backgroundColor=ffd5dc",
};

const HYUNWOO: FixturePerson = {
  key: "hyunwoo",
  email: `hyunwoo${FIXTURE_EMAIL_SUFFIX}`,
  userTag: "FXHYUNW1",
  name: "현우",
  profileImage: "https://api.dicebear.com/9.x/notionists/png?seed=Hyunwoo&backgroundColor=c0e6ff",
};

const SEOYEON: FixturePerson = {
  key: "seoyeon",
  email: `seoyeon${FIXTURE_EMAIL_SUFFIX}`,
  userTag: "FXSEOYN1",
  name: "서연",
  profileImage: "https://api.dicebear.com/9.x/notionists/png?seed=Seoyeon&backgroundColor=d1f4d9",
};

const MINJAE: FixturePerson = {
  key: "minjae",
  email: `minjae${FIXTURE_EMAIL_SUFFIX}`,
  userTag: "FXMINJE1",
  name: "민재",
  profileImage: "https://api.dicebear.com/9.x/notionists/png?seed=Minjae&backgroundColor=ffe7c2",
};

const FIXTURE_PEOPLE = [JIYUN, HYUNWOO, SEOYEON, MINJAE];

const FIXTURE_COMMENTS = {
  rootPlanning: "a1100000-0000-4000-8000-000000000001",
  rootMorning: "a1100000-0000-4000-8000-000000000002",
  rootRest: "a1100000-0000-4000-8000-000000000003",
  rootRecord: "a1100000-0000-4000-8000-000000000004",
  planningReply: "a1100000-0000-4000-8000-000000000005",
  planningFollowUp: "a1100000-0000-4000-8000-000000000006",
  planningDeepReply: "a1100000-0000-4000-8000-000000000007",
  planningDeepFollowUp: "a1100000-0000-4000-8000-000000000008",
  planningSecondReply: "a1100000-0000-4000-8000-000000000009",
  morningFirstReply: "a1100000-0000-4000-8000-000000000010",
  morningSecondReply: "a1100000-0000-4000-8000-000000000011",
  morningFollowUp: "a1100000-0000-4000-8000-000000000012",
  recordReply: "a1100000-0000-4000-8000-000000000013",
  planningOwnerReply: "a1100000-0000-4000-8000-000000000014",
  planningOwnerFollowUp: "a1100000-0000-4000-8000-000000000015",
  planningDeletedReply: "a1100000-0000-4000-8000-000000000016",
  planningDeletedFollowUp: "a1100000-0000-4000-8000-000000000017",
};

const SuccessEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
});

const ErrorEnvelopeSchema = z.object({
  error: z.object({ code: z.string() }),
});

const HealthSchema = z.looseObject({ status: z.literal("ok") });

function parseFixtureOptions(): FixtureOptions {
  const { values } = parseArgs({
    options: {
      "owner-id": { type: "string" },
      "todo-id": { type: "string" },
      apply: { type: "boolean", default: false },
    },
    strict: true,
  });

  return z
    .object({
      ownerId: z.cuid(),
      todoId: z.coerce.number().int().positive(),
      apply: z.boolean(),
    })
    .parse({
      ownerId: values["owner-id"],
      todoId: values["todo-id"],
      apply: values.apply,
    });
}

function writeOutput(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function requestApi<T>(input: {
  apiBaseUrl: string;
  path: string;
  schema: z.ZodType<T>;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  accessToken?: string;
  body?: unknown;
}): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (input.accessToken !== undefined) {
    headers.set("Authorization", `Bearer ${input.accessToken}`);
  }
  if (input.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${input.apiBaseUrl}${input.path}`, {
    method: input.method ?? "GET",
    headers,
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const rawBody: unknown = await response.json();
  if (!response.ok) {
    const parsedError = ErrorEnvelopeSchema.safeParse(rawBody);
    const code = parsedError.success ? parsedError.data.error.code : "UNKNOWN";
    throw new Error(
      `[todo-comment-fixture] API ${input.method ?? "GET"} ${input.path}가 ${response.status} (${code})로 응답했습니다.`,
    );
  }

  const envelope = SuccessEnvelopeSchema.parse(rawBody);
  return input.schema.parse(envelope.data);
}

function getSha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function getFixtureAccessToken(input: {
  userId: string;
  email: string;
  sessionId: string;
  jwtSecret: string;
}): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1_000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      email: input.email,
      role: "USER",
      type: "access",
      sessionId: input.sessionId,
      sub: input.userId,
      iat: issuedAt,
      exp: issuedAt + 15 * 60,
    }),
  ).toString("base64url");
  const unsignedToken = `${header}.${payload}`;
  const signature = createHmac("sha256", input.jwtSecret).update(unsignedToken).digest("base64url");
  return `${unsignedToken}.${signature}`;
}

async function provisionFixtureActor(input: {
  db: TestDatabaseClient;
  person: FixturePerson;
  ownerId: string;
  jwtSecret: string;
}): Promise<FixtureActor> {
  const now = Temporal.Now.instant();
  const expiresAt = now.add({ hours: 1 });
  const provisioned = await input.db.transaction(async (transaction) => {
    const [storedUser] = await transaction
      .insert(user)
      .values({
        email: input.person.email,
        userTag: input.person.userTag,
        status: "ACTIVE",
        emailVerifiedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: user.email,
        set: {
          userTag: input.person.userTag,
          status: "ACTIVE",
          emailVerifiedAt: now,
          deletedAt: null,
          updatedAt: now,
        },
      })
      .returning();
    const actorUser = requireRecord(storedUser);

    await transaction
      .insert(userProfile)
      .values({
        userId: actorUser.id,
        name: input.person.name,
        profileImage: input.person.profileImage,
      })
      .onConflictDoUpdate({
        target: userProfile.userId,
        set: { name: input.person.name, profileImage: input.person.profileImage },
      });

    const friendshipDirections: Array<{ followerId: string; followingId: string }> = [
      { followerId: actorUser.id, followingId: input.ownerId },
      { followerId: input.ownerId, followingId: actorUser.id },
    ];
    for (const { followerId, followingId } of friendshipDirections) {
      await transaction
        .insert(follow)
        .values({ followerId, followingId, status: "ACCEPTED", updatedAt: now })
        .onConflictDoUpdate({
          target: [follow.followerId, follow.followingId],
          set: { status: "ACCEPTED", updatedAt: now },
        });
    }

    await transaction
      .delete(session)
      .where(
        and(eq(session.userId, actorUser.id), eq(session.userAgent, FIXTURE_SESSION_USER_AGENT)),
      );
    const [storedSession] = await transaction
      .insert(session)
      .values({
        userId: actorUser.id,
        refreshTokenHash: getSha256(`refresh:${FIXTURE_VERSION}:${input.person.key}`),
        tokenFamily: getSha256(`family:${FIXTURE_VERSION}:${input.person.key}`).slice(0, 32),
        tokenVersion: 1,
        deviceFingerprint: getSha256(`device:${FIXTURE_VERSION}:${input.person.key}`),
        userAgent: FIXTURE_SESSION_USER_AGENT,
        ipAddress: "127.0.0.1",
        expiresAt,
        updatedAt: now,
      })
      .returning();

    return { userId: actorUser.id, sessionId: requireRecord(storedSession).id };
  });

  const accessToken = await getFixtureAccessToken({
    userId: provisioned.userId,
    email: input.person.email,
    sessionId: provisioned.sessionId,
    jwtSecret: input.jwtSecret,
  });

  return {
    ...input.person,
    ...provisioned,
    accessToken,
  };
}

async function provisionTodoOwnerActor(input: {
  db: TestDatabaseClient;
  owner: {
    id: string;
    email: string;
    profile: { name: string | null } | null;
  };
  jwtSecret: string;
}): Promise<AuthenticatedActor> {
  const now = Temporal.Now.instant();
  const expiresAt = now.add({ hours: 1 });
  const ownerName = z.string().min(1).parse(input.owner.profile?.name);
  const ownerSession = await input.db.transaction(async (transaction) => {
    // 실제 앱 세션은 건드리지 않고 이 fixture가 만든 owner 세션만 교체합니다.
    await transaction
      .delete(session)
      .where(
        and(
          eq(session.userId, input.owner.id),
          eq(session.userAgent, FIXTURE_OWNER_SESSION_USER_AGENT),
        ),
      );

    const [stored] = await transaction
      .insert(session)
      .values({
        userId: input.owner.id,
        refreshTokenHash: getSha256(`refresh:${FIXTURE_VERSION}:todo-owner`),
        tokenFamily: getSha256(`family:${FIXTURE_VERSION}:todo-owner`).slice(0, 32),
        tokenVersion: 1,
        deviceFingerprint: getSha256(`device:${FIXTURE_VERSION}:todo-owner`),
        userAgent: FIXTURE_OWNER_SESSION_USER_AGENT,
        ipAddress: "127.0.0.1",
        expiresAt,
        updatedAt: now,
      })
      .returning();
    return requireRecord(stored);
  });
  const accessToken = await getFixtureAccessToken({
    userId: input.owner.id,
    email: input.owner.email,
    sessionId: ownerSession.id,
    jwtSecret: input.jwtSecret,
  });

  return {
    userId: input.owner.id,
    name: ownerName,
    accessToken,
  };
}

async function verifyAuthenticatedActor(
  apiBaseUrl: string,
  actor: AuthenticatedActor,
): Promise<void> {
  const currentUser = await requestApi({
    apiBaseUrl,
    path: "/v1/auth/me",
    accessToken: actor.accessToken,
    schema: currentUserSchema,
  });
  if (currentUser.userId !== actor.userId || currentUser.name !== actor.name) {
    throw new Error(`[todo-comment-fixture] ${actor.name} fixture session 검증이 어긋났습니다.`);
  }
}

async function writeFixtureComment(input: {
  apiBaseUrl: string;
  todoId: number;
  actor: AuthenticatedActor;
  parentId: string | null;
  clientRequestId: string;
  content: string;
}): Promise<FixtureComment> {
  const result = await requestApi({
    apiBaseUrl: input.apiBaseUrl,
    path: `/v1/todos/${input.todoId}/comments`,
    method: "POST",
    accessToken: input.actor.accessToken,
    body: {
      parentId: input.parentId,
      items: [{ clientRequestId: input.clientRequestId, content: input.content }],
    },
    schema: todoCommentChainResponseSchema,
  });
  const comment = result.comments[0];
  if (comment === undefined) {
    throw new Error("[todo-comment-fixture] 댓글 작성 응답이 비어 있습니다.");
  }

  return { id: comment.id, clientRequestId: input.clientRequestId };
}

async function likeFixtureComment(input: {
  apiBaseUrl: string;
  todoId: number;
  actor: AuthenticatedActor;
  commentId: string;
}): Promise<void> {
  await requestApi({
    apiBaseUrl: input.apiBaseUrl,
    path: `/v1/todos/${input.todoId}/comments/${input.commentId}/likes`,
    method: "PUT",
    accessToken: input.actor.accessToken,
    schema: todoCommentLikeResponseSchema,
  });
}

async function deleteFixtureComment(input: {
  apiBaseUrl: string;
  todoId: number;
  actor: AuthenticatedActor;
  commentId: string;
}): Promise<void> {
  await requestApi({
    apiBaseUrl: input.apiBaseUrl,
    path: `/v1/todos/${input.todoId}/comments/${input.commentId}`,
    method: "DELETE",
    accessToken: input.actor.accessToken,
    schema: deleteTodoCommentResponseSchema,
  });
}

async function assertApiError(input: {
  apiBaseUrl: string;
  path: string;
  method: "POST" | "PUT" | "DELETE";
  accessToken: string;
  expectedStatus: number;
  expectedCode: ErrorCodeType;
}): Promise<void> {
  const response = await fetch(`${input.apiBaseUrl}${input.path}`, {
    method: input.method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken}`,
    },
  });
  const rawBody: unknown = await response.json();
  const parsedError = ErrorEnvelopeSchema.safeParse(rawBody);
  const actualCode = parsedError.success ? parsedError.data.error.code : "UNKNOWN";

  assertEqual(response.status, input.expectedStatus, `${input.path} HTTP status`);
  assertEqual(actualCode, input.expectedCode, `${input.path} error code`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `[todo-comment-fixture] ${label} 검증이 어긋났습니다. expected=${String(expected)}, actual=${String(actual)}`,
    );
  }
}

async function verifyStoredCalculations(input: {
  db: TestDatabaseClient;
  todoId: number;
  ownerId: string;
  actors: FixtureActor[];
  comments: Record<string, FixtureComment>;
}): Promise<{
  fixtureCommentRowCount: number;
  fixtureLiveCommentCount: number;
  fixtureTombstoneCount: number;
  todoCommentCount: number;
  todoCommentRowCount: number;
  acceptedFollowCount: number;
}> {
  const actorIds = input.actors.map((actor) => actor.userId);
  const fixtureRows = await input.db.query.todoComment.findMany({
    where: { todoId: input.todoId, clientRequestId: { in: Object.values(FIXTURE_COMMENTS) } },
    with: { likes: { where: { isActive: true } } },
  });
  assertEqual(fixtureRows.length, EXPECTED_FIXTURE_COMMENT_ROW_COUNT, "fixture 댓글 DB 행 수");
  const fixtureLiveCommentCount = fixtureRows.filter((row) => row.deletedAt === null).length;
  const fixtureTombstoneCount = fixtureRows.length - fixtureLiveCommentCount;
  assertEqual(fixtureLiveCommentCount, EXPECTED_FIXTURE_LIVE_COMMENT_COUNT, "fixture live 댓글 수");
  assertEqual(fixtureTombstoneCount, EXPECTED_FIXTURE_TOMBSTONE_COUNT, "fixture 삭제 묘비 수");

  const rowById = new Map(fixtureRows.map((row) => [row.id, row]));
  const getRow = (key: string) => {
    const comment = input.comments[key];
    const row = comment === undefined ? undefined : rowById.get(comment.id);
    if (row === undefined) {
      throw new Error(`[todo-comment-fixture] ${key} 댓글 행을 찾지 못했습니다.`);
    }
    return row;
  };

  const rootPlanning = getRow("rootPlanning");
  const planningDeepReply = getRow("planningDeepReply");
  const planningDeepFollowUp = getRow("planningDeepFollowUp");
  const rootMorning = getRow("rootMorning");
  const rootRecord = getRow("rootRecord");
  const planningOwnerReply = getRow("planningOwnerReply");
  const planningDeletedReply = getRow("planningDeletedReply");
  const planningDeletedFollowUp = getRow("planningDeletedFollowUp");

  assertEqual(rootPlanning.parentId, null, "계획 댓글 parentId");
  assertEqual(rootPlanning.replyCount, 8, "계획 댓글 replyCount");
  assertEqual(rootPlanning.likeCount, 3, "계획 댓글 likeCount");
  assertEqual(rootPlanning.likes.length, rootPlanning.likeCount, "계획 댓글 active likes");
  assertEqual(planningDeepFollowUp.parentId, rootPlanning.id, "답글의 답글 묶음 머리");
  assertEqual(planningDeepFollowUp.replyToCommentId, planningDeepReply.id, "답글의 답글 대상");
  assertEqual(planningDeepReply.likeCount, 2, "계획 깊은 답글 likeCount");
  assertEqual(rootMorning.replyCount, 3, "아침 댓글 replyCount");
  assertEqual(rootMorning.likeCount, 2, "아침 댓글 likeCount");
  assertEqual(rootRecord.replyCount, 1, "기록 댓글 replyCount");
  assertEqual(planningOwnerReply.authorId, input.ownerId, "작성자 답글 authorId");
  assertEqual(planningDeletedReply.deletedAt !== null, true, "삭제 답글 deletedAt");
  assertEqual(planningDeletedReply.content, null, "삭제 답글 content");
  assertEqual(planningDeletedReply.likeCount, 0, "삭제 답글 likeCount");
  assertEqual(planningDeletedReply.likes.length, 0, "삭제 답글 active likes");
  assertEqual(planningDeletedFollowUp.deletedAt, null, "삭제 답글에 단 답글 deletedAt");
  assertEqual(
    planningDeletedFollowUp.replyToCommentId,
    planningDeletedReply.id,
    "삭제 답글에 단 답글 대상",
  );

  for (const row of fixtureRows) {
    assertEqual(row.likeCount, row.likes.length, `${row.id} active likes`);
    const thread = fixtureRows.find((candidate) => candidate.id === row.parentId);
    assertEqual(thread?.parentId ?? null, null, `${row.id} 2단계 묶음 머리`);
    const [visibleReplies] = await input.db
      .select({ count: count() })
      .from(todoComment)
      .where(
        and(
          eq(todoComment.todoId, input.todoId),
          eq(todoComment.parentId, row.id),
          isNull(todoComment.deletedAt),
        ),
      );
    assertEqual(row.replyCount, requireRecord(visibleReplies).count, `${row.id} visible replies`);
  }

  const todo = requireRecord(await input.db.query.todo.findFirst({ where: { id: input.todoId } }));
  const [liveComments] = await input.db
    .select({ count: count() })
    .from(todoComment)
    .where(and(eq(todoComment.todoId, input.todoId), isNull(todoComment.deletedAt)));
  const liveCommentCount = requireRecord(liveComments).count;
  assertEqual(todo.commentCount, liveCommentCount, "Todo commentCount");
  const [allComments] = await input.db
    .select({ count: count() })
    .from(todoComment)
    .where(eq(todoComment.todoId, input.todoId));
  const todoCommentRowCount = requireRecord(allComments).count;
  assertEqual(
    todoCommentRowCount - liveCommentCount >= EXPECTED_FIXTURE_TOMBSTONE_COUNT,
    true,
    "Todo DB 행에 fixture 삭제 묘비 포함",
  );

  const [acceptedFollows] = await input.db
    .select({ count: count() })
    .from(follow)
    .where(
      and(
        eq(follow.status, "ACCEPTED"),
        or(
          and(eq(follow.followerId, input.ownerId), inArray(follow.followingId, actorIds)),
          and(inArray(follow.followerId, actorIds), eq(follow.followingId, input.ownerId)),
        ),
      ),
    );
  const acceptedFollowCount = requireRecord(acceptedFollows).count;
  assertEqual(acceptedFollowCount, input.actors.length * 2, "양방향 ACCEPTED Follow");

  return {
    fixtureCommentRowCount: fixtureRows.length,
    fixtureLiveCommentCount,
    fixtureTombstoneCount,
    todoCommentCount: todo.commentCount,
    todoCommentRowCount,
    acceptedFollowCount,
  };
}

async function verifyApiReadModels(input: {
  apiBaseUrl: string;
  todoId: number;
  todoOwnerId: string;
  expectedTodoCommentCount: number;
  viewer: FixtureActor;
  comments: Record<string, FixtureComment>;
}): Promise<void> {
  const overview = await requestApi({
    apiBaseUrl: input.apiBaseUrl,
    path: `/v1/todos/${input.todoId}/comments/overview?sort=POPULAR&size=50`,
    accessToken: input.viewer.accessToken,
    schema: todoCommentOverviewResponseSchema,
  });
  const rootPlanningId = input.comments.rootPlanning?.id;
  const planningOverview = overview.items.find((item) => item.comment.id === rootPlanningId);
  if (planningOverview === undefined) {
    throw new Error("[todo-comment-fixture] overview에서 계획 root를 찾지 못했습니다.");
  }
  assertEqual(planningOverview.comment.viewer.isLiked, true, "overview viewer like");
  assertEqual(planningOverview.comment.replyCount, 8, "overview replyCount");
  assertEqual(planningOverview.replySummary.totalCount, 8, "overview totalCount");
  assertEqual(planningOverview.replySummary.hiddenCount, 7, "overview hiddenCount");
  assertEqual(planningOverview.replySummary.hasMore, true, "overview hasMore");
  assertEqual(planningOverview.replySummary.participantAuthors.length, 3, "overview participants");
  assertEqual(
    planningOverview.previewReply?.id,
    input.comments.planningOwnerReply?.id,
    "overview owner-priority preview",
  );
  assertEqual(
    planningOverview.previewReply?.author?.id,
    input.todoOwnerId,
    "overview preview owner id",
  );
  assertEqual(
    planningOverview.previewReply?.author?.isTodoOwner,
    true,
    "overview preview owner badge",
  );
  assertEqual(
    planningOverview.replySummary.participantAuthors[0]?.isTodoOwner,
    true,
    "overview owner-priority participant",
  );

  const focusedId = input.comments.planningDeepFollowUp?.id;
  if (focusedId === undefined) {
    throw new Error("[todo-comment-fixture] focus 댓글 ID가 없습니다.");
  }
  const conversation = await requestApi({
    apiBaseUrl: input.apiBaseUrl,
    path: `/v1/todos/${input.todoId}/conversation?sort=LATEST&size=3&focusCommentId=${focusedId}`,
    accessToken: input.viewer.accessToken,
    schema: todoConversationResponseSchema,
  });
  if (conversation.focus === null) {
    throw new Error("[todo-comment-fixture] focus 계산 결과가 비어 있습니다.");
  }
  assertEqual(conversation.focus.commentId, focusedId, "conversation focus commentId");
  const focusedItem = conversation.items[conversation.focus.itemIndex];
  assertEqual(focusedItem?.comment.id, focusedId, "conversation focus itemIndex");
  assertEqual(focusedItem?.comment.depth, 1, "conversation focus depth");
  assertEqual(focusedItem?.isFocused, true, "conversation isFocused");
  const contextItems = [...conversation.focus.precedingAncestors, ...conversation.items];
  if (!contextItems.some((item) => item.comment.id === rootPlanningId)) {
    throw new Error("[todo-comment-fixture] focus 문맥에서 묶음 머리 댓글을 찾지 못했습니다.");
  }

  const deletedParentId = input.comments.planningDeletedReply?.id;
  const deletedFollowUpId = input.comments.planningDeletedFollowUp?.id;
  if (deletedParentId === undefined || deletedFollowUpId === undefined) {
    throw new Error("[todo-comment-fixture] 삭제 묘비 대화 ID가 없습니다.");
  }
  const tombstoneConversation = await requestApi({
    apiBaseUrl: input.apiBaseUrl,
    path: `/v1/todos/${input.todoId}/conversation?sort=LATEST&size=10&focusCommentId=${deletedParentId}`,
    accessToken: input.viewer.accessToken,
    schema: todoConversationResponseSchema,
  });
  if (tombstoneConversation.focus === null) {
    throw new Error("[todo-comment-fixture] 삭제 답글 focus 계산 결과가 비어 있습니다.");
  }
  const deletedReply = tombstoneConversation.items[tombstoneConversation.focus.itemIndex];
  const liveFollowUp = tombstoneConversation.items.find(
    (item) => item.comment.id === deletedFollowUpId,
  );
  assertEqual(deletedReply?.comment.id, deletedParentId, "conversation tombstone focus");
  assertEqual(deletedReply?.comment.isDeleted, true, "conversation tombstone isDeleted");
  assertEqual(deletedReply?.comment.content, null, "conversation tombstone content");
  assertEqual(liveFollowUp?.comment.isDeleted, false, "conversation tombstone 답글 isDeleted");
  assertEqual(liveFollowUp?.comment.parentId, rootPlanningId, "conversation 답글 묶음 머리");
  assertEqual(
    liveFollowUp?.comment.replyTo?.commentId,
    deletedParentId,
    "conversation 삭제 답글에 단 답글 대상",
  );

  const details = await requestApi({
    apiBaseUrl: input.apiBaseUrl,
    path: `/v1/todos/${input.todoId}/details`,
    accessToken: input.viewer.accessToken,
    schema: todoDetailsResponseSchema,
  });
  assertEqual(details.metrics.commentCount, input.expectedTodoCommentCount, "details commentCount");
}

async function createCommentGraph(input: {
  apiBaseUrl: string;
  todoId: number;
  jiyun: FixtureActor;
  hyunwoo: FixtureActor;
  seoyeon: FixtureActor;
  minjae: FixtureActor;
  todoOwner: AuthenticatedActor;
}): Promise<Record<string, FixtureComment>> {
  const write = (
    actor: AuthenticatedActor,
    parentId: string | null,
    clientRequestId: string,
    content: string,
  ) =>
    writeFixtureComment({
      apiBaseUrl: input.apiBaseUrl,
      todoId: input.todoId,
      actor,
      parentId,
      clientRequestId,
      content,
    });

  const rootPlanning = await write(
    input.jiyun,
    null,
    FIXTURE_COMMENTS.rootPlanning,
    "할 일을 크게 잡으면 시작하기가 더 어렵더라고요. 오늘 바로 할 수 있는 한 칸만 정해 두면 마음이 조금 가벼워져요.",
  );
  const rootMorning = await write(
    input.hyunwoo,
    null,
    FIXTURE_COMMENTS.rootMorning,
    "저는 아침에 가장 부담스러운 일 하나를 먼저 끝내요. 나머지는 덤이라고 생각하면 하루가 덜 조급해지더라고요.",
  );
  const rootRest = await write(
    input.seoyeon,
    null,
    FIXTURE_COMMENTS.rootRest,
    "쉬는 시간을 일정에 먼저 적어 두는 것도 도움이 됐어요. 비워 둔 시간은 결국 다른 일로 채워지기 쉬웠어요.",
  );
  const rootRecord = await write(
    input.minjae,
    null,
    FIXTURE_COMMENTS.rootRecord,
    "완료한 것만 짧게 기록해도 생각보다 많이 해냈다는 게 보여요. 못 한 일보다 한 일을 보는 연습이 필요했어요.",
  );

  const planningReply = await write(
    input.hyunwoo,
    rootPlanning.id,
    FIXTURE_COMMENTS.planningReply,
    "맞아요. 저는 시작 기준을 10분으로 잡으니까 미루는 시간이 확실히 줄었어요.",
  );
  const planningFollowUp = await write(
    input.jiyun,
    planningReply.id,
    FIXTURE_COMMENTS.planningFollowUp,
    "10분 기준 좋네요. 끝내는 시간이 아니라 시작하는 시간을 약속하는 거군요.",
  );
  const planningDeepReply = await write(
    input.seoyeon,
    planningFollowUp.id,
    FIXTURE_COMMENTS.planningDeepReply,
    "저도 그렇게 해요. 10분 뒤에 멈춰도 된다고 정하면 오히려 조금 더 이어 가게 되더라고요.",
  );
  const planningDeepFollowUp = await write(
    input.hyunwoo,
    planningDeepReply.id,
    FIXTURE_COMMENTS.planningDeepFollowUp,
    "오늘은 저도 딱 10분만 해볼게요. 시작했다는 표시부터 남겨야겠어요.",
  );
  const planningSecondReply = await write(
    input.minjae,
    rootPlanning.id,
    FIXTURE_COMMENTS.planningSecondReply,
    "한 칸을 아주 작게 만드는 게 핵심 같아요. 저는 파일 열기만 적어 둔 날도 있었어요.",
  );

  const morningFirstReply = await write(
    input.minjae,
    rootMorning.id,
    FIXTURE_COMMENTS.morningFirstReply,
    "첫 일을 정할 때 중요도보다 계속 마음에 걸리는 걸 고르면 집중이 잘 됐어요.",
  );
  const morningSecondReply = await write(
    input.seoyeon,
    rootMorning.id,
    FIXTURE_COMMENTS.morningSecondReply,
    "저는 전날 밤에 하나만 골라 둬요. 아침에 고르는 힘까지 아낄 수 있어서 편했어요.",
  );
  const morningFollowUp = await write(
    input.minjae,
    morningSecondReply.id,
    FIXTURE_COMMENTS.morningFollowUp,
    "결정을 미리 해두는 것도 좋은 방법이네요. 오늘 밤부터 바로 해봐야겠어요.",
  );
  const recordReply = await write(
    input.jiyun,
    rootRecord.id,
    FIXTURE_COMMENTS.recordReply,
    "한 일 목록을 따로 적어보니 자책하는 시간이 줄었어요. 작은 완료도 빠뜨리지 않는 게 좋았어요.",
  );
  const planningOwnerReply = await write(
    input.todoOwner,
    rootPlanning.id,
    FIXTURE_COMMENTS.planningOwnerReply,
    "좋은 얘기 고마워요. 이 Todo는 오늘 할 한 가지만 남기고, 나머지는 다음으로 미뤄보려고요.",
  );
  const planningOwnerFollowUp = await write(
    input.jiyun,
    planningOwnerReply.id,
    FIXTURE_COMMENTS.planningOwnerFollowUp,
    "작성자님이 직접 정리해 주시니 방향이 더 잘 보이네요. 오늘 한 가지만 마친 뒤 소식 궁금해요.",
  );
  const planningDeletedReply = await write(
    input.seoyeon,
    rootPlanning.id,
    FIXTURE_COMMENTS.planningDeletedReply,
    "제가 적은 방법은 설명이 어설픈 것 같아요. 아래 보충 답글은 남기고 이 글은 정리할게요.",
  );
  const planningDeletedFollowUp = await write(
    input.minjae,
    planningDeletedReply.id,
    FIXTURE_COMMENTS.planningDeletedFollowUp,
    "핵심은 작은 단위로 시작하는 거였어요. 원래 글을 정리해도 이 보충은 참고할 수 있게 남겨 둘게요.",
  );

  return {
    rootPlanning,
    rootMorning,
    rootRest,
    rootRecord,
    planningReply,
    planningFollowUp,
    planningDeepReply,
    planningDeepFollowUp,
    planningSecondReply,
    morningFirstReply,
    morningSecondReply,
    morningFollowUp,
    recordReply,
    planningOwnerReply,
    planningOwnerFollowUp,
    planningDeletedReply,
    planningDeletedFollowUp,
  };
}

async function applyLikes(input: {
  apiBaseUrl: string;
  todoId: number;
  jiyun: FixtureActor;
  hyunwoo: FixtureActor;
  seoyeon: FixtureActor;
  minjae: FixtureActor;
  comments: Record<string, FixtureComment>;
}): Promise<void> {
  const like = (actor: FixtureActor, key: string) => {
    const comment = input.comments[key];
    if (comment === undefined) {
      throw new Error(`[todo-comment-fixture] ${key} 좋아요 대상을 찾지 못했습니다.`);
    }
    return likeFixtureComment({
      apiBaseUrl: input.apiBaseUrl,
      todoId: input.todoId,
      actor,
      commentId: comment.id,
    });
  };

  await like(input.hyunwoo, "rootPlanning");
  await like(input.seoyeon, "rootPlanning");
  await like(input.minjae, "rootPlanning");
  await like(input.jiyun, "rootMorning");
  await like(input.minjae, "rootMorning");
  await like(input.jiyun, "rootRest");
  await like(input.hyunwoo, "planningDeepReply");
  await like(input.minjae, "planningDeepReply");
  await like(input.seoyeon, "recordReply");
}

async function applyTombstoneConversation(input: {
  db: TestDatabaseClient;
  apiBaseUrl: string;
  todoId: number;
  author: FixtureActor;
  viewer: FixtureActor;
  comments: Record<string, FixtureComment>;
}): Promise<void> {
  const deletedParent = input.comments.planningDeletedReply;
  if (deletedParent === undefined) {
    throw new Error("[todo-comment-fixture] 삭제 묘비 대상을 찾지 못했습니다.");
  }
  const storedParent = requireRecord(
    await input.db.query.todoComment.findFirst({
      where: { id: deletedParent.id },
      columns: { deletedAt: true },
    }),
  );

  if (storedParent.deletedAt === null) {
    await likeFixtureComment({
      apiBaseUrl: input.apiBaseUrl,
      todoId: input.todoId,
      actor: input.viewer,
      commentId: deletedParent.id,
    });
  }
  await deleteFixtureComment({
    apiBaseUrl: input.apiBaseUrl,
    todoId: input.todoId,
    actor: input.author,
    commentId: deletedParent.id,
  });
  await assertApiError({
    apiBaseUrl: input.apiBaseUrl,
    path: `/v1/todos/${input.todoId}/comments/${deletedParent.id}/likes`,
    method: "PUT",
    accessToken: input.viewer.accessToken,
    expectedStatus: HttpStatus.CONFLICT,
    expectedCode: ErrorCode.TODO_0833,
  });
}

async function main(): Promise<void> {
  const options = parseFixtureOptions();
  const target = assertTodoCommentDevelopmentFixtureTarget({
    nodeEnv: process.env.NODE_ENV,
    apiBaseUrl: process.env.API_BASE_URL,
    databaseUrl: process.env.DATABASE_URL,
  });
  const jwtSecret = z.string().min(16).parse(process.env.JWT_SECRET);
  const db = createTestClient(target.databaseUrl);

  try {
    await requestApi({
      apiBaseUrl: target.apiBaseUrl,
      path: "/health",
      schema: HealthSchema,
    });
    const owner = await db.query.user.findFirst({
      where: { id: options.ownerId },
      with: { profile: true },
    });
    if (owner === undefined) {
      throw new Error("[todo-comment-fixture] 지정한 local owner 계정을 찾지 못했습니다.");
    }
    const todo = await db.query.todo.findFirst({ where: { id: options.todoId } });
    if (todo === undefined || todo.userId !== owner.id) {
      throw new Error("[todo-comment-fixture] Todo가 지정한 owner에게 속하지 않습니다.");
    }
    if (todo.visibility !== "PUBLIC") {
      throw new Error("[todo-comment-fixture] fixture 대상 Todo는 PUBLIC이어야 합니다.");
    }

    const beforeCommentIds = new Set(
      (
        await db.query.todoComment.findMany({
          where: {
            todoId: options.todoId,
            clientRequestId: { in: Object.values(FIXTURE_COMMENTS) },
          },
          columns: { id: true },
        })
      ).map((comment) => comment.id),
    );

    writeOutput({
      mode: options.apply ? "apply" : "dry-run",
      target: {
        apiBaseUrl: target.apiBaseUrl,
        databaseHost: target.databaseHost,
        databaseName: target.databaseName,
        nodeEnv: process.env.NODE_ENV,
      },
      owner: {
        id: owner.id,
        userTag: owner.userTag,
        name: owner.profile?.name ?? null,
      },
      todo: { id: todo.id, title: todo.title, visibility: todo.visibility },
      fixture: {
        version: FIXTURE_VERSION,
        emailSuffix: FIXTURE_EMAIL_SUFFIX,
        expectedCommentRowCount: EXPECTED_FIXTURE_COMMENT_ROW_COUNT,
        expectedLiveCommentCount: EXPECTED_FIXTURE_LIVE_COMMENT_COUNT,
        expectedTombstoneCount: EXPECTED_FIXTURE_TOMBSTONE_COUNT,
        existingCommentCount: beforeCommentIds.size,
      },
    });

    if (!options.apply) {
      return;
    }

    const jiyun = await provisionFixtureActor({
      db,
      person: JIYUN,
      ownerId: owner.id,
      jwtSecret,
    });
    const hyunwoo = await provisionFixtureActor({
      db,
      person: HYUNWOO,
      ownerId: owner.id,
      jwtSecret,
    });
    const seoyeon = await provisionFixtureActor({
      db,
      person: SEOYEON,
      ownerId: owner.id,
      jwtSecret,
    });
    const minjae = await provisionFixtureActor({
      db,
      person: MINJAE,
      ownerId: owner.id,
      jwtSecret,
    });
    const actors = [jiyun, hyunwoo, seoyeon, minjae];
    const todoOwner = await provisionTodoOwnerActor({ db, owner, jwtSecret });

    for (const actor of [...actors, todoOwner]) {
      await verifyAuthenticatedActor(target.apiBaseUrl, actor);
    }

    const comments = await createCommentGraph({
      apiBaseUrl: target.apiBaseUrl,
      todoId: todo.id,
      jiyun,
      hyunwoo,
      seoyeon,
      minjae,
      todoOwner,
    });
    await applyLikes({
      apiBaseUrl: target.apiBaseUrl,
      todoId: todo.id,
      jiyun,
      hyunwoo,
      seoyeon,
      minjae,
      comments,
    });
    await applyTombstoneConversation({
      db,
      apiBaseUrl: target.apiBaseUrl,
      todoId: todo.id,
      author: seoyeon,
      viewer: minjae,
      comments,
    });
    const stored = await verifyStoredCalculations({
      db,
      todoId: todo.id,
      ownerId: owner.id,
      actors,
      comments,
    });
    await verifyApiReadModels({
      apiBaseUrl: target.apiBaseUrl,
      todoId: todo.id,
      todoOwnerId: owner.id,
      expectedTodoCommentCount: stored.todoCommentCount,
      viewer: hyunwoo,
      comments,
    });
    const commentIds = Object.fromEntries(
      Object.entries(comments).map(([key, comment]) => [key, comment.id]),
    );
    const createdCommentCount = Object.values(comments).filter(
      (comment) => !beforeCommentIds.has(comment.id),
    ).length;

    writeOutput({
      result: "verified",
      createdCommentCount,
      duplicateCommentCount:
        stored.fixtureCommentRowCount - new Set(Object.values(commentIds)).size,
      ...stored,
      fixtureUsers: FIXTURE_PEOPLE.map((person) => ({ name: person.name, email: person.email })),
      commentIds,
      cleanupSelector: {
        emailSuffix: FIXTURE_EMAIL_SUFFIX,
        sessionUserAgents: [FIXTURE_SESSION_USER_AGENT, FIXTURE_OWNER_SESSION_USER_AGENT],
        todoId: todo.id,
        clientRequestIds: Object.values(FIXTURE_COMMENTS),
      },
    });
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${getErrorMessage(error)}\n`);
  process.exitCode = 1;
});
