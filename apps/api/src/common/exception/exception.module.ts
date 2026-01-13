import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { GlobalExceptionFilter } from "./filters/global-exception.filter";

/**
 * Exception 모듈
 * 전역 예외 처리를 담당
 */
@Module({
	providers: [
		{
			provide: APP_FILTER,
			useClass: GlobalExceptionFilter,
		},
	],
})
export class ExceptionModule {}
