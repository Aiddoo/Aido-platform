import { entityIdSchema } from '@aido/api/common';
import { userSummarySchema } from '@src/shared/domains/user-summary.model';
import { z } from 'zod';

import { type Todo, todoSchema } from './todo.model';

// 할 일 상세 화면의 값. 권한은 서버가 보는 사람·완료·공개 범위로 정해 앱은 그대로 읽는다
export const todoDetailsSchema = z.object({
  todo: todoSchema,
  owner: userSummarySchema.pick({ name: true, profileImage: true }).extend({ id: entityIdSchema }),
  permissions: z.object({
    canEdit: z.boolean(),
    canComment: z.boolean(),
    canNudge: z.boolean(),
    canThank: z.boolean(),
  }),
  metrics: z.object({
    viewCount: z.int().nonnegative(),
    commentCount: z.int().nonnegative(),
  }),
});
export type TodoDetails = z.infer<typeof todoDetailsSchema>;

export const TodoDetailsPolicy = {
  // 할 일은 주인만 고칠 수 있어 수정 권한이 있으면 내 할 일이다. 내 할 일은 신고·차단하지 않는다
  canReport(details: TodoDetails): boolean {
    return !details.permissions.canEdit;
  },

  withTodo(details: TodoDetails, todo: Todo): TodoDetails {
    return { ...details, todo };
  },
};
