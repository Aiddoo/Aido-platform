import request from "supertest";
import { vi } from "vitest";

import { decodeRecord } from "#api/platform/database/database-records";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("할 일 부분 수정의 로컬 시간 계약", () => {
  let context: E2eTestContext;
  let accessToken: string;
  let todoId: number;

  beforeAll(async () => {
    context = await createE2eApp();
  });
  afterAll(async () => {
    await destroyE2eApp(context);
  });
  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-15T03:00:00.000Z"));
    const user = await context.helpers.createVerifiedUser(
      "todo-time-patch@example.com",
      "Test1234!",
    );
    accessToken = user.accessToken;
    const categoryId = await context.helpers.getDefaultCategoryId(accessToken);
    const response = await request(context.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", "Asia/Seoul")
      .send({
        title: "시간 변경 검증",
        categoryId,
        startDate: "2026-05-15",
        scheduledTime: "09:00",
        isAllDay: false,
      })
      .expect(201);
    todoId = response.body.data.todo.id;
    expect(response.body.data.todo).toMatchObject({
      startDate: "2026-05-15",
      scheduledTime: "2026-05-15T00:00:00.000Z",
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function patch(body: object, timezone = "Asia/Seoul") {
    return request(context.app.getHttpServer())
      .patch(`/v1/todos/${todoId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", timezone)
      .send(body);
  }
  async function savedSchedule() {
    return decodeRecord(
      "Todo",
      await context.testDatabase
        .getClient()
        .orm.public.Todo.where({ id: todoId })
        .select("startDate", "scheduledTime", "endDate")
        .first(),
    );
  }

  it("날짜 없이 시간만 수정하면 기존 DATE를 유지하고 요청한 UTC 시각을 저장한다", async () => {
    // Given
    const before = await savedSchedule();
    // When
    const response = await patch({ scheduledTime: "12:30" }).expect(200);
    // Then
    expect(response.body.data.todo).toMatchObject({
      startDate: "2026-05-15",
      scheduledTime: "2026-05-15T03:30:00.000Z",
    });
    expect(await savedSchedule()).toEqual({
      ...before,
      scheduledTime: new Date("2026-05-15T03:30:00.000Z"),
    });
  });

  it("제목과 시간만 함께 수정해도 날짜 없이 요청한 시간을 반영한다", async () => {
    // Given / When
    const response = await patch({ title: "시간 변경된 제목", scheduledTime: "12:30" }).expect(200);
    // Then
    expect(response.body.data.todo).toMatchObject({
      title: "시간 변경된 제목",
      startDate: "2026-05-15",
      scheduledTime: "2026-05-15T03:30:00.000Z",
    });
    expect((await savedSchedule())?.scheduledTime).toEqual(new Date("2026-05-15T03:30:00.000Z"));
  });

  it("새 날짜와 시간이 함께 오면 새 DATE의 로컬 시간으로 변환한다", async () => {
    // Given / When
    const response = await patch({ startDate: "2026-05-16", scheduledTime: "12:30" }).expect(200);
    // Then
    expect(response.body.data.todo).toMatchObject({
      startDate: "2026-05-16",
      scheduledTime: "2026-05-16T03:30:00.000Z",
    });
    expect(await savedSchedule()).toMatchObject({
      startDate: new Date("2026-05-16T00:00:00.000Z"),
      scheduledTime: new Date("2026-05-16T03:30:00.000Z"),
    });
  });

  it("시간 생략은 유지하고 null은 해제하며 잘못된 25시는 저장하지 않는다", async () => {
    // Given
    const before = await savedSchedule();
    // When
    const invalid = await patch({ scheduledTime: "25:00" }).expect(400);
    const afterInvalid = await savedSchedule();
    const omitted = await patch({ title: "시간 유지" }).expect(200);
    const cleared = await patch({ scheduledTime: null }).expect(200);
    // Then
    expect(invalid.body.success).toBe(false);
    expect(afterInvalid).toEqual(before);
    expect(omitted.body.data.todo.scheduledTime).toBe("2026-05-15T00:00:00.000Z");
    expect(cleared.body.data.todo).toMatchObject({ startDate: "2026-05-15", scheduledTime: null });
    expect((await savedSchedule())?.scheduledTime).toBeNull();
  });

  it.each([
    { timezone: "UTC", expected: "2026-05-15T12:30:00.000Z" },
    { timezone: "America/Los_Angeles", expected: "2026-05-15T19:30:00.000Z" },
  ])("$timezone에서도 저장된 DATE 기준으로 시간만 수정한다", async ({ timezone, expected }) => {
    // Given / When
    const response = await patch({ scheduledTime: "12:30" }, timezone).expect(200);
    // Then
    expect(response.body.data.todo).toMatchObject({
      startDate: "2026-05-15",
      scheduledTime: expected,
    });
    expect((await savedSchedule())?.scheduledTime).toEqual(new Date(expected));
  });
});
