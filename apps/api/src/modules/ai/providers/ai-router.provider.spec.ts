/**
 * AiRouterProvider 단위 테스트
 *
 * 현재는 Gemini 단일 Provider pass-through 이므로, Gemini 로의 위임과
 * `isAvailable` 위임만 검증합니다. 향후 라우팅 분기가 추가되면 케이스를 확장합니다.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { z } from "zod";
import type { GenerateStructuredResult } from "./ai.provider";
import { AI_PROVIDER_GEMINI, AiRouterProvider } from "./ai-router.provider";

describe("AiRouterProvider — 라우팅 Provider", () => {
	let router: AiRouterProvider;
	let mockGemini: Mocked<{
		generateStructured: jest.Mock;
		isAvailable: jest.Mock;
	}>;

	const schema = z.object({ title: z.string() });
	const sampleResult: GenerateStructuredResult<{ title: string }> = {
		output: { title: "테스트" },
		model: "google:gemini-2.5-flash-lite",
		usage: { input: 100, output: 50 },
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AiRouterProvider)
			.mock(AI_PROVIDER_GEMINI)
			.impl(() => ({
				generateStructured: jest.fn().mockResolvedValue(sampleResult),
				isAvailable: jest.fn().mockReturnValue(true),
			}))
			.compile();

		router = unit;
		mockGemini = unitRef.get(AI_PROVIDER_GEMINI) as Mocked<{
			generateStructured: jest.Mock;
			isAvailable: jest.Mock;
		}>;
	});

	describe("generateStructured", () => {
		it("modelHint 없이 호출 시 Gemini 로 위임한다", async () => {
			// When
			const result = await router.generateStructured({
				prompt: "테스트",
				schema,
			});

			// Then
			expect(mockGemini.generateStructured).toHaveBeenCalledTimes(1);
			expect(result.model).toBe("google:gemini-2.5-flash-lite");
		});

		it("modelHint='default' 로 호출해도 Gemini 로 위임한다", async () => {
			// When
			await router.generateStructured({
				prompt: "테스트",
				schema,
				modelHint: "default",
			});

			// Then
			expect(mockGemini.generateStructured).toHaveBeenCalledTimes(1);
		});

		it("Gemini 가 던진 에러는 그대로 전파한다", async () => {
			// Given
			mockGemini.generateStructured.mockRejectedValueOnce(
				new Error("API 실패"),
			);

			// When & Then
			await expect(
				router.generateStructured({ prompt: "x", schema }),
			).rejects.toThrow("API 실패");
		});
	});

	describe("isAvailable", () => {
		it("Gemini 가 가용하면 true", () => {
			mockGemini.isAvailable.mockReturnValue(true);
			expect(router.isAvailable()).toBe(true);
		});

		it("Gemini 가 비가용이면 false", () => {
			mockGemini.isAvailable.mockReturnValue(false);
			expect(router.isAvailable()).toBe(false);
		});
	});
});
