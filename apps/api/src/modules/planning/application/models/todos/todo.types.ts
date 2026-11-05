import type { TodoRepeat } from "@aido/api";
import type { TodoVisibility } from "@aido/api/vocabulary";

/**
 * 할 일 생성 입력. 시각은 벽시계 HH:mm로 받아 timezone으로 해석한다.
 * 반복은 회차 날짜마다 다시 해석해야 해서 이미 변환한 instant로는 받지 않는다.
 */
export interface CreateTodoData {
  readonly userId: string;
  readonly title: string;
  readonly categoryId: number;
  readonly startDate: Date;
  readonly endDate?: Date | null;
  readonly scheduledTime?: string | null;
  readonly timezone: string;
  readonly isAllDay?: boolean;
  readonly visibility?: TodoVisibility;
  readonly items?: readonly { title: string }[];
  readonly repeat?: TodoRepeat | null;
  /**
   * 출시 앱(1.14.x까지)의 기간이 정해진 경로 전용. 옛 서버에 없던 거절을 더하지 않으려고
   * 진행 중 반복 상한을 보지 않는다. 호환 범위는 docs/conventions/compatibility.md에 적는다.
   */
  readonly exemptFromSeriesLimit?: boolean;
}

export interface UpdateTodoData {
  readonly title?: string;
  readonly categoryId?: number;
  readonly startDate?: Date;
  readonly endDate?: Date | null;
  readonly scheduledTime?: string | null;
  readonly isAllDay?: boolean;
  readonly visibility?: TodoVisibility;
  readonly completed?: boolean;
}

export interface GetTodosParams {
  readonly userId: string;
  readonly cursor?: number;
  readonly size?: number;
  readonly completed?: boolean;
  readonly categoryId?: number;
  readonly startDate?: Date;
  readonly endDate?: Date;
}

export interface GetFriendTodosParams {
  readonly userId: string;
  readonly friendUserId: string;
  readonly cursor?: number;
  readonly size?: number;
  readonly startDate?: Date;
  readonly endDate?: Date;
}

export interface FindTodosParams {
  readonly userId: string;
  readonly cursor?: number;
  readonly size: number;
  readonly completed?: boolean;
  readonly categoryId?: number;
  readonly startDate?: Date;
  readonly endDate?: Date;
}

export interface FindFriendTodosParams {
  readonly friendUserId: string;
  readonly cursor?: number;
  readonly size: number;
  readonly startDate?: Date;
  readonly endDate?: Date;
}
