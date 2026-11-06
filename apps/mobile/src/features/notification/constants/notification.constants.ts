/** 마케팅 푸시의 수신 거부 버튼. 서버 categoryId MARKETING과 앱 카테고리 등록이 함께 쓴다 */
export const MARKETING_OPT_OUT_ACTION = 'MARKETING_OPT_OUT';

export const SETTINGS_TIME_RANGE = {
  morning: { minimumTime: { hour: 0, minute: 0 }, maximumTime: { hour: 11, minute: 59 } },
  evening: { minimumTime: { hour: 12, minute: 0 }, maximumTime: { hour: 23, minute: 59 } },
} as const;
