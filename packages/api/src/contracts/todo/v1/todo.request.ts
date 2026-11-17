import { z } from "zod";

import { dateSchema, timeOfDaySchema } from "../../../common/datetime.js";
import {
  RECURRING_TODO_LIMITS,
  TODO_ITEM_LIMITS,
  TODO_LIMITS,
  TODO_PAGE_SIZE,
} from "../../../vocabulary/todo.constants.js";
import { reorderPositionSchema } from "../../todo-category/v1/todo-category.common.js";
import {
  dayOfWeekSchema,
  todoEditScopeSchema,
  todoRepeatSchema,
  todoUpdateScopeSchema,
  todoVisibilitySchema,
} from "./todo.common.js";

export const createTodoSchema = z
  .object({
    title: z
      .string()
      .min(1, "제목을 입력해주세요")
      .max(TODO_LIMITS.TITLE_MAX_LENGTH, "제목은 200자 이하로 입력해주세요")
      .meta({ description: "할 일 제목 (1-200자, 예: 운동하기)" }),
    categoryId: z
      .int()
      .positive("유효하지 않은 카테고리 ID입니다")
      .meta({ description: "카테고리 ID (양의 정수, 예: 1)" }),
    startDate: z.iso
      .date("유효한 날짜 형식이 아닙니다")
      .meta({ description: "시작 날짜 (YYYY-MM-DD, 예: 2024-01-15)" }),
    endDate: z.iso
      .date("유효한 날짜 형식이 아닙니다")
      .nullish()
      .meta({ description: "종료 날짜 (YYYY-MM-DD, 예: 2024-01-31, 단일 날짜는 null)" }),
    scheduledTime: timeOfDaySchema
      .nullish()
      .meta({ description: "예정 시간 (HH:mm 24시간 형식, 예: 15:30, 종일 일정은 null)" }),
    isAllDay: z.boolean().default(true).meta({ description: "종일 일정 여부 (기본값: true)" }),
    visibility: todoVisibilitySchema
      .default("PUBLIC")
      .meta({ description: "공개 범위 (PUBLIC: 전체 공개, PRIVATE: 비공개, 기본값: PUBLIC)" }),
    items: z
      .array(
        z.object({
          title: z
            .string()
            .min(1, "제목을 입력해주세요")
            .max(TODO_LIMITS.TITLE_MAX_LENGTH, "제목은 200자 이하로 입력해주세요")
            .meta({ description: "하위 항목 제목" }),
        }),
      )
      .max(
        TODO_ITEM_LIMITS.MAX_PER_TODO,
        `하위 항목은 최대 ${TODO_ITEM_LIMITS.MAX_PER_TODO}개까지 추가할 수 있습니다`,
      )
      .optional()
      .meta({ description: "투두 생성 시 함께 만들 체크리스트 (선택, 최대 20개)" }),
    repeat: todoRepeatSchema.optional().meta({
      description: "반복 규칙 (선택). 있으면 endDate는 비워야 하고 startDate부터 회차를 만든다",
    }),
  })
  .refine(
    (data) => {
      if (data.endDate && data.startDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      error: "종료 날짜는 시작 날짜 이후여야 합니다",
      path: ["endDate"],
    },
  );

export type CreateTodoInput = z.infer<typeof createTodoSchema>;

export const updateTodoSchema = z
  .object({
    title: z
      .string()
      .min(1, "제목을 입력해주세요")
      .max(TODO_LIMITS.TITLE_MAX_LENGTH, "제목은 200자 이하로 입력해주세요")
      .optional()
      .meta({ description: "할 일 제목 (선택, 1-200자)" }),
    categoryId: z
      .int()
      .positive("유효하지 않은 카테고리 ID입니다")
      .optional()
      .meta({ description: "카테고리 ID (선택, 양의 정수)" }),
    startDate: z.iso
      .date("유효한 날짜 형식이 아닙니다")
      .optional()
      .meta({ description: "시작 날짜 (선택, YYYY-MM-DD)" }),
    endDate: z.iso
      .date("유효한 날짜 형식이 아닙니다")
      .nullish()
      .meta({ description: "종료 날짜 (선택, YYYY-MM-DD, 단일 날짜는 null)" }),
    scheduledTime: timeOfDaySchema
      .nullish()
      .meta({ description: "예정 시간 (선택, HH:mm, 종일 일정은 null)" }),
    isAllDay: z.boolean().optional().meta({ description: "종일 일정 여부 (선택)" }),
    visibility: todoVisibilitySchema
      .optional()
      .meta({ description: "공개 범위 (선택, PUBLIC: 전체 공개, PRIVATE: 비공개)" }),
    completed: z.boolean().optional().meta({ description: "완료 상태 (선택)" }),
    scope: todoUpdateScopeSchema.optional().meta({
      description: "반복 회차의 수정 범위 (선택, 기본값: THIS_ONLY). 반복이 아니면 TODO_0844",
    }),
    repeat: todoRepeatSchema.nullable().optional().meta({
      description:
        "반복 규칙 (선택). 생략은 변경 없음, null은 이 회차 뒤로 끝내기, 값은 단일 할 일을 반복으로 전환하거나 scope=THIS_AND_FOLLOWING과 함께 규칙 변경",
    }),
    checklist: z
      .array(
        z.object({
          title: z
            .string()
            .min(1, "제목을 입력해주세요")
            .max(TODO_LIMITS.TITLE_MAX_LENGTH, "제목은 200자 이하로 입력해주세요")
            .meta({ description: "하위 항목 제목" }),
        }),
      )
      .max(
        TODO_ITEM_LIMITS.MAX_PER_TODO,
        `하위 항목은 최대 ${TODO_ITEM_LIMITS.MAX_PER_TODO}개까지 추가할 수 있습니다`,
      )
      .optional()
      .meta({
        description:
          "새로 만드는 회차에 복사할 체크리스트 (선택, scope=THIS_AND_FOLLOWING 전용). 이미 만든 회차의 진행은 그대로다",
      }),
  })
  .refine(
    (data) => {
      if (data.endDate && data.startDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      error: "종료 날짜는 시작 날짜 이후여야 합니다",
      path: ["endDate"],
    },
  );

export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;

export const getTodosQuerySchema = z.object({
  cursor: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .meta({ description: "페이지네이션 커서 (마지막 조회 Todo ID, 0 이상)" }),
  size: z.coerce
    .number()
    .int()
    .min(1, "페이지 크기는 1 이상이어야 합니다")
    .max(TODO_PAGE_SIZE.MAX, "페이지 크기는 200 이하여야 합니다")
    .default(TODO_PAGE_SIZE.DEFAULT)
    .meta({ description: "페이지 크기 (1-200, 기본값: 20)" }),
  completed: z
    .preprocess((value) => {
      if (value === "true") {
        return true;
      }
      if (value === "false") {
        return false;
      }
      return value;
    }, z.boolean())
    .optional()
    .meta({ description: "완료 상태 필터 (선택, true/false)" }),
  categoryId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .meta({ description: "카테고리 ID 필터 (선택, 양의 정수)" }),
  startDate: z.iso.date("유효한 날짜 형식이 아닙니다").optional().meta({
    description:
      "시작 날짜 필터 (선택, YYYY-MM-DD). 단독이면 그 날짜의 할 일만, endDate와 함께면 범위를 조회한다",
  }),
  endDate: z.iso.date("유효한 날짜 형식이 아닙니다").optional().meta({
    description:
      "종료 날짜 필터 (선택, YYYY-MM-DD). 단독이면 그 날짜의 할 일만 조회하고 startDate보다 이르면 400이다",
  }),
});

export type GetTodosQuery = z.infer<typeof getTodosQuerySchema>;

export const todoIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive("유효하지 않은 Todo ID입니다")
    .meta({ description: "할 일 고유 ID (양의 정수, 예: 1)" }),
});

