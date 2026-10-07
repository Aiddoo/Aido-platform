import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { Suggestion, type SuggestionProps } from "./suggestion.aggregate.js";

const at = new Date("2026-03-23T00:00:00.000Z");
function suggestion(overrides: Partial<SuggestionProps> = {}): Suggestion {
  return Suggestion.reconstitute({
    id: 1,
    userId: "suggestion-user",
    title: "팀 미팅",
    daysOfWeek: ["MON"],
    scheduledTime: "10:00",
    confidence: 0.9,
    reason: "최근 기록",
    matchedTodos: ["팀 미팅"],
    suggestedCategoryId: 1,
    status: "PENDING",
    expiresAt: new Date("2026-03-30T00:00:00.000Z"),
    createdAt: at,
    updatedAt: at,
    ...overrides,
  });
}

describe("Suggestion 상태 전이", () => {
  it.each(["accept", "dismiss"] as const)(
    "대기 제안을 %s하고 같은 제안을 다시 처리할 수 없다",
    (action) => {
      const model = suggestion();
      model[action](at);
      expect(model.status).toBe(action === "accept" ? "ACCEPTED" : "DISMISSED");
      try {
        model.accept(at);
        throw new Error("다시 수락됨");
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error).toMatchObject({ errorCode: ErrorCode.AI_1306 });
      }
    },
  );
  it("처리된 만료 제안은 만료보다 처리 상태 오류가 먼저다", () => {
    const model = suggestion({
      status: "ACCEPTED",
      expiresAt: new Date("2026-03-22T00:00:00.000Z"),
    });
    expect(() => model.dismiss(at)).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.AI_1306 }),
    );
  });
  it("만료된 대기 제안은 상태를 바꾸지 않는다", () => {
    const model = suggestion({ expiresAt: new Date("2026-03-22T00:00:00.000Z") });
    expect(() => model.accept(at)).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.AI_1307 }),
    );
    expect(model.status).toBe("PENDING");
  });
  it("만료 시각과 같은 시각은 기존 경계대로 처리할 수 있다", () => {
    const model = suggestion({ expiresAt: at });
    model.accept(at);
    expect(model.status).toBe("ACCEPTED");
  });
  it("복원 입력과 반환 날짜를 바꿔도 만료 판단은 변하지 않는다", () => {
    const expiresAt = new Date("2026-03-30T00:00:00.000Z");
    const model = suggestion({ expiresAt });
    expiresAt.setUTCFullYear(2020);
    model.expiresAt.setUTCFullYear(2020);
    expect(model.isExpired(at)).toBe(false);
  });
});
