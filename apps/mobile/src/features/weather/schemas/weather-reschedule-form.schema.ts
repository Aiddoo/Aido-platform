import { z } from 'zod';

export const weatherRescheduleFormSchema = z.object({
  /** 선택 키(`toSelectionKey`) → 옮길 시작 시각(ISO). 옮기지 않을 할 일은 목록에서 빼므로 값이 없다. */
  selections: z.record(z.string(), z.iso.datetime()),
});

export type WeatherRescheduleFormValues = z.infer<typeof weatherRescheduleFormSchema>;
