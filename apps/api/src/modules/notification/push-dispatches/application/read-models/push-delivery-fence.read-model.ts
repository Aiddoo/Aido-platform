// 발송·세대·작업 id·시도 수. 늦게 끝난 worker가 새 세대의 결과를 덮지 못하게 한다
export interface PushDeliveryFenceReadModel {
  readonly dispatchId: number;
  readonly publishAttempt: number;
  readonly processingJobId: string;
  readonly deliveryAttemptCount: number;
}
