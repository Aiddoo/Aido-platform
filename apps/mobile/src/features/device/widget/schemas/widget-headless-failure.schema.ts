import { z } from 'zod';

/** 앱 없이 깨어난 위젯 프로세스가 남긴 실패. 다음 앱 시작 때 오류 보고기로 보낸다 */
export const widgetHeadlessFailureSchema = z.object({
  method: z.string(),
  name: z.string(),
  message: z.string(),
});
export type WidgetHeadlessFailure = z.infer<typeof widgetHeadlessFailureSchema>;
