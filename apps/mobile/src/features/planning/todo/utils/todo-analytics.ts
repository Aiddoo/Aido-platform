import type { TodoFieldChanges } from '../domains/todo.model';
import type { TodoSeriesEditOptions } from '../schemas/todo-series-request.schema';

// 수정 폼이 칸을 담는 순서다. 대시보드가 읽는 값이라 모델 칸 이름이 바뀌어도 그대로 둔다
const TODO_EDITED_FIELD_ORDER = [
  'title',
  'categoryId',
  'startDate',
  'endDate',
  'scheduledTime',
  'isAllDay',
  'visibility',
] as const satisfies readonly (keyof TodoFieldChanges)[];

type TodoEditedField = (typeof TODO_EDITED_FIELD_ORDER)[number];

/** 순서를 지킨 부분 수열을 쉼표로 이은 값(`title,startDate`) */
type JoinedInOrder<Fields extends readonly string[]> = Fields extends readonly [
  infer Head extends string,
  ...infer Tail extends readonly string[],
]
  ? Head | `${Head},${JoinedInOrder<Tail>}` | JoinedInOrder<Tail>
  : never;

/** 고친 칸을 폼 순서로 이은 값. 칸을 고치지 않고 반복만 바꾼 수정은 repeat 한 칸이다 */
export type TodoEditedFields = JoinedInOrder<typeof TODO_EDITED_FIELD_ORDER> | 'repeat';

function isTodoEditedField(value: string): value is TodoEditedField {
  return TODO_EDITED_FIELD_ORDER.some((field) => field === value);
}

function isJoinedInOrder(joined: string): joined is TodoEditedFields {
  const positions = joined
    .split(',')
    .map((name) => (isTodoEditedField(name) ? TODO_EDITED_FIELD_ORDER.indexOf(name) : -1));
  return positions.every((position, index) => position > (positions[index - 1] ?? -1));
}

export function toTodoEditedFields(
  fields: TodoFieldChanges,
  options: TodoSeriesEditOptions = {},
): TodoEditedFields | undefined {
  const joined = TODO_EDITED_FIELD_ORDER.filter((field) => field in fields).join(',');
  if (joined !== '' && isJoinedInOrder(joined)) {
    return joined;
  }
  // oxlint-disable-next-line aido/no-strict-nullish -- repeat null은 반복 끝내기라 바꾼 것이다
  return options.repeat === undefined ? undefined : 'repeat';
}
