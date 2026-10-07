import { z } from "zod";

import { decodeRecord, encodeCreate, encodePatch } from "./database-records.js";
import { createEntityId } from "./database-values.js";

describe("database record boundary", () => {
  it("keeps relation count reducers as numbers", () => {
    expect(decodeRecord("TodoCategory", { id: 1, todos: 0 })).toEqual({ id: 1, todos: 0 });
    expect(decodeRecord("User", { todos: 12 })).toEqual({ todos: 12 });
  });

  it("decodes only declared date fields and nested model rows", () => {
    const decoded = decodeRecord("Todo", {
      startDate: "2025-01-02",
      completedAt: "2025-01-03T11:12:13.456",
      category: { createdAt: "2025-01-01T01:02:03.456" },
    });
    expect(decoded.startDate).toEqual(new Date("2025-01-02T00:00:00.000Z"));
    expect(decoded.completedAt).toEqual(new Date("2025-01-03T11:12:13.456Z"));
    expect(decoded.category.createdAt).toEqual(new Date("2025-01-01T01:02:03.456Z"));
  });

  it("preserves JSON date-looking values and nullable fields", () => {
    const metadata = { date: "2025-01-02", nested: { createdAt: "2025-01-03T11:12:13.456" } };
    expect(
      decodeRecord("Notification", { _type: "SYSTEM_NOTICE", metadata, readAt: null }),
    ).toEqual({
      type: "SYSTEM_NOTICE",
      metadata,
      readAt: null,
    });
  });

  it("preserves scheduled instants and milliseconds across time zones", () => {
    const instant = new Date("2025-01-03T20:12:13.456+09:00");
    const encoded = encodePatch("Todo", { scheduledTime: instant });
    expect(decodeRecord("Todo", encoded).scheduledTime).toEqual(instant);
    expect(
      decodeRecord("Todo", { scheduledTime: "2025-01-03 20:12:13.456+09" }).scheduledTime,
    ).toEqual(instant);
    expect(encodePatch("Todo", { scheduledTime: null }).scheduledTime).toBeNull();
  });

  it("omits undefined updates and explicitly clears nullable fields", () => {
    expect(encodePatch("UserProfile", { name: undefined, profileImage: null })).toEqual({
      profileImage: null,
    });
    expect(() => encodePatch("User", { email: undefined })).not.toThrow();
  });

  it("keeps generated IDs valid under the existing CUID contract", () => {
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
