/**
 * 반복 회차를 한 번에 만들었다는 사실. 회차마다 TodoCreatedEvent를 내면 90행마다 리마인더를
 * 하나씩 취소·등록하게 되므로, 리마인더는 일괄 등록하고 캐시 구독자에게는 이 이벤트 하나만 보낸다.
 * createdCount는 계획한 회차 수다. 이미 있던 날짜는 저장 때 건너뛰어 실제 행 수보다 클 수 있고,
 * 내보내는 payload에는 수가 없어 캐시를 한 번 더 지울 뿐이다.
 */
export class TodoOccurrencesCreatedEvent {
  readonly eventName = "todo.occurrences-created";

  readonly seriesId: string;
  readonly userId: string;
  readonly createdCount: number;

  constructor(seriesId: string, userId: string, createdCount: number) {
    this.seriesId = seriesId;
    this.userId = userId;
    this.createdCount = createdCount;
  }
}
