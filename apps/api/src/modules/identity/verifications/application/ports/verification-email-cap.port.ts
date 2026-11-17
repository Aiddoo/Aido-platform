import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { VerificationType } from "../../domain/verifications.constants.js";

/** 상한을 세는 기준. 이메일·IP·사용자 id 원문을 받고 저장 키로 바꾸는 일은 어댑터가 한다 */
export type VerificationEmailCapBucket =
  | { readonly scope: "email"; readonly purpose: VerificationType; readonly email: string }
  | {
      readonly scope: "email-source";
      readonly purpose: VerificationType;
      readonly email: string;
      readonly sourceIp: string;
    }
  | { readonly scope: "user"; readonly purpose: VerificationType; readonly userId: UserId };

// 계정이 있든 없든 같은 이메일을 같은 기록으로 세어 상한 응답으로 가입 여부가 드러나지 않게 한다
export abstract class VerificationEmailCapPort {
  /** 이 기준으로 코드를 보낸 것으로 센 시각들. 창 밖 기록이 섞여 있을 수 있다 */
  abstract findSentAts(bucket: VerificationEmailCapBucket): Promise<readonly Temporal.Instant[]>;
  abstract saveSentAts(
    bucket: VerificationEmailCapBucket,
    sentAts: readonly Temporal.Instant[],
  ): Promise<void>;
}
