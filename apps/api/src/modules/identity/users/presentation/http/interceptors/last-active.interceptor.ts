import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  type NestInterceptor,
  type OnModuleDestroy,
} from "@nestjs/common";
import type { Request } from "express";
import type { Observable } from "rxjs";

import { AuthLogEvent } from "#api/modules/identity/auth/application/auth.log-events";
import { AuthUserActivityWriterPort } from "#api/modules/identity/auth/application/ports/auth-collaboration.port";
import { RequestClientReader, requestTimezoneOrUtc } from "#api/platform/http/request-client/index";
import { readRequestUserId } from "#api/platform/http/request-user-id";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { startOfDayInTimezone } from "#api/shared/domain/date/utils/timezone";

/**
 * 인증된 API 요청 시 User.lastActiveAt과 요청한 앱 버전(X-App-Version)을 갱신하는 인터셉터
 *
 * - 1시간 이내 중복 갱신 방지 (in-memory throttle). 앱 버전이 바뀌면 throttle과 무관하게 바로 남긴다
 * - 앱 버전은 같은 UPDATE로 남겨 요청마다 쓰기가 늘지 않는다
 * - fire-and-forget 패턴 (응답 지연 없음)
 * - THROTTLE_MS 주기로 만료 엔트리 자동 정리 (메모리 누수 방지)
 * - 단일 인스턴스(t4g.small) 환경에서 in-memory Map으로 충분
 */
@Injectable()
export class LastActiveInterceptor implements NestInterceptor, OnModuleDestroy {
  readonly #logger = new Logger(LastActiveInterceptor.name);

  /** `${userId}:${localDate}:${appVersion}` → lastUpdatedAt (epoch ms) */
  readonly #throttleMap = new Map<string, number>();

  readonly #cleanupInterval: NodeJS.Timeout;

  static readonly THROTTLE_MS = 60 * 60 * 1000; // 1시간

  readonly #userActivityWriter: AuthUserActivityWriterPort;
  readonly #requestClientReader: RequestClientReader;

  constructor(
    @Inject(AuthUserActivityWriterPort)
    userActivityWriter: AuthUserActivityWriterPort,
    requestClientReader: RequestClientReader,
  ) {
    this.#userActivityWriter = userActivityWriter;
    this.#requestClientReader = requestClientReader;
    this.#cleanupInterval = setInterval(() => this.#cleanup(), LastActiveInterceptor.THROTTLE_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.#cleanupInterval);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = readRequestUserId(request);

    if (userId) {
      const client = this.#requestClientReader.current();
      this.#touchLastActive(userId, requestTimezoneOrUtc(client), client.appVersion ?? undefined);
    }

    return next.handle();
  }

  #touchLastActive(userId: string, timezone: string, appVersion: string | undefined): void {
    const touchedAt = Date.now();
    const localDate = startOfDayInTimezone(new Date(touchedAt), timezone)
      .toISOString()
      .slice(0, 10);
    const throttleKey = `${userId}:${localDate}:${appVersion ?? ""}`;
    const lastUpdated = this.#throttleMap.get(throttleKey);

    if (lastUpdated && touchedAt - lastUpdated < LastActiveInterceptor.THROTTLE_MS) {
      return;
    }

    this.#throttleMap.set(throttleKey, touchedAt);

    // fire-and-forget — 응답을 블로킹하지 않음
    this.#userActivityWriter.updateLastActiveAt(userId, timezone, appVersion).catch((error) => {
      if (this.#throttleMap.get(throttleKey) === touchedAt) {
        this.#throttleMap.delete(throttleKey);
      }
      this.#logger.error({
        event: AuthLogEvent.LAST_ACTIVE_UPDATE_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    });
  }

  #cleanup(): void {
    const cutoff = Date.now() - LastActiveInterceptor.THROTTLE_MS;
    let cleaned = 0;

    for (const [throttleKey, timestamp] of this.#throttleMap.entries()) {
      if (timestamp < cutoff) {
        this.#throttleMap.delete(throttleKey);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.#logger.debug({ event: AuthLogEvent.LAST_ACTIVE_THROTTLE_CLEANED, count: cleaned });
    }
  }
}
