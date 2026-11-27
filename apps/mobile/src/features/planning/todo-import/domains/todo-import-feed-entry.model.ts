import { z } from 'zod';

// 할 일 탭에서 캘린더 가져오기를 권하는 카드가 보는 값. 할 일이 있는지는 할 일 기능이 준 값이다
const todoImportFeedEntrySchema = z.object({
  isDismissed: z.boolean(),
  // settings: OS가 다시 묻지 않아 설정 앱에서만 켤 수 있다
  calendarAccess: z.enum(['granted', 'ask', 'settings']),
  // 오늘 목록에 할 일이 보인다
  hasTodayTodo: z.boolean(),
  // 서버의 할 일 기록(만들었거나 가져왔다). 아직 묻지 않았거나 읽지 못했으면 null이다
  hasTodoRecord: z.boolean().nullable(),
});
export type TodoImportFeedEntry = z.infer<typeof todoImportFeedEntrySchema>;

export const TodoImportFeedEntryPolicy = {
  // 닫지 않았고 가져올 수 있는 권한 상태이며 오늘 할 일이 보이지 않을 때만 서버 기록을 묻는다
  shouldAskTodoRecord(entry: TodoImportFeedEntry): boolean {
    return !entry.isDismissed && entry.calendarAccess !== 'settings' && !entry.hasTodayTodo;
  },

  // 할 일이 하나도 없다고 서버 기록으로 확인한 계정에만 권한다
  shouldShow(entry: TodoImportFeedEntry): boolean {
    return this.shouldAskTodoRecord(entry) && entry.hasTodoRecord === false;
  },
};
