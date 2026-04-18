/**
 * AiRouterProvider 단위 테스트
 *
 * modelHint 기반 라우팅과 Anthropic fallback 로직을 검증합니다.
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { z } from "zod";

import {
	AI_PROVIDER_ANTHROPIC,
	AI_PROVIDER_GEMINI,
	AiRouterProvider,
} from "./ai-router.provider";
import type { AnthropicProvider } from "./anthropic.provider";
import type { GeminiProvider } from "./gemini.provider";

describe("AiRouterProvider — AI 라우터", () => {
	let router: AiRouterProvider;
	let mockGemini: Mocked<GeminiProvider>;
	let mockAnthropic: Mocked<AnthropicProvider>;

	const schema = z.object({ value: z.string() });

	const sampleResult = {
		output: { value: "ok" },
		model: "stub",
		usage: { input: 0, output: 0 },
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AiRouterProvider)
			.mock(AI_PROVIDER_GEMINI)
			.impl(() => ({
				generateStructured: jest.fn().mockResolvedValue({
					...sampleResult,
					model: "google:gemini-2.5-flash-lite",
				}),
				isAvailable: jest.fn().mockReturnValue(true),
			}))
			.mock(AI_PROVIDER_ANTHROPIC)
			.impl(() => ({
				generateStructured: jest.fn().mockResolvedValue({
					...sampleResult,
					model: "anthropic:claude-sonnet-4-6",
				}),
				isAvailable: jest.fn().mockReturnValue(true),
			}))
			.compile();

		router = unit;
		mockGemini = unitRef.get(AI_PROVIDER_GEMINI);
		mockAnthropic = unitRef.get(AI_PROVIDER_ANTHROPIC);
	});

	it("modelHint 미지정 시 Gemini로 라우팅한다", async () => {
		const result = await router.generateStructured({
			prompt: "hi",
			schema,
		});
		expect(mockGemini.generateStructured).toHaveBeenCalledTimes(1);
		expect(mockAnthropic.generateStructured).not.toHaveBeenCalled();
		expect(result.model).toContain("google:gemini");
	});

	it("modelHint=default 는 Gemini로 라우팅한다", async () => {
		await router.generateStructured({
			prompt: "hi",
			schema,
			modelHint: "default",
		});
		expect(mockGemini.generateStructured).toHaveBeenCalledTimes(1);
		expect(mockAnthropic.generateStructured).not.toHaveBeenCalled();
	});

	it("modelHint=report & Anthropic 가용 시 Anthropic으로 라우팅한다", async () => {
		const result = await router.generateStructured({
			prompt: "report",
			schema,
			modelHint: "report",
		});
		expect(mockAnthropic.generateStructured).toHaveBeenCalledTimes(1);
		expect(mockGemini.generateStructured).not.toHaveBeenCalled();
		expect(result.model).toContain("anthropic:");
	});

	it("modelHint=report 이지만 Anthropic 비가용 시 Gemini로 fallback 한다", async () => {
		mockAnthropic.isAvailable.mockReturnValue(false);
		const result = await router.generateStructured({
			prompt: "report",
			schema,
			modelHint: "report",
		});
		expect(mockGemini.generateStructured).toHaveBeenCalledTimes(1);
		expect(mockAnthropic.generateStructured).not.toHaveBeenCalled();
		expect(result.model).toContain("google:gemini");
	});

	it("isAvailable 은 어느 하나라도 가용이면 true 를 반환한다", () => {
		expect(router.isAvailable()).toBe(true);

		mockAnthropic.isAvailable.mockReturnValue(false);
		expect(router.isAvailable()).toBe(true); // Gemini 가용

		mockGemini.isAvailable.mockReturnValue(false);
		expect(router.isAvailable()).toBe(false); // 둘 다 비가용
	});
});