export const deleteTodoQuerySchema = z.object({
  scope: todoEditScopeSchema.optional().meta({
    description:
      "반복 회차의 삭제 범위 (선택, 기본값: THIS_ONLY). ALL은 완료한 회차도 지운다. 반복이 아니면 TODO_0844",
  }),
});

export const todoSeriesIdParamSchema = z.object({
  seriesId: z.string().min(1).max(36).meta({ description: "반복 할 일 ID" }),
});

export const toggleTodoCompleteSchema = z.object({
  completed: z.boolean().meta({ description: "완료 상태 (true: 완료, false: 미완료)" }),
});

export const updateTodoVisibilitySchema = z.object({
  visibility: todoVisibilitySchema.meta({
    description: "공개 범위 (PUBLIC: 전체 공개, PRIVATE: 비공개)",
  }),
});

export const changeTodoCategorySchema = z.object({
  categoryId: z
    .int()
    .positive("유효하지 않은 카테고리 ID입니다")
    .meta({ description: "변경할 카테고리 ID (양의 정수, 예: 1)" }),
});

export const updateTodoScheduleSchema = z
  .object({
    startDate: z.iso
      .date("유효한 날짜 형식이 아닙니다")
      .meta({ description: "시작 날짜 (YYYY-MM-DD, 예: 2025-01-15)" }),
    endDate: z.iso
      .date("유효한 날짜 형식이 아닙니다")
      .nullable()
      .optional()
      .meta({ description: "종료 날짜 (YYYY-MM-DD, 단일 날짜는 null, 예: 2025-01-31)" }),
    scheduledTime: timeOfDaySchema
      .nullable()
      .optional()
      .meta({ description: "예정 시간 (HH:mm 24시간 형식, 종일 일정은 null, 예: 15:30)" }),
    isAllDay: z
      .boolean()
      .optional()
      .meta({ description: "종일 일정 여부 (true: 종일, false: 시간 지정, 기본값: false)" }),
  })
  .refine(
    (data) => {
      if (data.endDate && data.startDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      error: "종료 날짜는 시작 날짜 이후여야 합니다",
      path: ["endDate"],
    },
  );

export const updateTodoTitleSchema = z.object({
  title: z
    .string()
    .min(1, "제목을 입력해주세요")
    .max(TODO_LIMITS.TITLE_MAX_LENGTH, "제목은 200자 이하로 입력해주세요")
    .meta({ description: "할 일 제목 (1-200자)" }),
});

export const reorderTodoSchema = z.object({
  targetTodoId: z
    .int()
    .positive("유효하지 않은 Todo ID입니다")
    .optional()
    .meta({ description: "기준 할 일 ID (선택, 생략 시 맨 앞/뒤로 이동, 예: 123)" }),
  position: reorderPositionSchema.meta({
    description: "이동 위치 (before: 기준 앞으로, after: 기준 뒤로)",
  }),
});

export const createRecurringTodoSchema = z
  .object({
    title: z
      .string()
      .min(1, "제목을 입력해주세요")
      .max(TODO_LIMITS.TITLE_MAX_LENGTH, "제목은 200자 이하로 입력해주세요")
      .meta({ description: "할 일 제목 (1-200자, 예: 약먹기)" }),
    categoryId: z
      .int()
      .positive("유효하지 않은 카테고리 ID입니다")
      .meta({ description: "카테고리 ID (양의 정수)" }),
    startDate: z.iso
      .date("유효한 날짜 형식이 아닙니다")
      .meta({ description: "반복 시작 날짜 (YYYY-MM-DD, 예: 2026-03-01)" }),
    endDate: z.iso
      .date("유효한 날짜 형식이 아닙니다")
      .meta({ description: "반복 종료 날짜 (YYYY-MM-DD, 예: 2026-03-31)" }),
    daysOfWeek: z
      .array(dayOfWeekSchema)
      .min(1, "요일을 최소 1개 선택해주세요")
      .max(7, "요일은 최대 7개까지 선택할 수 있습니다")
      .meta({ description: "반복할 요일 (MON/TUE/WED/THU/FRI/SAT/SUN)" }),
    scheduledTime: timeOfDaySchema.nullish().meta({ description: "예정 시간 (HH:mm, 선택)" }),
    isAllDay: z.boolean().default(true).meta({ description: "종일 일정 여부 (기본값: true)" }),
    visibility: todoVisibilitySchema
      .default("PUBLIC")
      .meta({ description: "공개 범위 (PUBLIC/PRIVATE, 기본값: PUBLIC)" }),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    error: "종료 날짜는 시작 날짜 이후여야 합니다",
    path: ["endDate"],
  })
  .refine(
    (data) => {
      const diffDays = Math.ceil(
        (new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return diffDays <= RECURRING_TODO_LIMITS.MAX_DAYS_RANGE;
    },
    {
      error: `날짜 범위는 최대 ${RECURRING_TODO_LIMITS.MAX_DAYS_RANGE}일입니다`,
      path: ["endDate"],
    },
  );

export const todoResourceLimitQuerySchema = z.object({
  categoryId: z.coerce
    .number()
    .int()
    .positive("유효하지 않은 카테고리 ID입니다")
    .optional()
    .meta({ description: "카테고리 ID (지정 시 해당 카테고리의 activeCount도 반환)" }),
});

export const getTodoSummaryQuerySchema = z.object({
  date: dateSchema.optional().meta({
    description:
      "조회할 날짜 (선택, YYYY-MM-DD, 생략하면 X-Timezone 기준 오늘, 위젯의 내일 미리 받기용)",
  }),
});

export const createTodoItemSchema = z.object({
  title: z
    .string()
    .min(1, "제목을 입력해주세요")
    .max(TODO_LIMITS.TITLE_MAX_LENGTH, "제목은 200자 이하로 입력해주세요")
    .meta({ description: "하위 항목 제목 (1-200자)" }),
});

export type CreateTodoItemInput = z.infer<typeof createTodoItemSchema>;

export const updateTodoItemSchema = z
  .object({
    title: z
      .string()
      .min(1, "제목을 입력해주세요")
      .max(TODO_LIMITS.TITLE_MAX_LENGTH, "제목은 200자 이하로 입력해주세요")
      .optional()
      .meta({ description: "하위 항목 제목 (선택)" }),
    completed: z.boolean().optional().meta({ description: "완료 상태 (선택)" }),
  })
  .refine((data) => data.title != null || data.completed != null, {
    error: "제목 또는 완료 상태 중 하나는 입력해야 합니다",
  });

export type UpdateTodoItemInput = z.infer<typeof updateTodoItemSchema>;

export const reorderTodoItemsSchema = z.object({
  itemIds: z
    .array(z.int().positive())
    .min(1, "아이템 ID를 하나 이상 입력해주세요")
    .meta({ description: "새로운 순서대로 정렬된 하위 항목 ID 배열" }),
});

export type ReorderTodoItemsInput = z.infer<typeof reorderTodoItemsSchema>;

export const todoItemIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive("유효하지 않은 Todo ID입니다")
    .meta({ description: "부모 할 일 ID" }),
  itemId: z.coerce
    .number()
    .int()
    .positive("유효하지 않은 Item ID입니다")
    .meta({ description: "하위 항목 ID" }),
});
