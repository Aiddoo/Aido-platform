import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { VerificationId } from "../../domain/verification-id.vo.js";
import type { Verification } from "../../domain/verification.aggregate.js";
import type { VerificationType } from "../../domain/verifications.constants.js";

export abstract class VerificationRepositoryPort {
  abstract nextId(): Promise<VerificationId>;
  /** 쓰지 않았고 만료 전인 같은 종류 코드 중 가장 최근 것 */
  abstract findValidByUserIdAndType(
    userId: UserId,
    type: VerificationType,
    now: Temporal.Instant,
  ): Promise<Verification | null>;
  /** since와 같거나 뒤에 만든 같은 종류 코드 중 가장 최근 발급 시각. 없으면 null */
  abstract findLatestIssuedAtByUserIdAndType(
    userId: UserId,
    type: VerificationType,
    since: Temporal.Instant,
  ): Promise<Temporal.Instant | null>;
  /** 새 코드는 넣는다. 읽은 코드는 소비만 저장하고, 그 사이 쓰였거나 만료·소진됐으면 false다 */
  abstract save(verification: Verification): Promise<boolean>;
  /** 남은 같은 종류 코드를 지금 만료시키고 만료시킨 수를 준다 */
  abstract invalidateAllByUserIdAndType(
    userId: UserId,
    type: VerificationType,
    now: Temporal.Instant,
  ): Promise<number>;
  /** 호출자 트랜잭션이 롤백돼도 실패 횟수가 남아야 한다 */
  abstract saveFailedAttempt(verification: Verification): Promise<void>;
}
