/** 초대한 사람 한 명의 상태별 수락 수 */
export interface InviteRedemptionSummary {
  readonly joinedCount: number;
  readonly qualifiedCount: number;
  readonly rewardedCount: number;
  readonly rejectedCount: number;
}
