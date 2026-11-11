import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { SupportedLocale } from "#api/shared/domain/locale";

/** 회원가입 시딩할 초기 약관 동의 값. */
export interface ProvisioningConsent {
  readonly termsAgreedAt?: Temporal.Instant;
  readonly privacyAgreedAt?: Temporal.Instant;
  readonly agreedTermsVersion?: string;
  readonly marketingAgreedAt?: Temporal.Instant;
  readonly marketingPushAgreedAt?: Temporal.Instant;
}

/**
 * 신규 사용자 프로비저닝 시 타 모듈(user-settings·todo-category) 기본값 시딩 포트 (auth 소유 ACL).
 *
 * concrete 저장소를 배럴로 주입하지 않고, 이 포트를 통해 시딩 의도만 노출한다.
 * 어댑터가 설정과 기본 카테고리 생성을 위임하며, 호출측이 연 CLS 트랜잭션에 참여한다.
 */
export abstract class UserProvisioningSeederPort {
  abstract seedDefaultSettings(userId: UserId, consent: ProvisioningConsent): Promise<void>;
  abstract seedDefaultCategories(userId: UserId, locale?: SupportedLocale): Promise<void>;
}
