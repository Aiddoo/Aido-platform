import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import {
  Suggestion,
  type SuggestionProps,
} from "../../../domain/aggregates/suggestions/suggestion.aggregate.js";
import { type AiSuggestionRepositoryPort } from "../../ports/suggestions/ai-suggestion.repository.port.js";
import { type RecurringTodoCreatorPort } from "../../ports/suggestions/recurring-todo-creator.port.js";
import { HandleSuggestionAction } from "./handle-suggestion-action.use-case.js";

const mockUserId = "user-123";

function createSuggestion(overrides?: Partial<SuggestionProps>): Suggestion {
  return Suggestion.reconstitute({
    id: 1,
    userId: mockUserId,
    title: "팀 미팅",
    daysOfWeek: ["MON", "WED", "FRI"],
    scheduledTime: "10:00",
    confidence: 0.85,
    reason: "매주 반복되는 패턴",
    matchedTodos: ["팀 미팅", "팀 회의"],
    status: "PENDING",
    suggestedCategoryId: 3,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14일 후
    createdAt: new Date("2026-03-04T00:00:00.000Z"),
    updatedAt: new Date("2026-03-04T00:00:00.000Z"),
    ...overrides,
  });
}

describe("HandleSuggestionAction", () => {
  let useCase: HandleSuggestionAction;
  let repo: Mocked<AiSuggestionRepositoryPort>;
  let creator: Mocked<RecurringTodoCreatorPort>;
  let entitlement: Mocked<EntitlementService>;

  beforeEach(async () => {
    const handleSuggestionActionDependencies = mockDeep<
      ConstructorParameters<typeof HandleSuggestionAction>[0]
    >({});
    const unit = new HandleSuggestionAction(handleSuggestionActionDependencies);

    useCase = unit;
    repo = handleSuggestionActionDependencies.repository;
    creator = handleSuggestionActionDependencies.recurringTodoCreator;
    entitlement = handleSuggestionActionDependencies.entitlementService;

    entitlement.hasPremiumAccess.mockResolvedValue(true);
  });

  it("비프리미엄 사용자면 AI_1309 예외를 던지고 조회하지 않아야 한다", async () => {
    entitlement.hasPremiumAccess.mockResolvedValue(false);

    await expect(
      useCase.execute({
        userId: mockUserId,
        suggestionId: 1,
        action: "dismiss",
        timezone: "Asia/Seoul",
      }),
    ).rejects.toBeInstanceOf(ApplicationException);
    expect(repo.findByIdAndUserId).not.toHaveBeenCalled();
  });

  it("존재하지 않는 제안에 대해 AI_1305(ApplicationException)를 던져야 한다", async () => {
    repo.findByIdAndUserId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: mockUserId,
        suggestionId: 999,
        action: "accept",
        categoryId: 5,
        timezone: "Asia/Seoul",
      }),
    ).rejects.toBeInstanceOf(ApplicationException);
    expect(repo.findByIdAndUserId).toHaveBeenCalledWith(999, mockUserId);
  });

  it("이미 처리된 제안에 대해 AI_1306(DomainException)을 던져야 한다", async () => {
    repo.findByIdAndUserId.mockResolvedValue(createSuggestion({ status: "ACCEPTED" }));

    await expect(
      useCase.execute({
        userId: mockUserId,
        suggestionId: 1,
        action: "accept",
        timezone: "Asia/Seoul",
      }),
    ).rejects.toBeInstanceOf(DomainException);
  });

  it("만료된 제안에 대해 AI_1307(DomainException)을 던져야 한다", async () => {
    repo.findByIdAndUserId.mockResolvedValue(
      createSuggestion({ expiresAt: new Date("2020-01-01T00:00:00.000Z") }),
    );

    await expect(
      useCase.execute({
        userId: mockUserId,
        suggestionId: 1,
        action: "accept",
        timezone: "Asia/Seoul",
      }),
    ).rejects.toBeInstanceOf(DomainException);
  });

  it("거절 시 상태를 DISMISSED로 업데이트해야 한다", async () => {
    repo.findByIdAndUserId.mockResolvedValue(createSuggestion());
    repo.updateStatus.mockResolvedValue(createSuggestion({ status: "DISMISSED" }));

    const result = await useCase.execute({
      userId: mockUserId,
      suggestionId: 1,
      action: "dismiss",
      timezone: "Asia/Seoul",
    });

    expect(repo.updateStatus).toHaveBeenCalledWith(1, "DISMISSED");
    expect(result.suggestion.status).toBe("DISMISSED");
    expect(result.message).toContain("거절");
    expect(result.createdTodosCount).toBeUndefined();
    expect(creator.createRecurring).not.toHaveBeenCalled();
  });

  it("수락 시 categoryId가 없으면 SYS_0002 예외를 던져야 한다", async () => {
    repo.findByIdAndUserId.mockResolvedValue(createSuggestion());

    await expect(
      useCase.execute({
        userId: mockUserId,
        suggestionId: 1,
        action: "accept",
        timezone: "Asia/Seoul",
      }),
    ).rejects.toBeInstanceOf(ApplicationException);
    expect(creator.createRecurring).not.toHaveBeenCalled();
  });

  it("수락 시 상태를 먼저 ACCEPTED로 변경한 후 반복 할 일을 생성해야 한다", async () => {
    repo.findByIdAndUserId.mockResolvedValue(createSuggestion());
    repo.updateStatus.mockResolvedValue(createSuggestion({ status: "ACCEPTED" }));
    creator.createRecurring.mockResolvedValue({ count: 12 });

    const result = await useCase.execute({
      userId: mockUserId,
      suggestionId: 1,
      action: "accept",
      categoryId: 5,
      timezone: "Asia/Seoul",
    });

    // 상태 변경이 반복 생성보다 먼저 호출되어야 한다
    const updateStatusOrder = repo.updateStatus.mock.invocationCallOrder[0] ?? 0;
    const createRecurringOrder = creator.createRecurring.mock.invocationCallOrder[0] ?? 0;
    expect(updateStatusOrder).toBeLessThan(createRecurringOrder);

    expect(repo.updateStatus).toHaveBeenCalledWith(1, "ACCEPTED");
    expect(creator.createRecurring).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserId,
        title: "팀 미팅",
        categoryId: 5,
        daysOfWeek: ["MON", "WED", "FRI"],
        scheduledTime: "10:00",
      }),
      "Asia/Seoul",
    );
    expect(result.suggestion.status).toBe("ACCEPTED");
    expect(result.createdTodosCount).toBe(12);
  });

  it("수락 시 투두 생성 실패하면 상태가 PENDING으로 롤백되어야 한다", async () => {
    repo.findByIdAndUserId.mockResolvedValue(createSuggestion());
    repo.updateStatus.mockResolvedValue(createSuggestion({ status: "ACCEPTED" }));
    creator.createRecurring.mockRejectedValue(new Error("투두 생성 실패"));

    await expect(
      useCase.execute({
        userId: mockUserId,
        suggestionId: 1,
        action: "accept",
        categoryId: 5,
        timezone: "Asia/Seoul",
      }),
    ).rejects.toThrow("투두 생성 실패");

    expect(repo.updateStatus).toHaveBeenCalledTimes(2);
    expect(repo.updateStatus).toHaveBeenNthCalledWith(1, 1, "ACCEPTED");
    expect(repo.updateStatus).toHaveBeenNthCalledWith(2, 1, "PENDING");
  });

  it("수락 시 투두 생성 실패 후 롤백도 실패하면 원본 에러가 전파되어야 한다", async () => {
    repo.findByIdAndUserId.mockResolvedValue(createSuggestion());
    repo.updateStatus
      .mockResolvedValueOnce(createSuggestion({ status: "ACCEPTED" }))
      .mockRejectedValueOnce(new Error("DB 연결 끊김"));
    creator.createRecurring.mockRejectedValue(new Error("투두 생성 실패"));

    await expect(
      useCase.execute({
        userId: mockUserId,
        suggestionId: 1,
        action: "accept",
        categoryId: 5,
        timezone: "Asia/Seoul",
      }),
    ).rejects.toThrow("투두 생성 실패");

    expect(repo.updateStatus).toHaveBeenNthCalledWith(2, 1, "PENDING");
  });
});
