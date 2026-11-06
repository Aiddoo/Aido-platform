import { useTodayKey } from '@src/shared/hooks/use-today';
import { useLocalSearchParams } from 'expo-router';

import {
  subTodoScreenParamsSchema,
  todoCreateCategoryParamsSchema,
  todoCreatePrefillParamsSchema,
  todoCreateVoiceHintParamsSchema,
  todoSheetDateParamsSchema,
} from '../schemas/todo-params.schema';
import { toFeedDateKey } from '../utils/feed-date-key';

/** 시트가 할 일을 읽어 올 목록 날짜(YYYY-MM-DD). 없거나 잘못되면 오늘이다. */
export function useTodoSheetDateParam(): string {
  const { date } = todoSheetDateParamsSchema.parse(useLocalSearchParams());
  return toFeedDateKey(date, useTodayKey());
}

/** 할 일 추가 시트가 처음 고를 카테고리. 없거나 잘못되면 undefined다. */
export function useTodoCreateCategoryParam() {
  return todoCreateCategoryParamsSchema.parse(useLocalSearchParams()).categoryId;
}

/** 다른 화면이 제안한 제목·시각. 잘못된 값은 버리고 빈 시트로 연다. */
export function useTodoCreatePrefillParam() {
  return todoCreatePrefillParamsSchema.parse(useLocalSearchParams());
}

export function useTodoCreateVoiceHintParam(): boolean {
  return todoCreateVoiceHintParamsSchema.parse(useLocalSearchParams()).voiceHint != null;
}

export function useSubTodoScreenParams() {
  return subTodoScreenParamsSchema.parse(useLocalSearchParams());
}
