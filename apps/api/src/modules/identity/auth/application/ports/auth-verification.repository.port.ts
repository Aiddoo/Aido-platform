import type { AuthVerification } from "../../domain/auth-verification.aggregate.js";
import type { VerificationType } from "../../domain/auth.constants.js";
import type { VerificationId } from "../../domain/verification-id.vo.js";

export interface ConsumeAuthVerificationInput {
  readonly id: number;
  readonly userId: string;
  readonly type: VerificationType;
  readonly tokenHash: string;
  readonly maxAttempts: number;
  readonly at: Temporal.Instant;
}

export abstract class AuthVerificationRepositoryPort {
  abstract nextId(): Promise<VerificationId>;
  /** 쓰지 않았고 만료 전인 같은 종류 코드 중 가장 최근 것 */
  abstract findValidByUserIdAndType(
    userId: string,
    type: VerificationType,
    now: Temporal.Instant,
  ): Promise<AuthVerification | null>;
  abstract countRecentByUserIdAndType(
    userId: string,
    type: VerificationType,
    since: Temporal.Instant,
  ): Promise<number>;
  abstract save(verification: AuthVerification): Promise<void>;
  /** 남은 같은 종류 코드를 지금 만료시키고 만료시킨 수를 준다 */
  abstract invalidateAllByUserIdAndType(
    userId: string,
    type: VerificationType,
    now: Temporal.Instant,
  ): Promise<number>;
  /** 아직 쓸 수 있고 hash가 맞을 때만 사용 처리한다. 경합에 지면 false다 */
  abstract consume(input: ConsumeAuthVerificationInput): Promise<boolean>;
  /** 호출자 트랜잭션이 롤백돼도 실패 횟수가 남아야 한다 */
  abstract incrementAttempts(verificationId: number): Promise<void>;
}
