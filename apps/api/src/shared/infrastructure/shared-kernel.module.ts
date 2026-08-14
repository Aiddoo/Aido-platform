import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";

import { GlobalExceptionFilter } from "@/shared/infrastructure/filters/global-exception.filter";
import { ResponseTransformInterceptor } from "@/shared/presentation/interceptors/response-transform.interceptor";

/**
 * 공유 커널 모듈 (구 ExceptionModule + ResponseModule 통합)
 *
 * 전역 예외 필터와 전역 응답 변환 인터셉터를 등록한다.
 * 등록 순서는 기존과 동일: GlobalExceptionFilter → ResponseTransformInterceptor.
 * GlobalExceptionFilter는 Sentry 캡처를 직접 수행한다.
 */
@Module({
	providers: [
		{
			provide: APP_FILTER,
			useClass: GlobalExceptionFilter,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: ResponseTransformInterceptor,
		},
	],
})
export class SharedKernelModule {}
