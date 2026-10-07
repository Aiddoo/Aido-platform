import { z } from "zod";

import { decodeRecord, encodeCreate, encodePatch } from "./database-records.js";
import { createEntityId } from "./database-values.js";

describe("DB record 변환 경계", () => {
  it("relation count 집계 값을 숫자로 유지한다", () => {
    expect(decodeRecord("TodoCategory", { id: 1, todos: 0 })).toEqual({ id: 1, todos: 0 });
    expect(decodeRecord("User", { todos: 12 })).toEqual({ todos: 12 });
  });

  it("정의된 날짜 필드와 중첩 model row만 변환한다", () => {
    const decoded = decodeRecord("Todo", {
      startDate: "2025-01-02",
      completedAt: "2025-01-03T11:12:13.456",
      category: { createdAt: "2025-01-01T01:02:03.456" },
    });
    expect(decoded.startDate).toEqual(new Date("2025-01-02T00:00:00.000Z"));
    expect(decoded.completedAt).toEqual(new Date("2025-01-03T11:12:13.456Z"));
    expect(decoded.category.createdAt).toEqual(new Date("2025-01-01T01:02:03.456Z"));
  });

  it("날짜처럼 보이는 JSON 문자열과 nullable 필드를 유지한다", () => {
    const metadata = { date: "2025-01-02", nested: { createdAt: "2025-01-03T11:12:13.456" } };
    expect(
      decodeRecord("Notification", { _type: "SYSTEM_NOTICE", metadata, readAt: null }),
    ).toEqual({
      type: "SYSTEM_NOTICE",
      metadata,
      readAt: null,
    });
  });

  it("서로 다른 시간대에서도 예약 시각과 밀리초를 유지한다", () => {
    const instant = new Date("2025-01-03T20:12:13.456+09:00");
    const encoded = encodePatch("Todo", { scheduledTime: instant });
    expect(decodeRecord("Todo", encoded).scheduledTime).toEqual(instant);
    expect(
      decodeRecord("Todo", { scheduledTime: "2025-01-03 20:12:13.456+09" }).scheduledTime,
    ).toEqual(instant);
    expect(encodePatch("Todo", { scheduledTime: null }).scheduledTime).toBeNull();
  });

  it("undefined 필드는 갱신에서 제외하고 명시적 null은 저장한다", () => {
    expect(encodePatch("UserProfile", { name: undefined, profileImage: null })).toEqual({
      profileImage: null,
    });
    expect(() => encodePatch("User", { email: undefined })).not.toThrow();
  });

  it("새로 생성한 ID가 기존 CUID 계약을 준수한다", () => {
    const ids = Array.from({ length: 1000 }, () => createEntityId());
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(z.cuid().safeParse(id).success).toBe(true);
    const input = encodeCreate("User", {
      email: "compatibility@test.aido.app",
      userTag: "COMPAT08",
    });
    expect(z.cuid().safeParse(input.id).success).toBe(true);
  });
});
