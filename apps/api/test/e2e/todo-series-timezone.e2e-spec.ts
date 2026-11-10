import { createTodoResponseSchema, todoSeriesResponseSchema } from "@aido/api";
import { eq } from "drizzle-orm";
import request from "supertest";

import { userPreference } from "#api/platform/database/schema/index";
import { addDaysToDateKey } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseLocalDateTime, todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { instantFromDate } from "#api/shared/domain/time/instant";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const SEOUL = "Asia/Seoul";
const NEW_YORK = "America/New_York";
const INVALID = "Mars/Phobos";
/** 가입 때 저장된 시간대. 잘못된 헤더는 저장값으로 해석한다. */
const STORED_DEFAULT = "UTC";

const DEVICES = [
  { device: "서울 기기", header: SEOUL, resolved: SEOUL },
  { device: "뉴욕 기기", header: NEW_YORK, resolved: NEW_YORK },
  { device: "잘못된 헤더", header: INVALID, resolved: null },
] as const;

const RULE_ZONES = [
  { rule: "서울 규칙", ruleZone: SEOUL },
  { rule: "진짜 UTC 규칙", ruleZone: "UTC" },
] as const;

const EDIT_CASES = DEVICES.flatMap((device) => RULE_ZONES.map((rule) => ({ ...device, ...rule })));

