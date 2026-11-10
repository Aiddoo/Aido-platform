import { TODO_EVENTS } from "../../shared/domain/todo-event-names.constants.js";

/** 범위 수정·삭제로 회차 여러 개가 바뀌었다는 사실. 캐시 구독자에게 규칙당 하나만 보낸다. */
export class TodoOccurrencesChangedEvent {
  readonly eventName = TODO_EVENTS.OCCURRENCES_CHANGED;

  readonly seriesId: string;
  readonly userId: string;

  constructor(seriesId: string, userId: string) {
    this.seriesId = seriesId;
    this.userId = userId;
  }
}
