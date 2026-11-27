import { z } from 'zod';

// 할 일 탭에서 캘린더 가져오기를 권하는 카드가 이 기능에서 보는 값
const todoImportFeedEntrySchema = z.object({
  isDismissed: z.boolean(),
  // settings: OS가 다시 묻지 않아 설정 앱에서만 켤 수 있다
  calendarAccess: z.enum(['granted', 'ask', 'settings']),
});
export type TodoImportFeedEntry = z.infer<typeof todoImportFeedEntrySchema>;

export const TodoImportFeedEntryPolicy = {
  // 설정에서만 켤 수 있는 거절이면 눌러도 가져올 수 없어 권하지 않는다
  canOffer(entry: TodoImportFeedEntry): boolean {
    return !entry.isDismissed && entry.calendarAccess !== 'settings';
  },

  // 할 일이 하나도 없는 계정에만 권한다. 할 일이 있는지는 할 일 기능이 답한다
  shouldShow(entry: TodoImportFeedEntry, hasTodo: boolean): boolean {
    return this.canOffer(entry) && !hasTodo;
  },
};
