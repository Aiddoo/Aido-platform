/**
 * Todo 엔티티 스키마 (응답용)
 *
 * 날짜는 ISO 8601 문자열로 직렬화
 * @see datetime.ts - Known Issue: https://github.com/colinhacks/zod/issues/4508
 */
import { z } from 'zod';
import { datetimeSchema, nullableDatetimeSchema } from '../../common/datetime';

export const todoVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']).describe('공개 범위');
export type TodoVisibility = z.infer<typeof todoVisibilitySchema>;

export const todoSchema = z.object({
  id: z.string().cuid().describe('할 일 고유 ID'),
  userId: z.string().cuid().describe('사용자 ID'),
  title: z.string().max(200).describe('할 일 제목'),
  content: z.string().max(5000).nullable().describe('할 일 내용'),
  color: z.string().max(7).nullable().describe('HEX 색상 코드'),
  completed: z.boolean().describe('완료 여부'),
  completedAt: nullableDatetimeSchema.describe('완료 시각'),
  startDate: datetimeSchema.describe('시작 날짜'),
  endDate: nullableDatetimeSchema.describe('종료 날짜'),
  scheduledTime: nullableDatetimeSchema.describe('예약 시간'),
  isAllDay: z.boolean().describe('하루 종일 여부'),
  visibility: todoVisibilitySchema,
  createdAt: datetimeSchema.describe('생성 시각'),
  updatedAt: datetimeSchema.describe('수정 시각'),
});

export type Todo = z.infer<typeof todoSchema>;
