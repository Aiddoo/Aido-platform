import { z } from "zod";

import {
  datetimeSchema,
  nullableDateSchema,
  nullableDatetimeSchema,
  timeOfDaySchema,
} from "../../../common/datetime.js";
import { entityIdSchema } from "../../../common/entity-id.js";
import { cursorPageSchema } from "../../../common/pagination.js";
import {
  TODAY_SUMMARY_TOP_TODOS_MAX,
  TODO_SERIES_LIMITS,
} from "../../../vocabulary/todo.constants.js";
import { todoCategorySummarySchema } from "../../todo-category/v1/todo-category.response.js";
import { todoSeriesResponseSchema } from "./todo-series.response.js";
import { todoRepeatSchema, todoVisibilitySchema } from "./todo.common.js";

export const todoItemResponseSchema = z.object({
  id: z.int().meta({ description: "하위 항목 고유 ID" }),
  title: z.string().meta({ description: "하위 항목 제목" }),
  completed: z.boolean().meta({ description: "완료 상태" }),
  sortOrder: z.int().meta({ description: "정렬 순서 (작을수록 위)" }),
  createdAt: datetimeSchema.meta({ description: "생성 시각 (ISO 8601 UTC)" }),
  updatedAt: datetimeSchema.meta({ description: "수정 시각 (ISO 8601 UTC)" }),
});

export type TodoItemResponse = z.infer<typeof todoItemResponseSchema>;

export const todoItemStatsSchema = z.object({
  total: z.int().meta({ description: "전체 하위 항목 수" }),
  completed: z.int().meta({ description: "완료된 하위 항목 수" }),
});

const todoExample = {
  id: 1,
  userId: "clz7x5p8k0010qz0z8z8z8z8z",
  title: "운동하기",
  sortOrder: 0,
  completed: false,
  completedAt: null,
  startDate: "2024-01-15",
  endDate: "2024-01-15",
  scheduledTime: "2024-01-15T09:00:00.000Z",
  scheduledLocalTime: "18:00",
  isAllDay: false,
  visibility: "PUBLIC",
  recurrenceGroupId: null,
  category: {
    id: 1,
    name: "중요한 일",
    color: "#FFB3B3",
    sortOrder: 0,
  },
  items: [],
  itemStats: { total: 0, completed: 0 },
  commentCount: 0,
  createdAt: "2024-01-10T12:00:00.000Z",
  updatedAt: "2024-01-10T12:00:00.000Z",
};

export const todoSchema = z
  .object({
    id: z.int().meta({ description: "할 일 고유 ID (양의 정수)" }),
    userId: entityIdSchema.meta({ description: "사용자 ID" }),
    title: z.string().meta({ description: "할 일 제목" }),
    content: z
      .string()
      .nullable()
      .optional()
      .meta({ description: "할 일 내용 (deprecated, 하위 호환용 — 항상 null)" }),
    sortOrder: z.int().meta({ description: "정렬 순서 (작을수록 위)" }),
    completed: z.boolean().meta({ description: "완료 상태" }),
    completedAt: nullableDatetimeSchema.meta({
      description: "완료 시각 (ISO 8601 UTC, 예: 2024-01-15T10:30:00.000Z, 미완료 시 null)",
    }),
    startDate: z.string().meta({ description: "시작 날짜 (YYYY-MM-DD, 예: 2024-01-15)" }),
    endDate: z
      .string()
      .nullable()
      .meta({ description: "종료 날짜 (YYYY-MM-DD, 예: 2024-01-31, 단일 날짜는 null)" }),
    scheduledTime: nullableDatetimeSchema.meta({
      description:
        "예정 시각 (ISO 8601 UTC, 예: 2024-01-15T09:00:00.000Z, 종일 일정은 null). 날짜 + 벽시계 + 사용자 시간대의 파생값이라 시간대가 바뀌면 다시 계산된다",
    }),
    scheduledLocalTime: timeOfDaySchema.nullable().optional().meta({
      description:
        "사용자가 고른 벽시계 시각 (HH:mm). 어디서든 이 시각으로 보여 준다. 종일 일정은 null, 구버전 서버 응답에는 키가 없다",
    }),
    isAllDay: z.boolean().meta({ description: "종일 일정 여부" }),
    visibility: todoVisibilitySchema.meta({
      description: "공개 범위 (PUBLIC | FRIENDS | PRIVATE)",
    }),
    recurrenceGroupId: z
      .string()
      .nullable()
      .meta({ description: "반복 생성 그룹 ID (null이면 단일 생성)" }),
    repeat: todoRepeatSchema.nullable().optional().meta({
      description:
        "소유자에게만 주는 반복 규칙 (단일 할 일·규칙이 없는 옛 묶음은 null, 끝난 규칙도 그대로 준다. 구버전 서버 응답에는 키가 없다)",
    }),
    occurrenceDate: nullableDateSchema.optional().meta({
      description:
        "소유자에게만 주는 반복 회차의 원래 날짜 (YYYY-MM-DD, 다른 날로 옮겨도 변하지 않는다. 단일 할 일은 null, 구버전 서버 응답에는 키가 없다)",
    }),
    category: todoCategorySummarySchema.meta({ description: "카테고리 정보" }),
    items: z
      .array(todoItemResponseSchema)
      .meta({ description: "하위 항목 목록 (체크리스트, sortOrder 오름차순)" }),
    itemStats: todoItemStatsSchema.meta({
      description: "하위 항목 진행 통계 (카운터 뱃지/진행률 바용)",
    }),
    commentCount: z
      .int()
      .nonnegative()
      .meta({ description: "댓글 수 (삭제된 댓글 제외 — 목록 진입점 뱃지용)" }),
    createdAt: datetimeSchema.meta({
      description: "생성 시각 (ISO 8601 UTC, 예: 2024-01-10T12:00:00.000Z)",
    }),
    updatedAt: datetimeSchema.meta({
      description: "수정 시각 (ISO 8601 UTC, 예: 2024-01-15T10:30:00.000Z)",
    }),
  })
  .meta({ example: todoExample });

