import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";

import { GlobalExceptionFilter } from "#api/platform/filters/global-exception.filter";
import { ResponseTransformInterceptor } from "#api/platform/http/interceptors/response-transform.interceptor";

/** 전역 예외 필터와 성공 envelope 인터셉터를 등록한다. 5xx 보고는 필터가 ExceptionReporterPort로 보낸다. */
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
