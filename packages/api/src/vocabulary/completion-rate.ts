const FULL_RATE = 100;

/**
 * 할 일 완료율(0~100 정수). 서버 응답·알림·AI 리포트와 앱이 같은 값을 보이게 한 곳에서 계산한다.
 * 반올림이 상태를 바꾸지 않게, 하나라도 남았으면 100이 아니고 하나라도 끝냈으면 0이 아니다.
 */
export function completionRate(completedCount: number, totalCount: number): number {
  if (totalCount <= 0 || completedCount <= 0) {
    return 0;
  }
  if (completedCount >= totalCount) {
    return FULL_RATE;
  }
  const rounded = Math.round((completedCount / totalCount) * FULL_RATE);
  return Math.min(Math.max(rounded, 1), FULL_RATE - 1);
}

// 할 일이 하나 이상이고 모두 끝낸 날(달력의 물고기·연속 기록·리포트 완벽한 날)의 규칙 하나다
export function isAllCompleted(completedCount: number, totalCount: number): boolean {
  return totalCount > 0 && completedCount === totalCount;
}
