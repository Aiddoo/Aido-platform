import { plainDateFromDate } from "#api/shared/domain/time/plain-date";

export interface EffectiveStreakResult {
  streak: number;
  isAtRisk: boolean;
}

/**
 * 저녁 리마인더 sweep용 — 입력값만으로 effective streak 계산 (DB 접근 없음).
 *
 * StreakService의 onAllCompleted 갱신 로직과 동일한 판정을, 호출자가 이미 조회한
 * 데이터만으로 수행한다. 스케줄러 전략(저녁 리마인더·스트릭 위기)이 사용한다.
 */
export function computeEffectiveStreak(params: {
  currentStreak: number;
  lastCompletedDate: Date | null;
  todosCompleted: number;
  todosTotal: number;
  today: Date;
}): EffectiveStreakResult {
  const { currentStreak, todosCompleted, todosTotal } = params;
  // 호출자가 아직 UTC 자정 Date로 넘겨 UTC 달력 날짜로 비교한다
  const today = plainDateFromDate(params.today);
  const yesterday = today.subtract({ days: 1 });
  const lastCompletedDate =
    params.lastCompletedDate == null ? null : plainDateFromDate(params.lastCompletedDate);

  // 전체 완료 시: streak 갱신 여부 판별
  if (todosCompleted === todosTotal && todosTotal > 0) {
    // StreakService에서 이미 DB 반영된 경우
    if (lastCompletedDate?.equals(today) === true) {
      return { streak: currentStreak, isAtRisk: false };
    }
    // 아직 미반영: 어제 완료 → 연속, 아니면 새 시작
    if (lastCompletedDate?.equals(yesterday) === true) {
      return { streak: currentStreak + 1, isAtRisk: false };
    }
    return { streak: 1, isAtRisk: false };
  }

  // 미완료 시: 스트릭 위기 판별
  const isAtRisk =
    todosCompleted < todosTotal &&
    currentStreak >= 2 &&
    lastCompletedDate?.equals(yesterday) === true;

  return { streak: currentStreak, isAtRisk };
}
