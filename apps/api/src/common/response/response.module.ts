import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ResponseTransformInterceptor } from "./interceptors/response-transform.interceptor";

/**
 * Response 모듈
 * 전역 응답 변환을 담당
 */
@Module({
	providers: [
		{
			provide: APP_INTERCEPTOR,
			useClass: ResponseTransformInterceptor,
		},
	],
})
export class ResponseModule {}