export type Todo = z.infer<typeof todoSchema>;

export const friendTodoSchema = todoSchema
  .omit({ repeat: true, occurrenceDate: true })
  .meta({ example: todoExample });

export type FriendTodo = z.infer<typeof friendTodoSchema>;

export const todoListResponseSchema = cursorPageSchema(todoSchema, z.int()).meta({
  example: {
    items: [
      {
        id: 1,
        userId: "clz7x5p8k0010qz0z8z8z8z8z",
        title: "운동하기",
        sortOrder: 0,
        completed: false,
        completedAt: null,
        startDate: "2024-01-15",
        endDate: "2024-01-15",
        scheduledTime: "2024-01-15T09:00:00.000Z",
        isAllDay: false,
        visibility: "PUBLIC",
        category: {
          id: 1,
          name: "중요한 일",
          color: "#FFB3B3",
          sortOrder: 0,
        },
        createdAt: "2024-01-10T12:00:00.000Z",
        updatedAt: "2024-01-10T12:00:00.000Z",
      },
    ],
    pagination: {
      nextCursor: 2,
      hasNext: true,
      size: 20,
    },
  },
});

export type TodoListResponse = z.infer<typeof todoListResponseSchema>;

export const friendTodoListResponseSchema = cursorPageSchema(friendTodoSchema, z.int());

export type FriendTodoListResponse = z.infer<typeof friendTodoListResponseSchema>;

export const createTodoResponseSchema = z
  .object({
    message: z.string(),
    todo: todoSchema,
    series: todoSeriesResponseSchema
      .optional()
      .meta({ description: "repeat로 만들면 반복 규칙, 이때 todo는 첫 회차. 단일 할 일은 없다" }),
  })
  .meta({
    example: {
      message: "할 일이 생성되었습니다.",
      todo: {
        id: 1,
        userId: "clz7x5p8k0010qz0z8z8z8z8z",
        title: "운동하기",
        sortOrder: 0,
        completed: false,
        completedAt: null,
        startDate: "2024-01-15",
        endDate: "2024-01-15",
        scheduledTime: "2024-01-15T09:00:00.000Z",
        isAllDay: false,
        visibility: "PUBLIC",
        category: {
          id: 1,
          name: "중요한 일",
          color: "#FFB3B3",
          sortOrder: 0,
        },
        createdAt: "2024-01-10T12:00:00.000Z",
        updatedAt: "2024-01-10T12:00:00.000Z",
      },
    },
  });

export const updateTodoResponseSchema = z
  .object({
    message: z.string(),
    todo: todoSchema,
  })
  .meta({
    example: {
      message: "할 일이 수정되었습니다.",
      todo: {
        id: 1,
        userId: "clz7x5p8k0010qz0z8z8z8z8z",
        title: "운동하기 (수정됨)",
        sortOrder: 0,
        completed: true,
        completedAt: "2024-01-15T10:30:00.000Z",
        startDate: "2024-01-15",
        endDate: "2024-01-15",
        scheduledTime: "2024-01-15T09:00:00.000Z",
        isAllDay: false,
        visibility: "PUBLIC",
        category: {
          id: 1,
          name: "중요한 일",
          color: "#FFB3B3",
          sortOrder: 0,
        },
        createdAt: "2024-01-10T12:00:00.000Z",
        updatedAt: "2024-01-15T10:30:00.000Z",
      },
    },
  });

export const deleteTodoResponseSchema = z
  .object({
    message: z.string(),
  })
  .meta({
    example: {
      message: "할 일이 삭제되었습니다.",
    },
  });

