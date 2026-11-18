/**
 * 범위 수정·삭제로 회차 여러 개가 바뀌었다는 사실. 규칙 값이 바뀌면 TodoSeries가, 규칙 값은 그대로인데
 * 회차 행만 바뀌면 기준 회차 Todo가 낸다. 구독자는 사용자 단위 캐시라 같은 커밋의 여러 개를 한 번으로 합친다.
 */
export class TodoOccurrencesChangedEvent {
  readonly eventName = "todo.occurrences-changed";

  readonly seriesId: string;
  readonly userId: string;

  constructor(seriesId: string, userId: string) {
    this.seriesId = seriesId;
    this.userId = userId;
  }
}
