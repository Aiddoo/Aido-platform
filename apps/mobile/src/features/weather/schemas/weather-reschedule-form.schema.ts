import { z } from 'zod';

export const weatherRescheduleFormSchema = z.object({
  /** 선택 키(`toSelectionKey`) → 옮길 시작 시각(ISO). 옮기지 않을 할 일은 목록에서 빼므로 값이 없다. */
  selections: z.record(z.string(), z.iso.datetime()),
});

export type WeatherRescheduleFormValues = z.infer<typeof weatherRescheduleFormSchema>;

/** react-hook-form은 숫자 경로를 배열 index로 읽어 selections를 배열로 만들므로 숫자만으로 된 키를 쓰지 않는다 */
export function toSelectionKey(todoId: number): string {
  return `todo-${todoId}`;
}
