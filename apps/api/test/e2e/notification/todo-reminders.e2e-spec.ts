import { todoReminderSnoozeResponseSchema } from "@aido/api/contracts/notification/v1";
import { createTodoResponseSchema } from "@aido/api/contracts/todo/v1";
import { ErrorCode } from "@aido/api/errors";
import request from "supertest";

import {
  TODO_REMINDER_QUEUE,
  TODO_REMINDER_SNOOZE_JOB_NAME,
} from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder.queue";
import { notification } from "#api/platform/database/schema/index";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { nowInstant, shiftDateKey, todayIn } from "#test/fixtures/platform/clock.fixture";

const SEOUL = "Asia/Seoul";
const PASSWORD = "Test1234!";

describe("리마인드 알림 다시 받기 E2E", () => {
  let testContext: E2eTestContext;
  let accessToken: string;
  let ownerId: string;
  let categoryId: number;

  beforeAll(async () => {
    testContext = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(testContext);
  });

  beforeEach(async () => {
    await testContext.reset();
    const owner = await testContext.helpers.createVerifiedUser("snooze@example.com", PASSWORD);
    accessToken = owner.accessToken;
    ownerId = owner.userId;
    categoryId = await testContext.helpers.getDefaultCategoryId(accessToken);
  });

  function jobQueue(): InMemoryJobQueue {
    const queue = testContext.module.get(JobQueuePort);
    if (!(queue instanceof InMemoryJobQueue)) {
      throw new Error("E2E 앱은 InMemoryJobQueue를 쓴다");
    }
    return queue;
  }

  function snoozeJobs() {
    return jobQueue()
      .jobsIn(TODO_REMINDER_QUEUE)
      .filter(({ payload }) => "name" in payload && payload.name === TODO_REMINDER_SNOOZE_JOB_NAME);
  }

  async function createTodo(token = accessToken, ownCategoryId = categoryId): Promise<number> {
    const response = await request(testContext.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Timezone", SEOUL)
      .send({
        title: "저녁 운동",
        categoryId: ownCategoryId,
        startDate: shiftDateKey(todayIn(SEOUL).toString(), 1),
        scheduledTime: "20:00",
        isAllDay: false,
      })
      .expect(201);
    return createTodoResponseSchema.parse(response.body.data).todo.id;
  }

  async function seedReminder(todoId: number, stage = "10min"): Promise<number> {
    const [row] = await testContext.testDatabase
      .getClient()
      .insert(notification)
      .values({
        userId: ownerId,
        type: "TODO_REMINDER",
        title: "곧 시작할 시간이에요",
        body: "‘저녁 운동’까지 10분 남았어요",
        todoId,
        metadata: { stage },
      })
      .returning({ id: notification.id });
    if (row == null) {
      throw new Error("리마인드 알림을 넣지 못했다");
    }
    return row.id;
  }

  function snooze(todoId: number, body: object) {
    return request(testContext.app.getHttpServer())
      .post(`/v1/todo-reminders/${todoId}/snoozes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(body);
  }

  it("내 미완료 할 일이면 202와 10분 뒤 시각을 주고 다시 알림 작업을 하나 예약한다", async () => {
    // Given
    const todoId = await createTodo();
    const notificationId = await seedReminder(todoId);
    const before = nowInstant();

    // When
    const response = await snooze(todoId, { notificationId }).expect(202);

    // Then
    const { remindAt } = todoReminderSnoozeResponseSchema.parse(response.body.data);
    const remindAtInstant = Temporal.Instant.from(remindAt);
    expect(
      Temporal.Instant.compare(remindAtInstant, before.add({ minutes: 10 })),
    ).toBeGreaterThanOrEqual(0);
    expect(
      Temporal.Instant.compare(remindAtInstant, nowInstant().add({ minutes: 10 })),
    ).toBeLessThanOrEqual(0);
    expect(snoozeJobs()).toEqual([
      expect.objectContaining({
        options: expect.objectContaining({
          idempotencyKey: `reminder-snooze_${todoId}_${notificationId}`,
        }),
      }),
    ]);
  });

  it("같은 알림으로 두 번 보내면 두 번 다 202이고 예약은 하나이며 같은 시각을 준다", async () => {
    // Given
    const todoId = await createTodo();
    const notificationId = await seedReminder(todoId);

    // When
    const first = await snooze(todoId, { notificationId }).expect(202);
    const second = await snooze(todoId, { notificationId }).expect(202);

    // Then
    expect(second.body.data).toEqual(first.body.data);
    expect(snoozeJobs()).toHaveLength(1);
  });

  it("다른 할 일의 알림과 반복 알림 멈춤 안내로는 404 NOTIFICATION_1004이고 예약하지 않는다", async () => {
    // Given
    const todoId = await createTodo();
    const otherTodoReminderId = await seedReminder(await createTodo());
    const pausedNoticeId = await seedReminder(todoId, "series-paused");

    // When
    const responses = await Promise.all(
      [otherTodoReminderId, pausedNoticeId].map(async (notificationId) =>
        snooze(todoId, { notificationId }).expect(404),
      ),
    );

    // Then
    expect(responses.map(({ body }) => body.error.code)).toEqual([
      ErrorCode.NOTIFICATION_1004,
      ErrorCode.NOTIFICATION_1004,
    ]);
    expect(snoozeJobs()).toEqual([]);
  });

  it("없는 할 일과 남의 할 일은 404 TODO_0801이고 예약하지 않는다", async () => {
    // Given
    const other = await testContext.helpers.createVerifiedUser("other@example.com", PASSWORD);
    const otherTodoId = await createTodo(
      other.accessToken,
      await testContext.helpers.getDefaultCategoryId(other.accessToken),
    );

    const notificationId = await seedReminder(await createTodo());

    // When
    const missing = await snooze(999_999, { notificationId }).expect(404);
    const foreign = await snooze(otherTodoId, { notificationId }).expect(404);

    // Then
    expect([missing.body.error.code, foreign.body.error.code]).toEqual([
      ErrorCode.TODO_0801,
      ErrorCode.TODO_0801,
    ]);
    expect(snoozeJobs()).toEqual([]);
  });

  it("완료한 할 일은 409 NOTIFICATION_1007이고 예약하지 않는다", async () => {
    // Given
    const todoId = await createTodo();
    const notificationId = await seedReminder(todoId);
    await request(testContext.app.getHttpServer())
      .patch(`/v1/todos/${todoId}/complete`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ completed: true })
      .expect(200);

    // When
    const response = await snooze(todoId, { notificationId }).expect(409);

    // Then
    expect(response.body.error.code).toBe(ErrorCode.NOTIFICATION_1007);
    expect(snoozeJobs()).toEqual([]);
  });

  it("누른 알림 id가 없으면 400이다", async () => {
    // Given
    const todoId = await createTodo();

    // When
    const response = await snooze(todoId, {}).expect(400);

    // Then
    expect(response.body.error.code).toBe(ErrorCode.SYS_0002);
  });
});
