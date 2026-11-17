import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { Entity } from "#api/shared/domain/model/entity";

import { AiDataSharingConsent } from "./ai-data-sharing-consent.entity.js";

export interface UserConsentPrimitives {
  readonly userId: string;
  readonly termsAgreedAt: Temporal.Instant | null;
  readonly privacyAgreedAt: Temporal.Instant | null;
  readonly agreedTermsVersion: string | null;
  readonly marketingAgreedAt: Temporal.Instant | null;
  readonly marketingPushAgreedAt: Temporal.Instant | null;
  /** 현재 aiDataSharingVersion 안내에 동의한 시각. 거부·철회했으면 null */
  readonly aiDataSharingAgreedAt: Temporal.Instant | null;
  /** 마지막으로 답한 AI 데이터 처리 안내 버전. 답한 적 없으면 null */
  readonly aiDataSharingVersion: string | null;
}

/** 가입 때 받은 약관·광고성 수신 동의. 없는 동의는 null이다 */
export type ConsentAgreement = Partial<Omit<UserConsentPrimitives, "userId">>;

interface UserConsentProps {
  readonly termsAgreedAt: Temporal.Instant | null;
  readonly privacyAgreedAt: Temporal.Instant | null;
  readonly agreedTermsVersion: string | null;
  marketingAgreedAt: Temporal.Instant | null;
  marketingPushAgreedAt: Temporal.Instant | null;
  aiDataSharingAgreedAt: Temporal.Instant | null;
  aiDataSharingVersion: string | null;
}

/** 사용자의 약관·광고성 수신·AI 데이터 처리 동의(`UserConsent` 행). UserPreference를 거쳐서만 바뀐다 */
export class UserConsent extends Entity<UserId, UserConsentProps> {
  static create(userId: UserId, agreement: ConsentAgreement): UserConsent {
    return new UserConsent(userId, {
      termsAgreedAt: agreement.termsAgreedAt ?? null,
      privacyAgreedAt: agreement.privacyAgreedAt ?? null,
      agreedTermsVersion: agreement.agreedTermsVersion ?? null,
      marketingAgreedAt: agreement.marketingAgreedAt ?? null,
      marketingPushAgreedAt: agreement.marketingPushAgreedAt ?? null,
      aiDataSharingAgreedAt: agreement.aiDataSharingAgreedAt ?? null,
      aiDataSharingVersion: agreement.aiDataSharingVersion ?? null,
    });
  }

  static reconstitute(primitives: UserConsentPrimitives): UserConsent {
    const { userId, ...props } = primitives;
    return new UserConsent(UserId.reconstitute(userId), { ...props });
  }

  get marketingAgreedAt(): Temporal.Instant | null {
    return this.props.marketingAgreedAt;
  }

  get marketingPushAgreedAt(): Temporal.Instant | null {
    return this.props.marketingPushAgreedAt;
  }

  aiDataSharing(): AiDataSharingConsent {
    return AiDataSharingConsent.reconstitute({
      userId: this.id.value,
      agreedAt: this.props.aiDataSharingAgreedAt,
      version: this.props.aiDataSharingVersion,
    });
  }

  // 다시 동의하면 동의 시각을 지금으로 새로 남긴다(재확인 주기도 그때부터 센다). 이미 철회했으면 false다
  changeMarketing(agreed: boolean, now: Temporal.Instant): boolean {
    const agreedAt = agreed ? now : null;
    if (sameInstant(this.props.marketingAgreedAt, agreedAt)) {
      return false;
    }
    this.props.marketingAgreedAt = agreedAt;
    return true;
  }

  changeMarketingPush(agreed: boolean, now: Temporal.Instant): boolean {
    const agreedAt = agreed ? now : null;
    if (sameInstant(this.props.marketingPushAgreedAt, agreedAt)) {
      return false;
    }
    this.props.marketingPushAgreedAt = agreedAt;
    return true;
  }

  // 거부·철회도 답한 안내 버전을 남긴다
  answerAiDataSharing(params: {
    readonly agreed: boolean;
    readonly version: string;
    readonly now: Temporal.Instant;
  }): boolean {
    const agreedAt = params.agreed ? params.now : null;
    if (
      sameInstant(this.props.aiDataSharingAgreedAt, agreedAt) &&
      this.props.aiDataSharingVersion === params.version
    ) {
      return false;
    }
    this.props.aiDataSharingAgreedAt = agreedAt;
    this.props.aiDataSharingVersion = params.version;
    return true;
  }

  toPrimitives(): UserConsentPrimitives {
    return { userId: this.id.value, ...this.props };
  }
}

function sameInstant(left: Temporal.Instant | null, right: Temporal.Instant | null): boolean {
  if (left == null || right == null) {
    return left == null && right == null;
  }
  return left.equals(right);
}
