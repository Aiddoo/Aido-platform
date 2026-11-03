export const BROADCAST_FAN_OUT_ENQUEUER = Symbol("BROADCAST_FAN_OUT_ENQUEUER");

export interface BroadcastFanOutEnqueuerPort {
  /** 활성 UNIT_OF_WORK가 있으면 캠페인 저장과 함께 커밋된다. 같은 cursor의 작업은 한 번만 남는다. */
  enqueueFanOut(input: {
    readonly campaignId: string;
    readonly cursorUserId: string | null;
  }): Promise<void>;
}
