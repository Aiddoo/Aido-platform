/**
 * ParseMemoUseCase 단위 테스트
 *
 * AI_PROVIDER·카테고리 리더·사용량 미터를 스텁으로 대체해 메모 파싱 오케스트레이션
 * (5개 상한·미지 카테고리 대체·에러 규약)만 검증한다.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import {
	AI_PROVIDER,
	type AiProvider,
	AiProviderCallError,
} from "../../ports/ai-provider.port";
import {
	USER_CATEGORY_READER,
	type UserCategoryReaderPort,
} from "../../ports/user-category-reader.port";
import { AiUsageMeter } from "../../services/ai-usage-meter.service";
import { type ParseMemoInput, ParseMemoUseCase } from "./parse-memo.use-case";

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

describe("ParseMemoUseCase — 메모 다중 투두 파싱 use-case", () => {
	let useCase: ParseMemoUseCase;
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
		const { unit, unitRef } =
			await TestBed.solitary(ParseMemoUseCase).compile();
		useCase = unit;
		aiProvider = unitRef.get(AI_PROVIDER);
		categoryReader = unitRef.get(USER_CATEGORY_READER);
		usageMeter = unitRef.get(AiUsageMeter);

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
		aiProvider.generateStructured.mockRejectedValue(
			new AiProviderCallError("boom", 500),
		);

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
