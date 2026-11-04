import type { CurrentUserPayload } from "@aido/api";
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
  type OnModuleDestroy,
} from "@nestjs/common";
import type { Observable } from "rxjs";

import { RequestClientReader } from "#api/platform/http/request-client/index";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { IdentitySettingsLogEvent } from "../../../application/observability/settings/identity-settings-log.events.js";
import { RefreshPushTimezone } from "../../../application/use-cases/settings/refresh-push-timezone.use-case.js";

@Injectable()
export class TimezoneSelfHealInterceptor implements NestInterceptor, OnModuleDestroy {
  readonly #logger = new Logger(TimezoneSelfHealInterceptor.name);

  readonly #seen = new Map<string, { tz: string; at: number }>();

  readonly #cleanupInterval: NodeJS.Timeout;

  static readonly THROTTLE_MS = 60 * 60 * 1000;

  constructor(
    private readonly refreshPushTimezoneUseCase: RefreshPushTimezone,
    private readonly requestClientReader: RequestClientReader,
  ) {
    this.#cleanupInterval = setInterval(
      () => this.#cleanup(),
      TimezoneSelfHealInterceptor.THROTTLE_MS,
    );
  }

  onModuleDestroy(): void {
    clearInterval(this.#cleanupInterval);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = context.switchToHttp().getRequest<{ user?: CurrentUserPayload }>().user;

    if (user?.userId) {
      const { timezone } = this.requestClientReader.current();
      if (timezone != null) {
        this.#heal(user.userId, timezone);
      }
    }

    return next.handle();
  }

  #heal(userId: string, timezone: string): void {
    const now = Date.now();
    const seen = this.#seen.get(userId);

    if (seen && seen.tz === timezone && now - seen.at < TimezoneSelfHealInterceptor.THROTTLE_MS) {
      return;
    }

    const attempt = { tz: timezone, at: now };
    this.#seen.set(userId, attempt);

    void this.refreshPushTimezoneUseCase.execute({ userId, timezone }).catch((error: unknown) => {
      if (this.#seen.get(userId) === attempt) {
        this.#seen.delete(userId);
      }
      this.#logger.error({
        event: IdentitySettingsLogEvent.TIMEZONE_HEAL_FAILED,
        userId,
        timezone,
        errorType: toErrorType(error),
      });
    });
  }

  #cleanup(): void {
    const cutoff = Date.now() - TimezoneSelfHealInterceptor.THROTTLE_MS;
    let cleaned = 0;

    for (const [userId, entry] of this.#seen.entries()) {
      if (entry.at < cutoff) {
        this.#seen.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.#logger.debug({
        event: IdentitySettingsLogEvent.TIMEZONE_HEAL_CLEANED,
        removedCount: cleaned,
      });
    }
  }
}
