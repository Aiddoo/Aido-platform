/** 진입 대기로 스플래시를 잡아 두는 상한. 판정이 어떻게 끝나든 스플래시에 갇히지 않게 한다 */
export const NOTIFICATION_ENTRY_HOLD_MAX_MS = 3000;

/**
 * 눌린 푸시를 열기 전에 읽음 응답을 기다리는 상한. 초깃값이라 Release 측정 뒤 확정한다.
 * 페이로드에 수신자 ID가 없어 읽음의 403·404가 다른 계정 알림을 막는 유일한 방어다.
 */
export const NOTIFICATION_READ_BUDGET_MS = 800;

/** 서버가 마케팅 푸시에 싣는 categoryId. 앱의 푸시 카테고리 등록이 같은 값을 쓴다 */
export const MARKETING_CATEGORY_ID = 'MARKETING';

/** 마케팅 푸시의 수신 거부 버튼. 서버 categoryId MARKETING과 앱 카테고리 등록이 함께 쓴다 */
export const MARKETING_OPT_OUT_ACTION = 'MARKETING_OPT_OUT';

export const SETTINGS_TIME_RANGE = {
  morning: { minimumTime: { hour: 0, minute: 0 }, maximumTime: { hour: 11, minute: 59 } },
  evening: { minimumTime: { hour: 12, minute: 0 }, maximumTime: { hour: 23, minute: 59 } },
} as const;
