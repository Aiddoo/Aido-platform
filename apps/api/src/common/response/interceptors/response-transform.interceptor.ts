import {
	type CallHandler,
	type ExecutionContext,
	Injectable,
	type NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { SuccessResponse } from "../interfaces/response.interface";

/**
 * 응답 변환 인터셉터
 * 모든 성공 응답을 일관된 형식으로 래핑
 */
@Injectable()
export class ResponseTransformInterceptor<T>
	implements NestInterceptor<T, SuccessResponse<T>>
{
	intercept(
		_context: ExecutionContext,
		next: CallHandler,
	): Observable<SuccessResponse<T>> {
		return next.handle().pipe(
			map((data) => ({
				success: true as const,
				data,
				timestamp: Date.now(),
			})),
		);
	}
}