describe("반복 할 일의 시간대 규칙 E2E", () => {
  let ctx: E2eTestContext;
  let accessToken: string;
  let userId: string;
  let categoryId: number;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60000);
  afterAll(async () => {
    await destroyE2eApp(ctx);
  });
  beforeEach(async () => {
    await ctx.reset();
    const user = await ctx.helpers.createVerifiedUser("series-zone@example.com", "Test1234!");
    accessToken = user.accessToken;
    userId = user.userId;
    categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
  });

  const startDate = () => addDaysToDateKey(toDateString(todayInTimezone(SEOUL)), 2);

  /** 자가 치유는 응답과 따로 돌므로 저장값이 필요한 경우를 정해 둔다. */
  async function storeTimezone(zone: string) {
    await ctx.testDatabase
      .getClient()
      .update(userPreference)
      .set({ timezone: zone })
      .where(eq(userPreference.userId, userId));
  }

  async function createSeries(zone: string, time: string | null = "09:00") {
    const response = await request(ctx.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", zone)
      .send({
        title: "회차",
        categoryId,
        startDate: startDate(),
        ...(time == null ? { isAllDay: true } : { scheduledTime: time, isAllDay: false }),
        repeat: { frequency: "DAILY", end: { type: "COUNT", count: 3 } },
      })
      .expect(201);
    const body = createTodoResponseSchema.parse(response.body.data);
    return { seriesId: body.series?.id ?? "" };
  }

  function occurrences(seriesId: string) {
    return ctx.testDatabase
      .getClient()
      .query.todo.findMany({ where: { seriesId }, orderBy: { occurrenceDate: "asc" } });
  }

  function patch(id: number, zone: string, body: object) {
    return request(ctx.app.getHttpServer())
      .patch(`/v1/todos/${id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", zone)
      .send(body)
      .expect(200);
  }

  async function readSeries(seriesId: string, zone: string) {
    const response = await request(ctx.app.getHttpServer())
      .get(`/v1/todo-series/${seriesId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", zone)
      .expect(200);
    return todoSeriesResponseSchema.parse(response.body.data);
  }

  describe("만들기", () => {
    it.each(DEVICES)("$device: 고른 시각을 그 시간대로 저장한다", async ({ header, resolved }) => {
      // Given
      const zone = resolved ?? STORED_DEFAULT;
      // When
      const { seriesId } = await createSeries(header);
      // Then
      const rows = await occurrences(seriesId);
      expect(rows.map((row) => row.scheduledTime)).toEqual(
        rows.map((row) =>
          instantFromDate(parseLocalDateTime(row.startDate.toString(), "09:00", zone)),
        ),
      );
      expect(rows.every((row) => row.scheduledLocalTime === "09:00")).toBe(true);
      expect(await readSeries(seriesId, header)).toMatchObject({
        scheduledTime: "09:00",
        timezone: zone,
      });
    });

    it.each(DEVICES)("$device: 종일은 날짜가 밀리지 않고 시각이 없다", async ({ header }) => {
      // When
      const { seriesId } = await createSeries(header, null);
      // Then
      const rows = await occurrences(seriesId);
      expect(rows[0]?.startDate.toString()).toBe(startDate());
      expect(rows.every((row) => row.scheduledTime == null && row.isAllDay)).toBe(true);
      expect(await readSeries(seriesId, header)).toMatchObject({ scheduledTime: null });
    });
  });

  describe("이후 모두", () => {
    it.each(EDIT_CASES)(
      "$rule, $device: 시간을 고치면 그 시간대의 시각이 되고 규칙 시간대도 바뀐다",
      async ({ ruleZone, header, resolved }) => {
        // Given
        const zone = resolved ?? ruleZone;
        const { seriesId } = await createSeries(ruleZone);
        await storeTimezone(ruleZone);
        const [first, second, third] = await occurrences(seriesId);
        // When
        await patch(second?.id ?? 0, header, {
          scope: "THIS_AND_FOLLOWING",
          scheduledTime: "10:00",
          isAllDay: false,
        });
        // Then
        const rows = await occurrences(seriesId);
        expect(rows[0]?.scheduledTime).toEqual(first?.scheduledTime);
        expect(rows.slice(1).map((row) => row.scheduledTime)).toEqual(
          [second, third].map((row) =>
            instantFromDate(parseLocalDateTime(String(row?.startDate), "10:00", zone)),
          ),
        );
        expect(await readSeries(seriesId, header)).toMatchObject({
          scheduledTime: "10:00",
          timezone: zone,
        });
      },
    );

    it.each(EDIT_CASES)(
      "$rule, $device: 제목만 고치면 시각이 그대로다",
      async ({ ruleZone, header }) => {
        // Given
        const { seriesId } = await createSeries(ruleZone);
        const before = await occurrences(seriesId);
        // When
        await patch(before[1]?.id ?? 0, header, {
          scope: "THIS_AND_FOLLOWING",
          title: "새 제목",
        });
        // Then
        const rows = await occurrences(seriesId);
        expect(rows.map((row) => row.scheduledTime)).toEqual(
          before.map((row) => row.scheduledTime),
        );
        expect(rows.map((row) => row.title)).toEqual(["회차", "새 제목", "새 제목"]);
        expect(await readSeries(seriesId, header)).toMatchObject({
          title: "새 제목",
          scheduledTime: "09:00",
        });
      },
    );

    it.each(EDIT_CASES)(
      "$rule, $device: 시간을 지우면 종일이 된다",
      async ({ ruleZone, header }) => {
        // Given
        const { seriesId } = await createSeries(ruleZone);
        const before = await occurrences(seriesId);
        // When
        await patch(before[0]?.id ?? 0, header, {
          scope: "THIS_AND_FOLLOWING",
          scheduledTime: null,
          isAllDay: true,
        });
        // Then
        const rows = await occurrences(seriesId);
        expect(rows.every((row) => row.scheduledTime == null && row.isAllDay)).toBe(true);
        expect(await readSeries(seriesId, header)).toMatchObject({ scheduledTime: null });
      },
    );

    it.each(EDIT_CASES)(
      "$rule, $device: 규칙과 시간을 함께 고치면 뒤 구간만 새 시간대다",
      async ({ ruleZone, header, resolved }) => {
        // Given
        const zone = resolved ?? ruleZone;
        const { seriesId } = await createSeries(ruleZone);
        await storeTimezone(ruleZone);
        const before = await occurrences(seriesId);
        // When
        await patch(before[1]?.id ?? 0, header, {
          scope: "THIS_AND_FOLLOWING",
          scheduledTime: "10:00",
          isAllDay: false,
          repeat: { frequency: "DAILY", end: { type: "COUNT", count: 5 } },
        });
        // Then
        const moved = await ctx.testDatabase.getClient().query.todo.findFirst({
          where: { id: before[1]?.id ?? 0 },
        });
        const newSeriesId = moved?.seriesId ?? "";
        expect(newSeriesId).not.toBe(seriesId);
        expect(await readSeries(seriesId, header)).toMatchObject({
          scheduledTime: "09:00",
          timezone: ruleZone,
        });
        expect(await readSeries(newSeriesId, header)).toMatchObject({
          scheduledTime: "10:00",
          timezone: zone,
        });
        const rows = await occurrences(newSeriesId);
        expect(rows.map((row) => row.scheduledTime)).toEqual(
          rows.map((row) =>
            instantFromDate(parseLocalDateTime(row.startDate.toString(), "10:00", zone)),
          ),
        );
      },
    );
  });

  describe("이 할 일만", () => {
    it.each(EDIT_CASES)(
      "$rule, $device: 고치면 그 회차만 그 시간대의 시각이고 규칙의 시각은 그대로다",
      async ({ ruleZone, header, resolved }) => {
        // Given
        const zone = resolved ?? ruleZone;
        const { seriesId } = await createSeries(ruleZone);
        await storeTimezone(ruleZone);
        const before = await occurrences(seriesId);
        const target = before[1];
        // When
        await patch(target?.id ?? 0, header, { scheduledTime: "10:00", isAllDay: false });
        // Then
        const rows = await occurrences(seriesId);
        expect(rows[1]?.scheduledTime).toEqual(
          instantFromDate(parseLocalDateTime(String(target?.startDate), "10:00", zone)),
        );
        expect(rows[0]?.scheduledTime).toEqual(before[0]?.scheduledTime);
        expect(rows[2]?.scheduledTime).toEqual(before[2]?.scheduledTime);
        expect(await readSeries(seriesId, header)).toMatchObject({ scheduledTime: "09:00" });
      },
    );
  });

  describe("단일 → 반복 전환", () => {
    it.each(DEVICES)(
      "$device: 그 기기의 시각과 시간대를 규칙에 저장한다",
      async ({ header, resolved }) => {
        // Given
        const created = await request(ctx.app.getHttpServer())
          .post("/v1/todos")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", header)
          .send({
            title: "단일",
            categoryId,
            startDate: startDate(),
            scheduledTime: "09:00",
            isAllDay: false,
          })
          .expect(201);
        const todo = createTodoResponseSchema.parse(created.body.data).todo;
        // When
        await patch(todo.id, header, {
          repeat: { frequency: "DAILY", end: { type: "COUNT", count: 2 } },
        });
        // Then
        const row = await ctx.testDatabase
          .getClient()
          .query.todo.findFirst({ where: { id: todo.id } });
        expect(await readSeries(row?.seriesId ?? "", header)).toMatchObject({
          scheduledTime: "09:00",
          timezone: resolved ?? STORED_DEFAULT,
        });
      },
    );
  });
});
