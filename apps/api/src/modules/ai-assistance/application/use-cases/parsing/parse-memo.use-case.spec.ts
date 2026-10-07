import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { type AiProvider, AiProviderCallError } from "../../ports/parsing/ai-provider.port.js";
import { type UserCategoryReaderPort } from "../../ports/parsing/user-category-reader.port.js";
import { AiUsageMeter } from "../../services/parsing/ai-usage-meter.service.js";
import { type ParseMemoInput, ParseMemo } from "./parse-memo.use-case.js";

const todo = (title: string, categoryId: number) => ({
  title,
  startDate: "2026-04-12",
  endDate: null,
  scheduledTime: null,
  isAllDay: true,
  isRecurring: false,
  recurrence: null,
  categoryId,
  items: [],
});

describe("ParseMemo — 메모 다중 투두 파싱 use-case", () => {
  let useCase: ParseMemo;
  let aiProvider: Mocked<AiProvider>;
  let categoryReader: Mocked<UserCategoryReaderPort>;
  let usageMeter: Mocked<AiUsageMeter>;

  const input = (): ParseMemoInput => ({
    content: "메모 내용",
    userId: "user-1",
    timezone: "Asia/Seoul",
    categoryId: 1,
    locale: "ko",
  });

  beforeEach(async () => {
    const parseMemoDependencies = mockDeep<ConstructorParameters<typeof ParseMemo>[0]>({});
    const unit = new ParseMemo(parseMemoDependencies);
    useCase = unit;
    aiProvider = parseMemoDependencies.aiProvider;
    categoryReader = parseMemoDependencies.categoryReader;
    usageMeter = parseMemoDependencies.usageMeter;

    aiProvider.isAvailable.mockReturnValue(true);
    categoryReader.findByUserId.mockResolvedValue([{ id: 7, name: "업무" }]);
  });

  it("가용하지 않으면 AI_1301을 던지고 사용량을 차감하지 않는다", async () => {
    aiProvider.isAvailable.mockReturnValue(false);

    await expect(useCase.execute(input())).rejects.toMatchObject({
      errorCode: "AI_1301",
    });
    expect(usageMeter.checkAndIncrement).not.toHaveBeenCalled();
  });

  it("최대 5개까지만 반환하고 사용량을 차감한다", async () => {
    aiProvider.generateStructured.mockResolvedValue({
      output: { todos: Array.from({ length: 8 }, () => todo("작업", 7)) },
      model: "m",
      usage: { input: 1, output: 1 },
    });

    const result = await useCase.execute(input());

    expect(usageMeter.checkAndIncrement).toHaveBeenCalledWith("user-1");
    expect(result.data.todos).toHaveLength(5);
  });

  it("미지 카테고리는 요청 기본 categoryId(1)로 대체한다", async () => {
    aiProvider.generateStructured.mockResolvedValue({
      output: { todos: [todo("소유 카테고리", 7), todo("미지 카테고리", 999)] },
      model: "m",
      usage: { input: 1, output: 1 },
    });

    const result = await useCase.execute(input());

    expect(result.data.todos[0]?.categoryId).toBe(7);
    expect(result.data.todos[1]?.categoryId).toBe(1);
  });

  it("AI provider 호출 실패 시 롤백하고 AI_1301을 던진다", async () => {
    aiProvider.generateStructured.mockRejectedValue(new AiProviderCallError("boom", 500));

    await expect(useCase.execute(input())).rejects.toMatchObject({
      errorCode: "AI_1301",
    });
    expect(usageMeter.decrement).toHaveBeenCalledWith("user-1");
  });

  it("그 외 오류 시 롤백하고 AI_1302를 던진다", async () => {
    aiProvider.generateStructured.mockRejectedValue(new Error("parse fail"));

    await expect(useCase.execute(input())).rejects.toMatchObject({
      errorCode: "AI_1302",
    });
    expect(usageMeter.decrement).toHaveBeenCalledWith("user-1");
  });
});
