import { z } from 'zod';

// 카드를 다시 띄우지 않는 이유. dismissed: 사용자가 닫음, hasTodo: 서버가 할 일이 있는 계정이라고 답함
export const todoImportFeedEntryClosedReasonSchema = z.enum(['dismissed', 'hasTodo']);

// 할 일 탭에서 캘린더 가져오기를 권하는 카드가 보는 값. 할 일이 있는지는 할 일 기능이 준 값이다
const todoImportFeedEntrySchema = z.object({
  closedReason: todoImportFeedEntryClosedReasonSchema.nullable(),
  // settings: OS가 다시 묻지 않아 설정 앱에서만 켤 수 있다
  calendarAccess: z.enum(['granted', 'ask', 'settings']),
  // 오늘 목록에 할 일이 보인다. 낙관적으로 더한 줄은 실패하면 되돌아가 기록의 근거로 쓰지 않는다
  hasTodayTodo: z.boolean(),
  // 서버의 할 일 기록(만들었거나 가져왔다). 아직 묻지 않았거나 읽지 못했으면 null이다
  hasTodoRecord: z.boolean().nullable(),
});
export type TodoImportFeedEntry = z.infer<typeof todoImportFeedEntrySchema>;

export const TodoImportFeedEntryPolicy = {
  // 닫혔거나 설정에서만 켤 수 있는 거절이면 눌러도 가져올 수 없어 권하지 않는다
  canOffer(entry: TodoImportFeedEntry): boolean {
    return entry.closedReason == null && entry.calendarAccess !== 'settings';
  },

  // 오늘 할 일이 보이면 이미 할 일이 있는 계정이라 서버 기록을 묻지 않는다
  shouldAskTodoRecord(entry: TodoImportFeedEntry): boolean {
    return this.canOffer(entry) && !entry.hasTodayTodo;
  },

  // 할 일이 하나도 없다고 서버 기록으로 확인한 계정에만 권한다
  shouldShow(entry: TodoImportFeedEntry): boolean {
    return this.shouldAskTodoRecord(entry) && entry.hasTodoRecord === false;
  },

  // 서버가 할 일이 있다고 답했고 아직 남긴 이유가 없으면 기기에 남겨 다시 묻지 않는다
  shouldRememberHasTodo(entry: TodoImportFeedEntry): boolean {
    return entry.closedReason == null && entry.hasTodoRecord === true;
  },
};
