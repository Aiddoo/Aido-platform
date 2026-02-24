import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { SentryGlobalFilter } from "@sentry/nestjs/setup";
import { GlobalExceptionFilter } from "./filters/global-exception.filter";

/**
 * Exception 모듈
 * 전역 예외 처리를 담당
 * SentryGlobalFilter → GlobalExceptionFilter 순서로 처리
 */
@Module({
	providers: [
		{
			provide: APP_FILTER,
			useClass: SentryGlobalFilter,
		},
		{
			provide: APP_FILTER,
			useClass: GlobalExceptionFilter,
		},
	],
})
export class ExceptionModule {}
