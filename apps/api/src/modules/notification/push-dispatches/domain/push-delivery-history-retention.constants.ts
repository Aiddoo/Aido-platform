// receipt 확인(24시간)·재시도·outbox 복구가 모두 끝난 발송을 장애·문의 확인에 쓰는 기간이다
export const FINISHED_PUSH_DISPATCH_RETENTION_DAYS = 30;

// 관리자 캠페인 발송의 campaignKey 머리다. 캠페인 결과 화면이 이 키로 발송을 세어 이 발송은 알림과 함께 180일 둔다.
// PushDispatch_status_scheduledAt_outside_broadcast_idx 부분 인덱스 조건이 같은 글자를 쓴다
export const ADMIN_BROADCAST_CAMPAIGN_KEY_PREFIX = "admin-broadcast:";
