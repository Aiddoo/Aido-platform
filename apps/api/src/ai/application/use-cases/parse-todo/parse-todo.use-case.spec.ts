/**
 * ParseTodoUseCase 단위 테스트
 *
 * AI_PROVIDER·카테고리 리더·사용량 미터를 스텁으로 대체해 파싱 오케스트레이션만
 * 검증한다 (실제 벤더 호출 없음, SOLID/DIP).
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { AI_PROVIDER, type AiProvider, AiProviderCallError } from "../../ports/ai-provider.port";
import {
	USER_CATEGORY_READER,
	type UserCategoryReaderPort,
} from "../../ports/user-category-reader.port";
import { AiUsageMeter } from "../../services/ai-usage-meter.service";
import { type ParseTodoInput, ParseTodoUseCase } from "./parse-todo.use-case";

const OUTPUT = {
	title: "팀 미팅",
	startDate: "2026-04-12",
	endDate: null,
	scheduledTime: "15:00",
	isAllDay: false,
	isRecurring: false,
	recurrence: null,
	categoryId: 7,
};

describe("ParseTodoUseCase — 자연어 투두 파싱 use-case", () => {
	let useCase: ParseTodoUseCase;
	let aiProvider: Mocked<AiProvider>;
	let categoryReader: Mocked<UserCategoryReaderPort>;
	let usageMeter: Mocked<AiUsageMeter>;

	const input = (categoryId?: number): ParseTodoInput => ({
		text: "내일 3시 팀 미팅",
		userId: "user-1",
		timezone: "Asia/Seoul",
		categoryId,
		locale: "ko",
	});

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(ParseTodoUseCase).compile();
		useCase = unit;
		aiProvider = unitRef.get(AI_PROVIDER);
		categoryReader = unitRef.get(USER_CATEGORY_READER);
		usageMeter = unitRef.get(AiUsageMeter);

		aiProvider.isAvailable.mockReturnValue(true);
		categoryReader.findByUserId.mockResolvedValue([{ id: 7, name: "업무" }]);
		aiProvider.generateStructured.mockResolvedValue({
			output: OUTPUT,
			model: "google:gemini-3.1-flash-lite",
			usage: { input: 180, output: 45 },
		});
	});

	it("가용하지 않으면 AI_1301을 던지고 사용량을 차감하지 않는다", async () => {
		aiProvider.isAvailable.mockReturnValue(false);

		await expect(useCase.execute(input())).rejects.toMatchObject({
			errorCode: "AI_1301",
		});
		expect(usageMeter.checkAndIncrement).not.toHaveBeenCalled();
	});

	it("성공 시 데이터/메타를 반환하고 사용량을 차감한다", async () => {
		const result = await useCase.execute(input());

		expect(usageMeter.checkAndIncrement).toHaveBeenCalledWith("user-1");
		expect(result.data.title).toBe("팀 미팅");
		expect(result.meta.model).toBe("google:gemini-3.1-flash-lite");
		expect(result.meta.tokenUsage).toEqual({ input: 180, output: 45 });
	});

	it("추론된 카테고리가 사용자 소유면 유지한다", async () => {
		const result = await useCase.execute(input());
		expect(result.data.categoryId).toBe(7);
	});

	it("추론된 카테고리가 사용자 소유가 아니면 undefined로 만든다", async () => {
		aiProvider.generateStructured.mockResolvedValue({
			output: { ...OUTPUT, categoryId: 999 },
			model: "m",
			usage: { input: 1, output: 1 },
		});

		const result = await useCase.execute(input());
		expect(result.data.categoryId).toBeUndefined();
	});

	it("명시적 categoryId가 추론값을 덮어쓴다", async () => {
		const result = await useCase.execute(input(3));
		expect(result.data.categoryId).toBe(3);
	});

	it("AI provider 호출 실패 시 사용량을 롤백하고 AI_1301을 던진다", async () => {
		aiProvider.generateStructured.mockRejectedValue(new AiProviderCallError("boom", 500));

		await expect(useCase.execute(input())).rejects.toMatchObject({
			errorCode: "AI_1301",
		});
		expect(usageMeter.decrement).toHaveBeenCalledWith("user-1");
	});

	it("그 외 오류 시 사용량을 롤백하고 AI_1302를 던진다", async () => {
		aiProvider.generateStructured.mockRejectedValue(new Error("parse fail"));

		await expect(useCase.execute(input())).rejects.toMatchObject({
			errorCode: "AI_1302",
		});
		expect(usageMeter.decrement).toHaveBeenCalledWith("user-1");
	});
});
