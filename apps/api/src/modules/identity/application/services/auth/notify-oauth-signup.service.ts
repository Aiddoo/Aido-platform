import type { AccountProvider } from "#api/modules/identity/domain/types/auth/auth.types";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { toISOString } from "#api/shared/domain/date/utils/format";

import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type {
  AuthRegistrationNotifierPort,
  AuthUserRegisteredNotification,
} from "../../ports/auth/auth-collaboration.port.js";
import type { AuthUserRepositoryPort } from "../../ports/auth/auth-persistence.port.js";
import type { RequestDevice } from "../../types/auth/index.js";

const ACCOUNT_PROVIDER_TO_EVENT: Record<
  AccountProvider,
  AuthUserRegisteredNotification["provider"]
> = {
  CREDENTIAL: "credential",
  APPLE: "apple",
  GOOGLE: "google",
  KAKAO: "kakao",
  NAVER: "naver",
};

export interface NotifyOAuthSignupInput {
  readonly userId: string;
  readonly provider: AccountProvider;
  readonly device?: RequestDevice;
}

interface NotifyOAuthSignupDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByIdWithProfile">;
  readonly adminEventNotifier: Pick<AuthRegistrationNotifierPort, "notifyUserRegistered">;
  readonly logger: Pick<ApplicationLogger, "warn" | "error">;
}

/**
 * 소셜 가입 관리자 알림. 기기 정보는 앱이 보낸 요청에만 있으므로 앱 요청을 처리하는 유스케이스가
 * 호출한다. 시스템 브라우저가 부르는 웹 콜백에서 호출하면 앱 버전·기기가 비어 나간다.
 */
export class NotifyOAuthSignup {
  readonly #dependencies: NotifyOAuthSignupDependencies;

  constructor(dependencies: NotifyOAuthSignupDependencies) {
    this.#dependencies = dependencies;
  }

  /** 토큰이 이미 발급된 뒤에 불리므로 실패해도 던지지 않는다. 알림 때문에 로그인을 잃으면 안 된다. */
  async execute(input: NotifyOAuthSignupInput): Promise<void> {
    try {
      const user = await this.#dependencies.userRepository.findByIdWithProfile(input.userId);
      if (user == null) {
        this.#dependencies.logger.warn({
          event: IdentityLogEvent.SIGNUP_NOTIFICATION_SKIPPED,
          userId: input.userId,
          provider: input.provider,
        });
        return;
      }
      this.#dependencies.adminEventNotifier.notifyUserRegistered({
        userId: user.id,
        email: user.email,
        provider: ACCOUNT_PROVIDER_TO_EVENT[input.provider],
        registeredAt: toISOString(user.createdAt),
        name: user.profile?.name ?? undefined,
        ...input.device,
      } satisfies AuthUserRegisteredNotification);
    } catch (error) {
      this.#dependencies.logger.error({
        event: IdentityLogEvent.SIGNUP_NOTIFICATION_FAILED,
        userId: input.userId,
        provider: input.provider,
        errorType: toErrorType(error),
      });
    }
  }
}
