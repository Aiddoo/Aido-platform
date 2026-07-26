import type { CurrentUserPayload } from "@aido/validators";
import {
	type CallHandler,
	type ExecutionContext,
	Inject,
	Injectable,
	Logger,
	type NestInterceptor,
	type OnModuleDestroy,
} from "@nestjs/common";
import type { Observable } from "rxjs";

import {
	AUTH_USER_ACTIVITY_WRITER,
	type AuthUserActivityWriterPort,
} from "@/auth/application/ports/auth-collaboration.port";
import { resolveTimezone } from "@/shared/domain/date/utils/timezone";

/**
 * 인증된 API 요청 시 User.lastActiveAt을 갱신하는 인터셉터
 *
 * - 1시간 이내 중복 갱신 방지 (in-memory throttle)
 * - fire-and-forget 패턴 (응답 지연 없음)
 * - THROTTLE_MS 주기로 만료 엔트리 자동 정리 (메모리 누수 방지)
 * - 단일 인스턴스(t4g.small) 환경에서 in-memory Map으로 충분
 */
@Injectable()
export class LastActiveInterceptor implements NestInterceptor, OnModuleDestroy {
	readonly #logger = new Logger(LastActiveInterceptor.name);

	/** userId → lastUpdatedAt (epoch ms) */
	readonly #throttleMap = new Map<string, number>();

	readonly #cleanupInterval: NodeJS.Timeout;

	static readonly THROTTLE_MS = 60 * 60 * 1000; // 1시간

	constructor(
		@Inject(AUTH_USER_ACTIVITY_WRITER)
		private readonly userActivityWriter: AuthUserActivityWriterPort,
	) {
		this.#cleanupInterval = setInterval(
			() => this.#cleanup(),
			LastActiveInterceptor.THROTTLE_MS,
		);
	}

	onModuleDestroy(): void {
		clearInterval(this.#cleanupInterval);
	}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request = context.switchToHttp().getRequest();
		const user = request.user as CurrentUserPayload | undefined;

		if (user?.userId) {
			this.#touchLastActive(
				user.userId,
				resolveTimezone(request.headers?.["x-timezone"]),
			);
		}

		return next.handle();
	}

	#touchLastActive(userId: string, timezone: string): void {
		const now = Date.now();
		const lastUpdated = this.#throttleMap.get(userId);

		if (lastUpdated && now - lastUpdated < LastActiveInterceptor.THROTTLE_MS) {
			return;
		}

		this.#throttleMap.set(userId, now);

		// fire-and-forget — 응답을 블로킹하지 않음
		this.userActivityWriter
			.updateLastActiveAt(userId, timezone)
			.catch((error) => {
				this.#logger.error(
					`Failed to update lastActiveAt: userId=${userId}, error=${error}`,
				);
			});
	}

	#cleanup(): void {
		const cutoff = Date.now() - LastActiveInterceptor.THROTTLE_MS;
		let cleaned = 0;

		for (const [userId, timestamp] of this.#throttleMap.entries()) {
			if (timestamp < cutoff) {
				this.#throttleMap.delete(userId);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			this.#logger.debug(
				`Throttle cleanup: removed ${cleaned} expired entries`,
			);
		}
	}
}
