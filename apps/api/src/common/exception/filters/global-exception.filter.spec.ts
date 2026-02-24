/**
 * GlobalExceptionFilter 테스트
 *
 * Prisma P2002 매핑, BusinessException, HttpException, 알 수 없는 에러 처리 검증
 */

import { ErrorCode } from "@aido/errors";
import { HttpException, HttpStatus } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { PinoLogger } from "nestjs-pino";
import type { TypedConfigService } from "@/common/config/services/config.service";
import { Prisma } from "@/generated/prisma/client";
import { BusinessExceptions } from "../services/business-exception.service";
import { GlobalExceptionFilter } from "./global-exception.filter";

jest.mock("@sentry/nestjs", () => ({
	captureException: jest.fn(),
}));

describe("GlobalExceptionFilter", () => {
	let filter: GlobalExceptionFilter;
	let mockLogger: jest.Mocked<PinoLogger>;
	let mockConfigService: TypedConfigService;
	let mockResponse: { status: jest.Mock; json: jest.Mock };
	let mockRequest: { method: string; url: string; user?: { userId: string } };
	let mockHost: { switchToHttp: jest.Mock };

	const createFilter = (isDevelopment = true) => {
		mockConfigService = {
			isDevelopment,
		} as unknown as TypedConfigService;
		return new GlobalExceptionFilter(mockLogger, mockConfigService);
	};

	beforeEach(() => {
		mockLogger = {
			setContext: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
		} as unknown as jest.Mocked<PinoLogger>;

		mockResponse = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		};

		mockRequest = {
			method: "POST",
			url: "/test",
		};

		mockHost = {
			switchToHttp: jest.fn().mockReturnValue({
				getResponse: () => mockResponse,
				getRequest: () => mockRequest,
			}),
		};

		filter = createFilter(true);
	});

	describe("P2002 Prisma 에러 처리", () => {
		it("알려진 constraint(email)를 BusinessException으로 매핑해야 한다", () => {
			// Given
			const error = new Prisma.PrismaClientKnownRequestError(
				"Unique constraint",
				{
					code: "P2002",
					meta: { target: ["email"] },
					clientVersion: "7.0.0",
				},
			);

			// When
			filter.catch(error, mockHost as never);

			// Then
			expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
			const jsonArg = mockResponse.json.mock.calls[0][0];
			expect(jsonArg.error.code).toBe(ErrorCode.EMAIL_0501);
		});

		it("알려진 constraint(userId_name)를 BusinessException으로 매핑해야 한다", () => {
			// Given
			const error = new Prisma.PrismaClientKnownRequestError(
				"Unique constraint",
				{
					code: "P2002",
					meta: { target: ["userId", "name"] },
					clientVersion: "7.0.0",
				},
			);

			// When
			filter.catch(error, mockHost as never);

			// Then
			expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
			const jsonArg = mockResponse.json.mock.calls[0][0];
			expect(jsonArg.error.code).toBe(ErrorCode.TODO_CATEGORY_0853);
		});

		it("알려진 constraint(followerId_followingId)를 BusinessException으로 매핑해야 한다", () => {
			// Given
			const error = new Prisma.PrismaClientKnownRequestError(
				"Unique constraint",
				{
					code: "P2002",
					meta: { target: ["followerId", "followingId"] },
					clientVersion: "7.0.0",
				},
			);

			// When
			filter.catch(error, mockHost as never);

			// Then
			expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
			const jsonArg = mockResponse.json.mock.calls[0][0];
			expect(jsonArg.error.code).toBe(ErrorCode.FOLLOW_0901);
		});

		it("알 수 없는 constraint를 SYS_0004 (409)로 폴백해야 한다", () => {
			// Given
			const error = new Prisma.PrismaClientKnownRequestError(
				"Unique constraint",
				{
					code: "P2002",
					meta: { target: ["unknownField"] },
					clientVersion: "7.0.0",
				},
			);

			// When
			filter.catch(error, mockHost as never);

			// Then
			expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
			const jsonArg = mockResponse.json.mock.calls[0][0];
			expect(jsonArg.error.code).toBe(ErrorCode.SYS_0004);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Unknown P2002 constraint"),
			);
		});

		it("P2003 FK constraint violation은 400 SYS_0002로 처리해야 한다", () => {
			// Given
			const error = new Prisma.PrismaClientKnownRequestError(
				"Foreign key constraint",
				{
					code: "P2003",
					meta: {},
					clientVersion: "7.0.0",
				},
			);

			// When
			filter.catch(error, mockHost as never);

			// Then
			expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
			const jsonArg = mockResponse.json.mock.calls[0][0];
			expect(jsonArg.error.code).toBe(ErrorCode.SYS_0002);
		});

		it("처리되지 않은 Prisma 에러는 500 SYS_0001로 처리해야 한다", () => {
			// Given
			const error = new Prisma.PrismaClientKnownRequestError(
				"Unknown Prisma error",
				{
					code: "P2024",
					meta: {},
					clientVersion: "7.0.0",
				},
			);

			// When
			filter.catch(error, mockHost as never);

			// Then
			expect(mockResponse.status).toHaveBeenCalledWith(
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
			const jsonArg = mockResponse.json.mock.calls[0][0];
			expect(jsonArg.error.code).toBe(ErrorCode.SYS_0001);
		});
	});

	describe("기존 동작 유지", () => {
		it("BusinessException을 올바르게 처리해야 한다", () => {
			// Given
			const exception = BusinessExceptions.todoCategoryNotFound(1);

			// When
			filter.catch(exception, mockHost as never);

			// Then
			expect(mockResponse.status).toHaveBeenCalledWith(exception.getStatus());
			const jsonArg = mockResponse.json.mock.calls[0][0];
			expect(jsonArg.error.code).toBe(ErrorCode.TODO_CATEGORY_0851);
		});

		it("HttpException을 올바르게 처리해야 한다", () => {
			// Given
			const exception = new HttpException(
				{ message: "Bad Request" },
				HttpStatus.BAD_REQUEST,
			);

			// When
			filter.catch(exception, mockHost as never);

			// Then
			expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
			const jsonArg = mockResponse.json.mock.calls[0][0];
			expect(jsonArg.error.code).toBe(ErrorCode.SYS_0002);
		});

		it("알 수 없는 에러를 500 SYS_0001로 처리해야 한다", () => {
			// Given
			const exception = new Error("unexpected error");

			// When
			filter.catch(exception, mockHost as never);

			// Then
			expect(mockResponse.status).toHaveBeenCalledWith(
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
			const jsonArg = mockResponse.json.mock.calls[0][0];
			expect(jsonArg.error.code).toBe(ErrorCode.SYS_0001);
		});
	});

	describe("Sentry 캡처", () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		it("5xx 서버 에러는 Sentry에 캡처해야 한다", () => {
			// Given
			const exception = new Error("unexpected server error");

			// When
			filter.catch(exception, mockHost as never);

			// Then
			expect(Sentry.captureException).toHaveBeenCalledWith(exception);
		});

		it("4xx 클라이언트 에러는 Sentry에 캡처하지 않아야 한다", () => {
			// Given
			const exception = new HttpException(
				{ message: "Bad Request" },
				HttpStatus.BAD_REQUEST,
			);

			// When
			filter.catch(exception, mockHost as never);

			// Then
			expect(Sentry.captureException).not.toHaveBeenCalled();
		});

		it("BusinessException(4xx)은 Sentry에 캡처하지 않아야 한다", () => {
			// Given
			const exception = BusinessExceptions.todoCategoryNotFound(1);

			// When
			filter.catch(exception, mockHost as never);

			// Then
			expect(Sentry.captureException).not.toHaveBeenCalled();
		});
	});

	describe("details 노출 제어", () => {
		it("development 환경에서 HttpException의 details가 포함된다", () => {
			// Given
			filter = createFilter(true);
			const exception = new HttpException(
				{ message: "Bad Request", extra: "info" },
				HttpStatus.BAD_REQUEST,
			);

			// When
			filter.catch(exception, mockHost as never);

			// Then
			const jsonArg = mockResponse.json.mock.calls[0][0];
			expect(jsonArg.error.details).toBeDefined();
		});

		it("production 환경에서 HttpException의 details가 포함되지 않는다", () => {
			// Given
			filter = createFilter(false);
			const exception = new HttpException(
				{ message: "Bad Request", extra: "info" },
				HttpStatus.BAD_REQUEST,
			);

			// When
			filter.catch(exception, mockHost as never);

			// Then
			const jsonArg = mockResponse.json.mock.calls[0][0];
			expect(jsonArg.error.details).toBeUndefined();
		});

		it("development 환경에서 알 수 없는 에러의 details가 포함된다", () => {
			// Given
			filter = createFilter(true);
			const exception = new Error("unexpected error");

			// When
			filter.catch(exception, mockHost as never);

			// Then
			const jsonArg = mockResponse.json.mock.calls[0][0];
			expect(jsonArg.error.details).toBe("unexpected error");
		});

		it("production 환경에서 알 수 없는 에러의 details가 포함되지 않는다", () => {
			// Given
			filter = createFilter(false);
			const exception = new Error("unexpected error");

			// When
			filter.catch(exception, mockHost as never);

			// Then
			const jsonArg = mockResponse.json.mock.calls[0][0];
			expect(jsonArg.error.details).toBeUndefined();
		});
	});
});
