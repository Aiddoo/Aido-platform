import type { CurrentUserPayload } from "@aido/validators";
import {
	type CallHandler,
	type ExecutionContext,
	Injectable,
	Logger,
	type NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";

import { UserRepository } from "../repositories/user.repository";

/**
 * 인증된 API 요청 시 User.lastActiveAt을 갱신하는 인터셉터
 *
 * - 1시간 이내 중복 갱신 방지 (in-memory throttle)
 * - fire-and-forget 패턴 (응답 지연 없음)
 * - 단일 인스턴스(t4g.small) 환경에서 in-memory Map으로 충분
 */
@Injectable()
export class LastActiveInterceptor implements NestInterceptor {
	readonly #logger = new Logger(LastActiveInterceptor.name);

	/** userId → lastUpdatedAt (epoch ms) */
	readonly #throttleMap = new Map<string, number>();

	static readonly THROTTLE_MS = 60 * 60 * 1000; // 1시간

	constructor(private readonly userRepository: UserRepository) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request = context.switchToHttp().getRequest();
		const user = request.user as CurrentUserPayload | undefined;

		if (user?.userId) {
			this.#touchLastActive(user.userId);
		}

		return next.handle();
	}

	#touchLastActive(userId: string): void {
		const now = Date.now();
		const lastUpdated = this.#throttleMap.get(userId);

		if (lastUpdated && now - lastUpdated < LastActiveInterceptor.THROTTLE_MS) {
			return;
		}

		this.#throttleMap.set(userId, now);

		// fire-and-forget — 응답을 블로킹하지 않음
		this.userRepository.updateLastActiveAt(userId).catch((error) => {
			this.#logger.error(
				`Failed to update lastActiveAt: userId=${userId}, error=${error}`,
			);
		});
	}
}
