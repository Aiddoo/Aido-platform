import type { UserRole } from "@aido/api/vocabulary";

import type { AccountProvider, UserStatus } from "#api/modules/identity/auth/domain/auth.constants";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { type AuthAccountRepositoryPort } from "../ports/auth-account.repository.port.js";
import { type AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import { type RetentionEnrollerPort } from "../ports/retention-enroller.port.js";
import type {
  ProvisioningConsent,
  UserProvisioningSeederPort,
} from "../ports/user-provisioning-seeder.port.js";

/** 신원 계정 유형 — 크레덴셜(이메일) 또는 소셜(OAuth) */
type ProvisionAccount =
  | { kind: "credential"; hashedPassword: string }
  | {
      kind: "oauth";
      provider: AccountProvider;
      providerAccountId: string;
      refreshToken?: string;
    };

export interface ProvisionUserCommand {
  email: string;
  status: UserStatus;
  /** 소셜은 가입 시각에 인증됨, 크레덴셜은 비운다(이메일 인증 대기) */
  emailVerifiedAt?: Temporal.Instant;
  account: ProvisionAccount;
  profile: { name?: string; profileImage?: string };
  /** 동의한 약관 버전(TERMS_VERSION.CURRENT)은 약관에 동의하지 않았으면 비운다 */
  consent: ProvisioningConsent;
  /** 가입 요청의 앱 언어. 기본 카테고리 이름에 쓴다. */
  locale?: SupportedLocale;
}

/** 프로비저닝 결과 — 호출측이 사용하는 최소 신원 정보 */
export interface ProvisionedUser {
  readonly id: string;
  readonly email: string;
  readonly userTag: string;
  readonly role: UserRole;
}

/**
 * 신규 사용자 프로비저닝 공통 시퀀스 — 이메일 회원가입과 소셜 신규가입의 수렴점.
 *
 * (1) User 생성 → (2) 계정(크레덴셜/OAuth) 연결 → (3) 프로필 →
 * (4) 약관 동의 → (5) 푸시 설정 기본값 → (6) 기본 카테고리 시딩.
 * 호출측이 연 트랜잭션(CLS)에 참여하며, 보안 로그·이메일 인증 코드 발급·세션 발급 등
 * 경로별 처리는 호출측이 담당한다(IssueLoginUseCase와 동일한 범위 규율).
 */
interface ProvisionUserDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "create" | "createProfile">;
  readonly accountRepository: Pick<
    AuthAccountRepositoryPort,
    "createCredentialAccount" | "createOAuthAccount"
  >;
  readonly seeder: UserProvisioningSeederPort;
  readonly retentionEnroller: Pick<RetentionEnrollerPort, "enrollNewUser">;
}

export class ProvisionUserUseCase {
  readonly #dependencies: ProvisionUserDependencies;

  constructor(dependencies: ProvisionUserDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ProvisionUserCommand): Promise<ProvisionedUser> {
    const user = await this.#dependencies.userRepository.create({
      email: input.email,
      status: input.status,
      emailVerifiedAt: input.emailVerifiedAt,
    });

    const account = input.account;
    switch (account.kind) {
      case "credential":
        await this.#dependencies.accountRepository.createCredentialAccount(
          user.id,
          account.hashedPassword,
        );
        break;
      case "oauth":
        await this.#dependencies.accountRepository.createOAuthAccount({
          userId: user.id,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          refreshToken: account.refreshToken,
        });
        break;
    }

    await this.#dependencies.userRepository.createProfile(user.id, input.profile);

    await this.#dependencies.seeder.seedDefaultSettings(user.id, input.consent);

    await this.#dependencies.seeder.seedDefaultCategories(user.id, input.locale);

    // 신규 User 생성 경로에만 존재한다. 기존 로그인/인증 경로는 호출하지 않는다.
    await this.#dependencies.retentionEnroller.enrollNewUser(user.id, input.status === "ACTIVE");

    return { id: user.id.value, email: user.email, userTag: user.userTag, role: user.role };
  }
}
