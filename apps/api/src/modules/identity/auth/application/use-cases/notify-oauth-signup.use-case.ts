import type { AccountProvider } from "#api/modules/identity/auth/domain/auth.constants";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { toIsoString } from "#api/shared/domain/time/instant";

import { AuthLogEvent } from "../auth.log-events.js";
import type {
  AuthRegistrationNotifierPort,
  AuthUserRegisteredNotification,
} from "../ports/auth-collaboration.port.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type { RequestDevice } from "../read-models/auth-result.read-model.js";

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

export interface NotifyOAuthSignupCommand {
  readonly userId: string;
  readonly provider: AccountProvider;
  readonly device?: RequestDevice;
}

interface OAuthSignupNotifierDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByIdWithProfile">;
  readonly adminEventNotifier: Pick<AuthRegistrationNotifierPort, "notifyUserRegistered">;
  readonly logger: Pick<ApplicationLoggerPort, "warn" | "error">;
}

/**
 * 소셜 가입 관리자 알림. 기기 정보는 앱이 보낸 요청에만 있으므로 앱 요청을 처리하는 유스케이스가
 * 호출한다. 시스템 브라우저가 부르는 웹 콜백에서 호출하면 앱 버전·기기가 비어 나간다.
 */
export class NotifyOAuthSignupUseCase {
  readonly #dependencies: OAuthSignupNotifierDependencies;

  constructor(dependencies: OAuthSignupNotifierDependencies) {
    this.#dependencies = dependencies;
  }

  /** 토큰이 이미 발급된 뒤에 불리므로 실패해도 던지지 않는다. 알림 때문에 로그인을 잃으면 안 된다. */
  async notify(input: NotifyOAuthSignupCommand): Promise<void> {
    try {
      const user = await this.#dependencies.userRepository.findByIdWithProfile(input.userId);
      if (user == null) {
        this.#dependencies.logger.warn({
          event: AuthLogEvent.SIGNUP_NOTIFICATION_SKIPPED,
          userId: input.userId,
          provider: input.provider,
        });
        return;
      }
      this.#dependencies.adminEventNotifier.notifyUserRegistered({
        userId: user.id,
        email: user.email,
        provider: ACCOUNT_PROVIDER_TO_EVENT[input.provider],
        registeredAt: toIsoString(user.createdAt),
        name: user.profile?.name ?? undefined,
        ...input.device,
      } satisfies AuthUserRegisteredNotification);
    } catch (error) {
      this.#dependencies.logger.error({
        event: AuthLogEvent.SIGNUP_NOTIFICATION_FAILED,
        userId: input.userId,
        provider: input.provider,
        errorType: toErrorType(error),
      });
    }
  }
}
