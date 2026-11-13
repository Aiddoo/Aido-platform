import { type KeepStateOptions } from 'react-hook-form';

// RHF 7.91 `_reset`은 keepDirtyValues만 주면 isDirty와 칸 오류를 지우고, `values`는 마운트할 때도 한 번 reset한다
/** `values`로 다시 받은 서버 값을 따르는 수정 폼. 고치던 칸·저장할 변경 표시(isDirty)·칸 오류는 남는다 */
export const SERVER_VALUES_RESET_OPTIONS = {
  keepDirtyValues: true,
  keepDirty: true,
  keepErrors: true,
} as const satisfies KeepStateOptions;

// `form.reset`도 resetOptions를 합친다. 끄지 않으면 저장한 값 대신 고치던 글자와 고친 표시가 남는다
/** 위 폼이 저장한 값으로 처음부터 다시 시작할 때 `form.reset(values, …)`에 넘긴다 */
export const SAVED_VALUES_RESET_OPTIONS = {
  keepDirtyValues: false,
  keepDirty: false,
  keepErrors: false,
} as const satisfies KeepStateOptions;
