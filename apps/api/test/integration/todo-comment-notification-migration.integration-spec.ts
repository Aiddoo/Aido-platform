import { Pool } from "pg";

import { encodeCreate } from "#api/platform/database/database-records";
import { toInputJson } from "#api/platform/database/json.util";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("native migration graph의 댓글 알림 DB invariant와 정리 index", () => {
  let database: TestDatabase;
  let db: TestDatabaseClient;
  let pool: Pool;
  let userId: string;
  beforeAll(async () => {
    database = new TestDatabase();
    db = await database.start();
    pool = new Pool({ connectionString: database.getConnectionUri() });
  });
  beforeEach(async () => {
    await database.cleanup();
    const user = await db.orm.public.User.create(
      encodeCreate("User", { email: "notification-invariant@test.aido.app", userTag: "CHECK001" }),
    );
    userId = user.id;
  });
  afterAll(async () => {
    await pool.end();
    await database.stop();
  });
  it("댓글 DEEP_LINK URL을 거부하고 기존 type 기반 fallback과 외부 URL을 보존한다", async () => {
    const comment = {
      userId,
      type: "TODO_SHARED",
      title: "댓글",
      body: "댓글 내용",
      metadata: { commentId: "comment-1", senderId: "actor-1" },
    } satisfies Parameters<typeof encodeCreate<"Notification">>[1];
    await expect(
      db.orm.public.Notification.create(
        encodeCreate("Notification", { ...comment, actionUrl: "aido://comments/comment-1" }),
      ),
    ).rejects.toMatchObject({
      sqlState: "23514",
      constraint: "Notification_todo_comment_action_url_check",
    });
    const stored = await db.orm.public.Notification.create(
      encodeCreate("Notification", { ...comment, actionUrl: null }),
    );
    expect(stored.actionUrl).toBeNull();
    expect(stored.metadata).toEqual(comment.metadata);
    const external = await db.orm.public.Notification.create(
      encodeCreate("Notification", {
        ...comment,
        actionType: "BROWSER",
        actionUrl: "https://aido.kr/notice",
      }),
    );
    expect(external.actionUrl).toBe("https://aido.kr/notice");
  });
  it("댓글 알림의 senderId가 없거나 비어 있으면 DB에서도 거부한다", async () => {
    for (const metadata of [{ commentId: "comment-1" }, { commentId: "comment-1", senderId: "" }]) {
      await expect(
        db.orm.public.Notification.create(
          encodeCreate("Notification", {
            userId,
            type: "TODO_SHARED",
            title: "댓글",
            body: "내용",
            metadata: toInputJson(metadata),
          }),
        ),
      ).rejects.toMatchObject({
        sqlState: "23514",
        constraint: "Notification_todo_comment_sender_check",
      });
    }
  });
  it("기존 actor 정리 index가 유효하고 1만 행에서 두 조건 모두 index로 조회한다", async () => {
    await pool.query(
      `INSERT INTO public."Notification" ("userId", "type", "title", "body", "friendId", "metadata")
   SELECT $1, 'SYSTEM_NOTICE', '공지', '본문', CASE WHEN series = 10000 THEN 'actor-target' END,
    CASE WHEN series = 9999 THEN '{"senderId":"actor-target"}'::jsonb ELSE '{}'::jsonb END
   FROM generate_series(1, 10000) AS series`,
      [userId],
    );
    await pool.query('ANALYZE public."Notification"');
    const plan = await pool.query<{ "QUERY PLAN": string }>(
      `EXPLAIN (COSTS OFF) SELECT "userId" FROM public."Notification" WHERE "friendId" = $1 OR "metadata"->>'senderId' = $1`,
      ["actor-target"],
    );
    const text = plan.rows.map((row) => row["QUERY PLAN"]).join("\n");
    expect(text).toContain("BitmapOr");
    expect(text).toContain("Notification_friend_actor_cleanup_idx");
    expect(text).toContain("Notification_comment_actor_cleanup_idx");
    const indexes = await pool.query<{ name: string; valid: boolean }>(
      `SELECT c.relname AS name, i.indisvalid AS valid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.oid IN (to_regclass('public."Notification_friend_actor_cleanup_idx"'), to_regclass('public."Notification_comment_actor_cleanup_idx"')) ORDER BY name`,
    );
    expect(indexes.rows).toEqual([
      { name: "Notification_comment_actor_cleanup_idx", valid: true },
      { name: "Notification_friend_actor_cleanup_idx", valid: true },
    ]);
  });
});
