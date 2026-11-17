/** 계획의 겹침 판정·고유명사 교정에 쓰는 다가오는 할 일. 반복 할 일은 다음 회차 하나다. */
export interface UpcomingTodoReadModel {
  readonly id: number;
  readonly title: string;
  readonly startDate: string;
  readonly isRepeating: boolean;
}
