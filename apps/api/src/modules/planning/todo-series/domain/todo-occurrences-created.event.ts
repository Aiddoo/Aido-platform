/**
 * 반복 회차를 한 번에 만들었다는 사실. 회차마다 TodoCreatedEvent를 내면 90행마다 리마인더를
 * 하나씩 취소·등록하게 되므로, 리마인더는 일괄 등록하고 캐시 구독자에게는 이 이벤트 하나만 보낸다.
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