export const reorderTodoResponseSchema = z
  .object({
    message: z.string(),
    todo: todoSchema,
  })
  .meta({
    example: {
      message: "할 일 순서가 변경되었습니다.",
      todo: {
        id: 3,
        userId: "clz7x5p8k0010qz0z8z8z8z8z",
        title: "회의 준비",
        sortOrder: 1,
        completed: false,
        completedAt: null,
        startDate: "2024-01-15",
        endDate: null,
        scheduledTime: null,
        isAllDay: true,
        visibility: "PUBLIC",
        category: {
          id: 1,
          name: "중요한 일",
          color: "#FFB3B3",
          sortOrder: 0,
        },
        createdAt: "2024-01-10T12:00:00.000Z",
        updatedAt: "2024-01-15T10:30:00.000Z",
      },
    },
  });

export const createRecurringTodoResponseSchema = z
  .object({
    message: z.string(),
    todos: z.array(todoSchema),
    count: z.int().meta({ description: "생성된 반복 할 일 수" }),
  })
  .meta({
    example: {
      message: "반복 할 일이 13개 생성되었습니다.",
      todos: [],
      count: 13,
    },
  });

export const todoResourceLimitResponseSchema = z
  .object({
    maxPerCategory: z.int().meta({ description: "카테고리당 최대 활성 할 일 수" }),
    activeCount: z
      .int()
      .optional()
      .meta({ description: "해당 카테고리의 현재 활성 할 일 개수 (categoryId 지정 시)" }),
  })
  .meta({
    example: {
      maxPerCategory: 300,
      activeCount: 15,
    },
  });

export const todoSummaryTodoSchema = z.object({
  id: z.int().meta({ description: "할 일 고유 ID (양의 정수)" }),
  title: z.string().meta({ description: "할 일 제목" }),
  completed: z.boolean().meta({ description: "완료 상태" }),
  categoryColor: z
    .string()
    .meta({ description: "카테고리 색상 (HEX, 예: #FFB3B3 — 위젯 체크박스 컬러)" }),
});

export const todoSummaryResponseSchema = z
  .object({
    date: z
      .string()
      .meta({ description: "조회 기준 날짜 (YYYY-MM-DD, X-Timezone 헤더의 로컬 날짜)" }),
    totalTodos: z.int().min(0).meta({ description: "오늘 전체 할 일 개수 (0 이상)" }),
    completedTodos: z.int().min(0).meta({ description: "오늘 완료한 할 일 개수 (0 이상)" }),
    completionRate: z
      .number()
      .min(0)
      .max(100)
      .meta({ description: "완료율 (0-100%, daily-completion과 동일 규칙, 할 일 없으면 0)" }),
    isComplete: z.boolean().meta({ description: "100% 달성 여부 (totalTodos > 0 && 전부 완료)" }),
    currentStreak: z.int().min(0).meta({ description: "현재 연속 달성 일수 (0 이상)" }),
    topTodos: z.array(todoSummaryTodoSchema).max(TODAY_SUMMARY_TOP_TODOS_MAX).meta({
      description:
        "오늘 할 일 상위 목록 (미완료 우선, 이후 카테고리/정렬 순 — 최대 10개, 홈 위젯 표시용)",
    }),
  })
  .meta({
    example: {
      date: "2026-07-12",
      totalTodos: 5,
      completedTodos: 3,
      completionRate: 60,
      isComplete: false,
      currentStreak: 12,
      topTodos: [
        { id: 1, title: "운동하기", completed: true, categoryColor: "#B3E5C1" },
        { id: 2, title: "회의 자료 준비", completed: false, categoryColor: "#FFB3B3" },
      ],
    },
  });

export type TodoSummaryResponse = z.infer<typeof todoSummaryResponseSchema>;

export const todoOverviewResponseSchema = z
  .object({
    hasTodo: z.boolean().meta({
      description: "할 일이 하나라도 있는지 (날짜·완료 여부와 무관, 지운 할 일은 세지 않음)",
    }),
    hasCompletedTodo: z
      .boolean()
      .meta({ description: "완료한 할 일이 하나라도 있는지 (날짜와 무관, 완료를 풀면 세지 않음)" }),
    hasActiveRepeat: z.boolean().meta({
      description: `진행 중인 반복이 하나라도 있는지. 앞으로 만들 회차가 남은 반복 규칙을 센다(진행 중 반복 상한과 같은 기준). 그만뒀거나 남은 회차를 이미 모두 만든 규칙(종료일·횟수가 미리 만드는 ${TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS}일 안에서 끝남)은 세지 않고, 오래 앱을 열지 않아 멈춘(휴면) 규칙은 끝난 것이 아니라 센다`,
    }),
  })
  .meta({
    example: {
      hasTodo: true,
      hasCompletedTodo: false,
      hasActiveRepeat: true,
    },
  });

export type TodoOverviewResponse = z.infer<typeof todoOverviewResponseSchema>;
