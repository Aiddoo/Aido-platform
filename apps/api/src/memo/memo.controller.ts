import { ErrorCode } from "@aido/errors";
import { MEMO_LIMITS } from "@aido/validators";
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { parseDateOnly } from "@/shared/domain/date/utils/parse";
import { parseLocalDateTime } from "@/shared/domain/date/utils/timezone";
import { Timezone } from "@/shared/presentation/decorators";

import {
	ApiBadRequestError,
	ApiCreatedResponse,
	ApiDoc,
	ApiForbiddenError,
	ApiNotFoundError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/shared/presentation/swagger";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators";

import {
	ConvertMemoToTodoDto,
	ConvertMemoToTodoResponseDto,
	ConvertMemoToTodosDto,
	ConvertMemoToTodosResponseDto,
	CreateMemoDto,
	GetMemosQueryDto,
	MemoDeleteResponseDto,
	MemoDetailResponseDto,
	MemoIdParamDto,
	MemoListResponseDto,
	MemoMutationResponseDto,
	MemoResourceLimitResponseDto,
	ReorderMemoDto,
	ToggleMemoPinDto,
	UpdateMemoDto,
} from "./dtos";
import { MemoService } from "./memo.service";

@ApiTags(SWAGGER_TAGS.MEMOS)
@ApiBearerAuth()
@Controller("memos")
export class MemoController {
	constructor(private readonly memoService: MemoService) {}

	@Get("resource-limit")
	@ApiDoc({
		summary: "메모 리소스 제한 정보 조회",
		operationId: "getMemoResourceLimit",
		description: `사용자의 현재 메모 개수와 최대 한도를 조회합니다.

**응답 필드**
- \`currentCount\`: 현재 메모 개수
- \`maxPerUser\`: 사용자당 최대 메모 수 (${MEMO_LIMITS.MAX_PER_USER}개)`,
	})
	@ApiSuccessResponse({ type: MemoResourceLimitResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getResourceLimit(
		@CurrentUser() user: CurrentUserPayload,
	): Promise<MemoResourceLimitResponseDto> {
		return this.memoService.getResourceLimitInfo(user.userId);
	}

	@Post()
	@ApiDoc({
		summary: "메모 생성",
		operationId: "createMemo",
		description: `새로운 메모를 생성합니다.

**필수 필드**
- \`content\`: 메모 내용 (1-${MEMO_LIMITS.MAX_CONTENT_LENGTH}자)

### 제한사항

| 항목 | 제한 |
|------|------|
| 사용자당 최대 메모 | ${MEMO_LIMITS.MAX_PER_USER}개 |
| 메모 내용 길이 | 1-${MEMO_LIMITS.MAX_CONTENT_LENGTH}자 |`,
	})
	@ApiCreatedResponse({ type: MemoMutationResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	@ApiForbiddenError(ErrorCode.MEMO_2003)
	async create(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: CreateMemoDto,
	): Promise<MemoMutationResponseDto> {
		return this.memoService.create({
			userId: user.userId,
			content: dto.content,
		});
	}

	@Get()
	@ApiDoc({
		summary: "메모 목록 조회",
		operationId: "getMemos",
		description: `메모 목록을 조회합니다. 고정된 메모가 먼저 표시됩니다.

**정렬 순서**: 고정 여부(고정 우선) → 수동 순서(오름차순) → ID(오름차순)

**페이지네이션**: 커서 기반. \`pagination.nextCursor\`를 다음 요청의 \`cursor\`에 전달합니다.`,
	})
	@ApiSuccessResponse({ type: MemoListResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async findMany(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetMemosQueryDto,
	): Promise<MemoListResponseDto> {
		return this.memoService.findMany({
			userId: user.userId,
			cursor: query.cursor,
			size: query.size,
		});
	}

	@Get(":id")
	@ApiDoc({
		summary: "메모 상세 조회",
		operationId: "getMemo",
		description: "메모 ID로 단일 메모를 조회합니다.",
	})
	@ApiSuccessResponse({ type: MemoDetailResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.MEMO_2001)
	async findOne(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: MemoIdParamDto,
	): Promise<MemoDetailResponseDto> {
		return this.memoService.findOne(user.userId, params.id);
	}

	@Patch(":id")
	@ApiDoc({
		summary: "메모 수정",
		operationId: "updateMemo",
		description: "메모 내용을 수정합니다.",
	})
	@ApiSuccessResponse({ type: MemoMutationResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	@ApiNotFoundError(ErrorCode.MEMO_2001)
	async update(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: MemoIdParamDto,
		@Body() dto: UpdateMemoDto,
	): Promise<MemoMutationResponseDto> {
		return this.memoService.update(user.userId, params.id, {
			content: dto.content,
		});
	}

	@Patch(":id/pin")
	@ApiDoc({
		summary: "메모 고정/해제",
		operationId: "toggleMemoPin",
		description:
			"메모를 고정하거나 해제합니다. 고정된 메모는 목록 상단에 표시됩니다.",
	})
	@ApiSuccessResponse({ type: MemoMutationResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.MEMO_2001)
	async togglePin(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: MemoIdParamDto,
		@Body() dto: ToggleMemoPinDto,
	): Promise<MemoMutationResponseDto> {
		return this.memoService.togglePin(user.userId, params.id, dto.isPinned);
	}

	@Patch(":id/reorder")
	@ApiDoc({
		summary: "메모 순서 변경",
		operationId: "reorderMemo",
		description: `메모의 순서를 변경합니다.

- \`targetMemoId\`: 기준 메모 ID (생략 시 맨 앞/뒤로 이동)
- \`position\`: \`before\`(기준 앞) 또는 \`after\`(기준 뒤)`,
	})
	@ApiSuccessResponse({ type: MemoMutationResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.MEMO_2001)
	@ApiNotFoundError(ErrorCode.MEMO_2002)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async reorder(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: MemoIdParamDto,
		@Body() dto: ReorderMemoDto,
	): Promise<MemoMutationResponseDto> {
		return this.memoService.reorder(params.id, user.userId, {
			targetMemoId: dto.targetMemoId,
			position: dto.position,
		});
	}

	@Delete(":id")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "메모 삭제",
		operationId: "deleteMemo",
		description: "메모를 영구 삭제합니다.",
	})
	@ApiSuccessResponse({ type: MemoDeleteResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.MEMO_2001)
	async remove(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: MemoIdParamDto,
	): Promise<MemoDeleteResponseDto> {
		return this.memoService.delete(user.userId, params.id);
	}

	@Post(":id/convert-to-todo")
	@ApiHeader({
		name: "X-Timezone",
		required: false,
		description: "사용자 타임존 (IANA, 기본값: UTC)",
		example: "Asia/Seoul",
	})
	@ApiDoc({
		summary: "메모를 할 일로 변환",
		operationId: "convertMemoToTodo",
		description: `메모를 할 일로 변환합니다. 변환 후 원본 메모는 삭제됩니다.

**필수 필드**
- \`categoryId\`: 할 일 카테고리 ID
- \`startDate\`: 시작 날짜 (YYYY-MM-DD)

**선택 필드**
- \`endDate\`: 종료 날짜 (YYYY-MM-DD)
- \`scheduledTime\`: 예정 시간 (HH:mm). \`X-Timezone\` 헤더 기반으로 UTC 변환
- \`isAllDay\`: 종일 여부 (기본값: true)
- \`visibility\`: 공개 범위 (PUBLIC/PRIVATE, 기본값: PUBLIC)
- \`items\`: 하위 항목 배열 (선택, 최대 20개). 할 일과 함께 체크리스트를 일괄 생성합니다.

메모 내용이 할 일의 \`title\`(최대 200자)로 변환됩니다. 200자를 초과하면 잘립니다.`,
	})
	@ApiCreatedResponse({ type: ConvertMemoToTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.MEMO_2001)
	@ApiNotFoundError(ErrorCode.TODO_CATEGORY_0851)
	@ApiForbiddenError(ErrorCode.TODO_0811)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async convertToTodo(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: MemoIdParamDto,
		@Body() dto: ConvertMemoToTodoDto,
		@Timezone() tz: string,
	): Promise<ConvertMemoToTodoResponseDto> {
		return this.memoService.convertToTodo(user.userId, params.id, {
			categoryId: dto.categoryId,
			startDate: parseDateOnly(dto.startDate),
			endDate: dto.endDate ? parseDateOnly(dto.endDate) : undefined,
			scheduledTime: dto.scheduledTime
				? parseLocalDateTime(dto.startDate, dto.scheduledTime, tz)
				: undefined,
			isAllDay: dto.isAllDay,
			visibility: dto.visibility,
			items: dto.items,
		});
	}

	@Post(":id/convert-to-todos")
	@ApiHeader({
		name: "X-Timezone",
		required: false,
		description: "사용자 타임존 (IANA, 기본값: UTC)",
		example: "Asia/Seoul",
	})
	@ApiDoc({
		summary: "메모를 여러 할 일로 일괄 변환",
		operationId: "convertMemoToTodos",
		description: `메모를 AI 파싱 결과 기반으로 여러 할 일로 일괄 변환합니다.
변환 후 원본 메모는 삭제됩니다.

## 📱 클라이언트 통합 가이드
\`\`\`
1. POST /ai/parse-memo           → AI가 메모를 다중 Todo+SubTodo로 파싱
2. 사용자에게 결과 표시            → 검토/수정 기회 제공
3. POST /memos/:id/convert-to-todos → 이 엔드포인트로 일괄 생성
\`\`\`

## 📝 입력
- \`todos[]\`: 생성할 할 일 배열 (1-5개)
  - 각 todo: title, categoryId, startDate (필수) + endDate, scheduledTime, isAllDay, visibility, items (선택)
  - 반복 일정: isRecurring + recurrence (daysOfWeek, endDate)

## ⚡ 트랜잭션
- 모든 Todo가 순차 생성된 후 메모가 삭제됩니다.
- 중간에 실패 시 이미 생성된 Todo는 유지되고 메모도 유지됩니다.`,
	})
	@ApiCreatedResponse({ type: ConvertMemoToTodosResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.MEMO_2001)
	@ApiNotFoundError(ErrorCode.TODO_CATEGORY_0851)
	@ApiForbiddenError(ErrorCode.TODO_0811)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async convertToTodos(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: MemoIdParamDto,
		@Body() dto: ConvertMemoToTodosDto,
		@Timezone() tz: string,
	): Promise<ConvertMemoToTodosResponseDto> {
		return this.memoService.convertToTodos(
			user.userId,
			params.id,
			{
				todos: dto.todos.map((todo) => ({
					title: todo.title,
					categoryId: todo.categoryId,
					startDate: parseDateOnly(todo.startDate),
					endDate: todo.endDate ? parseDateOnly(todo.endDate) : undefined,
					scheduledTime: todo.scheduledTime
						? parseLocalDateTime(todo.startDate, todo.scheduledTime, tz)
						: undefined,
					isAllDay: todo.isAllDay,
					visibility: todo.visibility,
					isRecurring: todo.isRecurring,
					recurrence: todo.recurrence
						? {
								daysOfWeek: todo.recurrence.daysOfWeek,
								endDate: parseDateOnly(todo.recurrence.endDate),
							}
						: undefined,
					items: todo.items,
				})),
			},
			tz,
		);
	}
}
