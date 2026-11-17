// 계정이 있든 없든 같은 이메일을 같은 기록으로 세어 상한 응답으로 가입 여부가 드러나지 않게 한다
export abstract class VerificationEmailCapPort {
  /** 이 이메일로 코드를 보낸 것으로 센 시각들. 창 밖 기록이 섞여 있을 수 있다 */
  abstract findSentAts(email: string): Promise<readonly Temporal.Instant[]>;
  abstract saveSentAts(email: string, sentAts: readonly Temporal.Instant[]): Promise<void>;
}
