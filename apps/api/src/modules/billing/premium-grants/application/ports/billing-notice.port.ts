/** 며칠 전 결제·보상 안내 한 건. 야간 미루기는 받는 사람으로 판단한다. */
export interface BillingNotice {
  readonly userId: string;
}

export interface FindDueBillingNoticesParams<TNotice extends BillingNotice> {
  readonly now: Temporal.Instant;
  /** 이 시각 이전에 끝나는 기간만 고른다. */
  readonly endsBefore: Temporal.Instant;
  /** 같은 실행에서 이미 본 마지막 후보. 그 다음부터 끝나는 순서(keyset)로 읽는다. */
  readonly after?: TNotice;
  readonly limit: number;
}

/** 안내할 기간을 고르고 보냈다고 표시하는 저장소. 트랜잭션은 CLS로 전파된다. */
export abstract class BillingNoticeRepositoryPort<TNotice extends BillingNotice> {
  /** 지금~endsBefore에 끝나는, 아직 안내하지 않은 기간을 끝나는 순서로 읽는다. */
  abstract listDue(params: FindDueBillingNoticesParams<TNotice>): Promise<TNotice[]>;
  /**
   * 아직 안내하지 않은 행만 조건부 UPDATE … RETURNING으로 표시하고 표시한 안내를 돌려준다. 두 실행이
   * 같은 행을 고르면 행 잠금 뒤 조건을 다시 보므로 한 실행만 그 행을 얻는다.
   */
  abstract claim(notices: readonly TNotice[], claimedAt: Temporal.Instant): Promise<TNotice[]>;
}

export abstract class BillingNoticeNotifierPort<TNotice extends BillingNotice> {
  /** 활성 UoW 안에서 알림함 기록과 푸시 outbox를 함께 남긴다. */
  abstract notify(notices: readonly TNotice[], now: Temporal.Instant): Promise<void>;
}
