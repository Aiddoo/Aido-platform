import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { z } from "zod";
import { GeminiProvider } from "./gemini.provider";

// Vercel AI SDK mock
jest.mock("ai", () => ({
	generateObject: jest.fn(),
}));

jest.mock("@ai-sdk/google", () => ({
	createGoogleGenerativeAI: jest.fn(() => jest.fn(() => "mock-model")),
}));

describe("GeminiProvider", () => {
	let _provider: GeminiProvider;
	let _configService: ConfigService;

	const mockConfigService = {
		get: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GeminiProvider,
				{ provide: ConfigService, useValue: mockConfigService },
			],
		}).compile();

		_provider = module.get<GeminiProvider>(GeminiProvider);
		_configService = module.get<ConfigService>(ConfigService);
	});

	describe("isAvailable", () => {
		it("API 키가 설정되어 있으면 true를 반환한다", () => {
			// Given
			mockConfigService.get.mockReturnValue("test-api-key");

			// 새 인스턴스 생성 (생성자에서 API 키를 읽음)
			const module = Test.createTestingModule({
				providers: [
					GeminiProvider,
					{ provide: ConfigService, useValue: mockConfigService },
				],
			}).compile();

			return module.then((m) => {
				const newProvider = m.get<GeminiProvider>(GeminiProvider);
				expect(newProvider.isAvailable()).toBe(true);
			});
		});

		it("API 키가 없으면 false를 반환한다", () => {
			// Given
			mockConfigService.get.mockReturnValue(undefined);

			// 새 인스턴스 생성
			const module = Test.createTestingModule({
				providers: [
					GeminiProvider,
					{ provide: ConfigService, useValue: mockConfigService },
				],
			}).compile();

			return module.then((m) => {
				const newProvider = m.get<GeminiProvider>(GeminiProvider);
				expect(newProvider.isAvailable()).toBe(false);
			});
		});

		it("API 키가 빈 문자열이면 false를 반환한다", () => {
			// Given
			mockConfigService.get.mockReturnValue("");

			// 새 인스턴스 생성
			const module = Test.createTestingModule({
				providers: [
					GeminiProvider,
					{ provide: ConfigService, useValue: mockConfigService },
				],
			}).compile();

			return module.then((m) => {
				const newProvider = m.get<GeminiProvider>(GeminiProvider);
				expect(newProvider.isAvailable()).toBe(false);
			});
		});
	});

	describe("generateStructured", () => {
		const testSchema = z.object({
			title: z.string(),
			startDate: z.string(),
			isAllDay: z.boolean(),
		});

		beforeEach(() => {
			mockConfigService.get.mockReturnValue("test-api-key");
		});

		it("API 키가 없으면 에러를 던진다", async () => {
			// Given
			mockConfigService.get.mockReturnValue(undefined);

			const module = await Test.createTestingModule({
				providers: [
					GeminiProvider,
					{ provide: ConfigService, useValue: mockConfigService },
				],
			}).compile();

			const newProvider = module.get<GeminiProvider>(GeminiProvider);

			// When & Then
			await expect(
				newProvider.generateStructured({
					prompt: "테스트 프롬프트",
					schema: testSchema,
				}),
			).rejects.toThrow("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
		});

		it("Vercel AI SDK generateObject를 호출한다", async () => {
			// Given
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

			const module = await Test.createTestingModule({
				providers: [
					GeminiProvider,
					{ provide: ConfigService, useValue: mockConfigService },
				],
			}).compile();

			const newProvider = module.get<GeminiProvider>(GeminiProvider);

			// When
			const result = await newProvider.generateStructured({
				prompt: "내일 회의",
				schema: testSchema,
				maxTokens: 200,
				temperature: 0.5,
			});

			// Then
			expect(generateObject).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "내일 회의",
					maxTokens: 200,
					temperature: 0.5,
				}),
			);
			expect(result.output).toEqual({
				title: "테스트 할 일",
				startDate: "2025-01-26",
				isAllDay: true,
			});
			expect(result.model).toBe("google:gemini-2.0-flash");
			expect(result.usage).toEqual({
				input: 100,
				output: 50,
			});
		});

		it("기본값으로 maxTokens=150, temperature=0.1을 사용한다", async () => {
			// Given
			const { generateObject } = require("ai");
			generateObject.mockResolvedValue({
				object: { title: "테스트", startDate: "2025-01-26", isAllDay: true },
				usage: { inputTokens: 100, outputTokens: 50 },
			});

			mockConfigService.get.mockReturnValue("test-api-key");

			const module = await Test.createTestingModule({
				providers: [
					GeminiProvider,
					{ provide: ConfigService, useValue: mockConfigService },
				],
			}).compile();

			const newProvider = module.get<GeminiProvider>(GeminiProvider);

			// When
			await newProvider.generateStructured({
				prompt: "테스트",
				schema: testSchema,
			});

			// Then
			expect(generateObject).toHaveBeenCalledWith(
				expect.objectContaining({
					maxTokens: 150,
					temperature: 0.1,
				}),
			);
		});

		it("generateObject 에러를 전파한다", async () => {
			// Given
			const { generateObject } = require("ai");
			generateObject.mockRejectedValue(new Error("API error"));

			mockConfigService.get.mockReturnValue("test-api-key");

			const module = await Test.createTestingModule({
				providers: [
					GeminiProvider,
					{ provide: ConfigService, useValue: mockConfigService },
				],
			}).compile();

			const newProvider = module.get<GeminiProvider>(GeminiProvider);

			// When & Then
			await expect(
				newProvider.generateStructured({
					prompt: "테스트",
					schema: testSchema,
				}),
			).rejects.toThrow("API error");
		});
	});
});
