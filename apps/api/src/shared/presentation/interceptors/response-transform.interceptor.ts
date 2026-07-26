import {
	type CallHandler,
	type ExecutionContext,
	Injectable,
	type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { RAW_RESPONSE_KEY } from "../decorators";
import type { SuccessResponse } from "./response.interface";

/**
 * 응답 변환 인터셉터
 * 모든 성공 응답을 일관된 형식으로 래핑
 */
@Injectable()
export class ResponseTransformInterceptor<T>
	implements NestInterceptor<T, T | SuccessResponse<T>>
{
	constructor(private readonly reflector: Reflector) {}

	intercept(
		context: ExecutionContext,
		next: CallHandler,
	): Observable<T | SuccessResponse<T>> {
		const shouldReturnRaw = this.reflector.getAllAndOverride<boolean>(
			RAW_RESPONSE_KEY,
			[context.getHandler(), context.getClass()],
		);
		if (shouldReturnRaw) {
			return next.handle();
		}

		return next.handle().pipe(
			map((data) => ({
				success: true as const,
				data,
				timestamp: Date.now(),
			})),
		);
	}
}
