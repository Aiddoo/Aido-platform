/**
 * GeminiAiAdapter 프로바이더 단위 테스트
 *
 * @description
 * GeminiAiAdapter의 외부 연동 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test gemini.provider
 * ```
 */
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { z } from "zod";

import { BusinessException } from "@/shared/application/exceptions/business-exception.service";

import { GeminiAiAdapter } from "./gemini-ai.adapter";

// Vercel AI SDK mock
jest.mock("ai", () => {
	class _MockAPICallError extends Error {
		readonly statusCode: number;
		constructor(message: string, statusCode: number) {
			super(message);
			this.statusCode = statusCode;
		}
		static isInstance(error: unknown): error is _MockAPICallError {
			return error instanceof _MockAPICallError;
		}
	}
	return {
		generateObject: jest.fn(),
		APICallError: _MockAPICallError,
	};
});

jest.mock("@ai-sdk/google", () => ({
	createGoogleGenerativeAI: jest.fn(() => jest.fn(() => "mock-model")),
}));

const mockConfigService = {
	get: jest.fn(),
};

async function createProvider(): Promise<GeminiAiAdapter> {
	const module: TestingModule = await Test.createTestingModule({
		providers: [GeminiAiAdapter, { provide: ConfigService, useValue: mockConfigService }],
	}).compile();

	return module.get<GeminiAiAdapter>(GeminiAiAdapter);
}

describe("GeminiAiAdapter — Gemini AI 프로바이더", () => {
	describe("isAvailable", () => {
		it("API 키가 설정되어 있으면 true를 반환한다", async () => {
			// Given - API 키가 설정됨
			mockConfigService.get.mockReturnValue("test-api-key");

			// When - 새 인스턴스 생성 (생성자에서 API 키를 읽음)
			const provider = await createProvider();

			// Then - isAvailable이 true 반환
			expect(provider.isAvailable()).toBe(true);
		});

		it("API 키가 없으면 false를 반환한다", async () => {
			// Given - API 키가 설정되지 않음
			mockConfigService.get.mockReturnValue(undefined);

			// When - 새 인스턴스 생성
			const provider = await createProvider();

			// Then - isAvailable이 false 반환
			expect(provider.isAvailable()).toBe(false);
		});

		it("API 키가 빈 문자열이면 false를 반환한다", async () => {
			// Given - API 키가 빈 문자열
			mockConfigService.get.mockReturnValue("");

			// When - 새 인스턴스 생성
			const provider = await createProvider();

			// Then - isAvailable이 false 반환
			expect(provider.isAvailable()).toBe(false);
		});
	});

	describe("generateStructured", () => {
		const testSchema = z.object({
			title: z.string(),
			startDate: z.string(),
			isAllDay: z.boolean(),
		});

		it("API 키가 없으면 BusinessException을 던진다", async () => {
			// Given - API 키가 설정되지 않음
			mockConfigService.get.mockReturnValue(undefined);
			const provider = await createProvider();

			// When & Then - BusinessException이 발생함
			await expect(
				provider.generateStructured({
					prompt: "테스트 프롬프트",
					schema: testSchema,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("Vercel AI SDK generateObject를 호출한다", async () => {
			// Given - API 키가 설정되고 generateObject가 결과 반환
			const { generateObject } = require("ai");
			generateObject.mockResolvedValue({
				object: {
					title: "테스트 할 일",
					startDate: "2025-01-26",
					isAllDay: true,
				},
				usage: {
					inputTokens: 100,
					outputTokens: 50,
				},
			});

			mockConfigService.get.mockReturnValue("test-api-key");
			const provider = await createProvider();

			// When - generateStructured 호출
			const result = await provider.generateStructured({
				prompt: "내일 회의",
				schema: testSchema,
				maxOutputTokens: 200,
			});

			// Then - 올바른 인자로 generateObject가 호출됨
			expect(generateObject).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "내일 회의",
					maxOutputTokens: 200,
				}),
			);
			expect(generateObject.mock.calls[0]?.[0]).not.toHaveProperty("temperature");
			expect(result.output).toEqual({
				title: "테스트 할 일",
				startDate: "2025-01-26",
				isAllDay: true,
			});
			expect(result.model).toBe("google:gemini-3.1-flash-lite");
			expect(result.usage).toEqual({
				input: 100,
				output: 50,
			});
		});

		it("기본 maxOutputTokens만 적용하고 Gemini 3 권장 sampling 기본값을 유지한다", async () => {
			// Given - API 키가 설정됨
			const { generateObject } = require("ai");
			generateObject.mockResolvedValue({
				object: { title: "테스트", startDate: "2025-01-26", isAllDay: true },
				usage: { inputTokens: 100, outputTokens: 50 },
			});

			mockConfigService.get.mockReturnValue("test-api-key");
			const provider = await createProvider();

			// When - 기본 옵션으로 호출
			await provider.generateStructured({
				prompt: "테스트",
				schema: testSchema,
			});

			// Then - 기본값이 사용됨
			expect(generateObject).toHaveBeenCalledWith(
				expect.objectContaining({
					maxOutputTokens: 150,
				}),
			);
			expect(generateObject.mock.calls[0]?.[0]).not.toHaveProperty("temperature");
		});

		it("generateObject 에러를 전파한다", async () => {
			// Given - generateObject가 에러를 던짐
			const { generateObject } = require("ai");
			generateObject.mockRejectedValue(new Error("API error"));

			mockConfigService.get.mockReturnValue("test-api-key");
			const provider = await createProvider();

			// When & Then - 에러가 전파됨
			await expect(
				provider.generateStructured({
					prompt: "테스트",
					schema: testSchema,
				}),
			).rejects.toThrow("API error");
		});

		it("429 에러 시 aiRateLimitExceeded BusinessException을 던진다", async () => {
			// Given - generateObject가 429 에러를 던짐
			const { generateObject, APICallError } = require("ai");
			generateObject.mockRejectedValue(new APICallError("Rate limit exceeded", 429));

			mockConfigService.get.mockReturnValue("test-api-key");
			const provider = await createProvider();

			// When & Then - BusinessException이 발생함
			await expect(
				provider.generateStructured({
					prompt: "테스트",
					schema: testSchema,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("429가 아닌 APICallError는 그대로 전파한다", async () => {
			// Given - generateObject가 500 에러를 던짐
			const { generateObject, APICallError } = require("ai");
			generateObject.mockRejectedValue(new APICallError("Internal server error", 500));

			mockConfigService.get.mockReturnValue("test-api-key");
			const provider = await createProvider();

			// When & Then - 원래 에러가 전파됨
			await expect(
				provider.generateStructured({
					prompt: "테스트",
					schema: testSchema,
				}),
			).rejects.toThrow("Internal server error");
		});
	});
});
