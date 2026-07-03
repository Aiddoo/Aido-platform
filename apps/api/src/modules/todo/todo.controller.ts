import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { TODO_ITEM_LIMITS } from "@aido/validators";
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
	Param,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiHeader, ApiQuery, ApiTags } from "@nestjs/swagger";
import { parseDateOnly } from "@/common/date/utils/parse";
import { parseLocalDateTime } from "@/common/date/utils/timezone";
import { Timezone } from "@/common/decorators";

import {
	ApiBadRequestError,
	ApiCreatedResponse,
	ApiDoc,
	ApiForbiddenError,
	ApiNotFoundError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/common/swagger";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators";
import { UserIdParamDto } from "../follow/dtos";
import { GetFriendTodosQuery } from "./application/queries/get-friend-todos.query";
import { GetTodoByIdQuery } from "./application/queries/get-todo-by-id.query";
import { GetTodoResourceLimitQuery } from "./application/queries/get-todo-resource-limit.query";
import { GetTodosQuery } from "./application/queries/get-todos.query";
import { CreateTodoCommand } from "./application/use-cases/create-todo/create-todo.command";
import { ToggleTodoCompleteCommand } from "./application/use-cases/toggle-todo-complete/toggle-todo-complete.command";
import { UpdateTodoCommand } from "./application/use-cases/update-todo/update-todo.command";
import { UpdateTodoScheduleCommand } from "./application/use-cases/update-todo-schedule/update-todo-schedule.command";
import { UpdateTodoTitleCommand } from "./application/use-cases/update-todo-title/update-todo-title.command";
import { UpdateTodoVisibilityCommand } from "./application/use-cases/update-todo-visibility/update-todo-visibility.command";
import {
	ChangeTodoCategoryDto,
	CreateRecurringTodoDto,
	CreateRecurringTodoResponseDto,
	CreateTodoDto,
	CreateTodoItemDto,
	CreateTodoResponseDto,
	DeleteTodoResponseDto,
	GetFriendTodosQueryDto,
	GetTodosQueryDto,
	ReorderTodoDto,
	ReorderTodoItemsDto,
	ReorderTodoResponseDto,
	TodoIdParamDto,
	TodoItemIdParamDto,
	TodoListResponseDto,
	TodoResourceLimitQueryDto,
	TodoResourceLimitResponseDto,
	TodoResponseDto,
	ToggleTodoCompleteDto,
	UpdateTodoDto,
	UpdateTodoItemDto,
	UpdateTodoResponseDto,
	UpdateTodoScheduleDto,
	UpdateTodoTitleDto,
	UpdateTodoVisibilityDto,
} from "./dtos";
import { TodoService } from "./todo.service";

@ApiTags(SWAGGER_TAGS.TODOS)
@ApiBearerAuth()
@Controller("todos")
export class TodoController {
	readonly #logger = new Logger(TodoController.name);

	constructor(
		private readonly todoService: TodoService,
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@Get("resource-limit")
	@ApiDoc({
		summary: "카테고리당 활성 할 일 리소스 제한 정보 조회",
		operationId: "getTodoResourceLimit",
		description: `카테고리당 활성(미완료) 할 일 최대 한도를 조회합니다.
categoryId를 지정하면 해당 카테고리의 현재 활성 할 일 개수도 함께 반환합니다.

**응답 필드**
- \`maxPerCategory\`: 카테고리당 최대 활성 할 일 수 (모든 구독 동일, ADMIN은 무제한)
- \`activeCount\`: 해당 카테고리의 현재 활성 할 일 개수 (categoryId 지정 시)`,
	})
	@ApiSuccessResponse({ type: TodoResourceLimitResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getResourceLimit(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: TodoResourceLimitQueryDto,
	): Promise<TodoResourceLimitResponseDto> {
		return this.queryBus.execute(
			new GetTodoResourceLimitQuery(user.userId, query.categoryId),
		);
	}

	@Post()
	@ApiHeader({
		name: "X-Timezone",
		required: false,
		description: "사용자 타임존 (IANA, 기본값: UTC)",
		example: "Asia/Seoul",
	})
	@ApiDoc({
		summary: "할 일 생성",
		operationId: "createTodo",
		description: `새로운 할 일을 생성합니다.

**필수 필드**
- \`title\`: 할 일 제목 (1-200자)
- \`categoryId\`: 카테고리 ID
- \`startDate\`: 시작 날짜 (YYYY-MM-DD)

**선택 필드**
- \`endDate\`: 종료 날짜 (YYYY-MM-DD)
- \`scheduledTime\`: 예정 시간 (HH:mm, 24시간 형식). \`X-Timezone\` 헤더 기반으로 UTC 변환되어 저장됩니다.
- \`isAllDay\`: 종일 여부 (기본값: true)
- \`visibility\`: 공개 범위 (PUBLIC/PRIVATE, 기본값: PUBLIC)
- \`items\`: 하위 항목 배열 (선택, 최대 ${TODO_ITEM_LIMITS.MAX_PER_TODO}개). 투두와 함께 체크리스트를 일괄 생성합니다.

---

### 하위 항목 (체크리스트)

\`items\` 배열을 전달하면 투두 생성과 동시에 체크리스트가 생성됩니다.
각 항목은 \`{ title: string }\` 형태이며, 배열 순서가 \`sortOrder\`로 지정됩니다.

### 제한사항

| 항목 | 제한 |
|------|------|
| 카테고리당 활성(미완료) 할 일 | 최대 300개 |
| 투두당 하위 항목 | 최대 ${TODO_ITEM_LIMITS.MAX_PER_TODO}개 |
| 하위 항목 제목 | 1-200자 |

### 응답의 items / itemStats 필드

모든 할 일 응답에 다음 필드가 포함됩니다:
- \`items\`: 하위 항목 배열 (\`sortOrder\` 오름차순, 없으면 빈 배열 \`[]\`)
- \`itemStats.total\`: 전체 하위 항목 수
- \`itemStats.completed\`: 완료된 하위 항목 수

클라이언트 활용:
- **카운터 뱃지**: \`itemStats.completed\` / \`itemStats.total\` (예: 1/3)
- **진행률 바**: \`itemStats.completed / itemStats.total * 100\` (예: 33%)
- **펼침/접힘 토글**: \`itemStats.total > 0\`이면 토글 버튼 표시`,
	})
	@ApiCreatedResponse({ type: CreateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	@ApiNotFoundError(ErrorCode.TODO_CATEGORY_0851)
	@ApiForbiddenError(ErrorCode.TODO_0811)
	async create(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: CreateTodoDto,
		@Timezone() tz: string,
	): Promise<CreateTodoResponseDto> {
		this.#logger.debug(`Todo 생성: user=${user.userId}, title=${dto.title}`);

		const todo = await this.commandBus.execute<CreateTodoCommand, TodoResponse>(
			new CreateTodoCommand({
				userId: user.userId,
				title: dto.title,
				categoryId: dto.categoryId,
				startDate: parseDateOnly(dto.startDate),
				endDate: dto.endDate ? parseDateOnly(dto.endDate) : undefined,
				scheduledTime: dto.scheduledTime
					? this.#parseScheduledTime(dto.startDate, dto.scheduledTime, tz)
					: undefined,
				isAllDay: dto.isAllDay,
				visibility: dto.visibility,
				items: dto.items,
			}),
		);

		this.#logger.log(`Todo 생성 완료: id=${todo.id}, user=${user.userId}`);

		return {
			message: "할 일이 생성되었습니다.",
			todo,
		};
	}

	@Post("recurring")
	@ApiHeader({
		name: "X-Timezone",
		required: false,
		description: "사용자 타임존 (IANA, 기본값: UTC)",
		example: "Asia/Seoul",
	})
	@ApiDoc({
		summary: "반복 할 일 생성",
		operationId: "createRecurringTodo",
		description: `날짜 범위와 요일 조합에 따라 여러 개의 독립적인 할 일을 일괄 생성합니다.

**필수 필드**
- \`title\`: 할 일 제목 (1-200자)
- \`categoryId\`: 카테고리 ID
- \`startDate\`: 반복 시작 날짜 (YYYY-MM-DD)
- \`endDate\`: 반복 종료 날짜 (YYYY-MM-DD)
- \`daysOfWeek\`: 반복할 요일 배열 (MON/TUE/WED/THU/FRI/SAT/SUN)

**예시**: 3월 1일~31일, 매주 월/수/금 → 약 13개의 독립 할 일 생성

**제한사항**
- 한 번에 최대 100개까지 생성 가능
- 활성(미완료) 할 일 한도를 초과하면 전체 요청 거부`,
	})
	@ApiCreatedResponse({ type: CreateRecurringTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	@ApiBadRequestError(ErrorCode.TODO_0812)
	@ApiForbiddenError(ErrorCode.TODO_0813)
	@ApiNotFoundError(ErrorCode.TODO_CATEGORY_0851)
	async createRecurring(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: CreateRecurringTodoDto,
		@Timezone() tz: string,
	): Promise<CreateRecurringTodoResponseDto> {
		this.#logger.debug(
			`반복 Todo 생성: user=${user.userId}, title=${dto.title}, range=${dto.startDate}~${dto.endDate}, days=${dto.daysOfWeek.join(",")}`,
		);

		const result = await this.todoService.createRecurring(
			{
				userId: user.userId,
				title: dto.title,
				categoryId: dto.categoryId,
				startDate: dto.startDate,
				endDate: dto.endDate,
				daysOfWeek: dto.daysOfWeek,
				scheduledTime: dto.scheduledTime,
				isAllDay: dto.isAllDay,
				visibility: dto.visibility,
			},
			tz,
		);

		this.#logger.log(
			`반복 Todo 생성 완료: ${result.count}개, user=${user.userId}`,
		);

		return {
			message: `반복 할 일이 ${result.count}개 생성되었습니다.`,
			todos: result.todos,
			count: result.count,
		};
	}

	@Get()
	@ApiDoc({
		summary: "할 일 목록 조회",
		operationId: "getTodos",
		description: `사용자의 할 일 목록을 커서 기반 페이지네이션으로 조회합니다.

**쿼리 파라미터**
- \`cursor\`: 페이지네이션 커서
- \`size\`: 페이지 크기 (1-200, 기본값: 20)
- \`completed\`: 완료 상태 필터
- \`categoryId\`: 카테고리 ID 필터
- \`startDate\`: 시작일 필터 (YYYY-MM-DD)
- \`endDate\`: 종료일 필터 (YYYY-MM-DD)

---

### 정렬 (Sort Order)

응답 데이터는 다음 기준으로 정렬됩니다:

1. \`category.sortOrder\` ASC — 카테고리 순서
2. \`todo.sortOrder\` ASC — 카테고리 내 할 일 순서
3. \`todo.id\` ASC — 동일 순서 시 ID 기준 안정 정렬

이 정렬 덕분에 데이터가 카테고리 순서대로 연속으로 반환되므로,
클라이언트에서 \`Map.groupBy(todos, (t) => t.category.id)\`로 그룹핑하면
카테고리별 할 일 목록을 구성할 수 있습니다.

\`categoryId\` 파라미터 없이 호출하면 모든 카테고리의 할 일이 카테고리 순서대로 반환됩니다.
\`categoryId\`를 지정하면 해당 카테고리의 할 일만 반환됩니다.

**카테고리 정보**: 각 할 일의 \`category\` 객체에 \`sortOrder\` 필드가 포함되어 있어
클라이언트 그룹핑 시 정렬 키로 활용할 수 있습니다.

---

### 날짜 필터링 (Overlapping Intervals)

날짜 필터는 **DATE(날짜) 기준**으로 동작합니다. 타임존 변환이 적용되지 않는 floating date입니다.

#### 사용 시나리오

| startDate | endDate | 결과 |
|-----------|---------|------|
| 미지정 | 미지정 | 전체 할 일 반환 |
| 2026-01-15 | 2026-01-15 | **특정 날짜**에 해당하는 할 일 (단일 날짜 조회) |
| 2026-01-01 | 2026-01-31 | **기간 범위**에 걸쳐 있는 할 일 (월간/주간 뷰) |
| 2026-01-15 | 미지정 | **해당 날짜**에 해당하는 할 일 (exact match) |
| 미지정 | 2026-01-31 | **해당 날짜**에 해당하는 할 일 (exact match) |

#### 필터링 로직 상세

- **다일(multi-day) 할 일**: \`todo.startDate <= endDate\` AND \`todo.endDate >= startDate\`
- **단일 날짜 할 일** (endDate가 없는 경우): \`todo.startDate\`가 필터 범위 내에 있는지 확인

#### 시간 처리 (scheduledTime)

- **종일 이벤트** (\`isAllDay=true\`): \`scheduledTime\`은 null
- **시간 이벤트** (\`isAllDay=false\`): \`scheduledTime\`은 UTC ISO 8601 형식
  - 생성/수정 시 \`X-Timezone\` 헤더 기반으로 로컬→UTC 변환하여 저장
  - 응답은 UTC로 반환, 클라이언트에서 로컬 시간으로 표시

#### 에러 케이스

| 케이스 | 응답 |
|--------|------|
| startDate가 endDate보다 이후 | \`400 Bad Request\` (SYS_0002) |
| 잘못된 날짜 형식 (예: 2026-13-01) | \`400 Bad Request\` (SYS_0002) |
| 유효하지 않은 날짜 (예: 2026-02-30) | \`400 Bad Request\` (SYS_0002) |

#### 예시

1. **2026-01-10에 시작하여 2026-01-20에 끝나는 할 일**이 있을 때:
   - \`startDate=2026-01-15&endDate=2026-01-15\` → ✅ 반환 (기간이 겹침)
   - \`startDate=2026-01-01&endDate=2026-01-05\` → ❌ 미반환 (기간이 겹치지 않음)
   - \`startDate=2026-01-25&endDate=2026-01-31\` → ❌ 미반환 (기간이 겹치지 않음)

2. **2026-01-15에만 해당하는 단일 날짜 할 일**이 있을 때:
   - \`startDate=2026-01-15&endDate=2026-01-15\` → ✅ 반환
   - \`startDate=2026-01-10&endDate=2026-01-20\` → ✅ 반환 (범위 내에 포함)
   - \`startDate=2026-01-16&endDate=2026-01-20\` → ❌ 미반환`,
	})
	@ApiQuery({
		name: "cursor",
		required: false,
		description:
			"페이지네이션 커서 (다음 페이지 요청 시 이전 응답의 nextCursor 값 사용)",
		schema: { type: "number" },
		example: 123,
	})
	@ApiQuery({
		name: "size",
		required: false,
		description: "페이지 크기 (1-200)",
		schema: { type: "number", minimum: 1, maximum: 200, default: 20 },
		example: 20,
	})
	@ApiQuery({
		name: "completed",
		required: false,
		description: "완료 상태 필터 (true: 완료만, false: 미완료만, 미지정: 전체)",
		schema: { type: "boolean" },
	})
	@ApiQuery({
		name: "categoryId",
		required: false,
		description: "카테고리 ID 필터 (특정 카테고리의 할 일만 조회)",
		schema: { type: "number" },
		example: 1,
	})
	@ApiQuery({
		name: "startDate",
		required: false,
		description:
			"시작일 (YYYY-MM-DD). 단독 사용 시 해당 날짜의 할 일만 반환합니다. endDate와 함께 사용 시 범위 조회합니다.",
		schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
		example: "2026-01-01",
	})
	@ApiQuery({
		name: "endDate",
		required: false,
		description:
			"종료일 (YYYY-MM-DD). 단독 사용 시 해당 날짜의 할 일만 반환합니다. startDate와 함께 사용 시 범위 조회합니다. startDate보다 이전 날짜를 지정하면 400 에러가 발생합니다.",
		schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
		example: "2026-01-31",
	})
	@ApiSuccessResponse({ type: TodoListResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async findMany(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetTodosQueryDto,
	): Promise<TodoListResponseDto> {
		this.#logger.debug(
			`Todo 목록 조회: user=${user.userId}, size=${query.size}, completed=${query.completed}`,
		);

		const result = await this.queryBus.execute(
			new GetTodosQuery({
				userId: user.userId,
				cursor: query.cursor,
				size: query.size,
				completed: query.completed,
				categoryId: query.categoryId,
				// DATE 타입 필드는 시간 정보가 없으므로 parseDateOnly 사용
				startDate: query.startDate ? parseDateOnly(query.startDate) : undefined,
				endDate: query.endDate ? parseDateOnly(query.endDate) : undefined,
			}),
		);

		return {
			items: result.items,
			pagination: result.pagination,
		};
	}

	@Get(":id")
	@ApiDoc({
		summary: "할 일 상세 조회",
		operationId: "getTodoById",
		description: `특정 할 일의 상세 정보를 조회합니다.

본인 소유의 할 일만 조회할 수 있습니다.`,
	})
	@ApiSuccessResponse({ type: TodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	async findById(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
	): Promise<TodoResponseDto> {
		this.#logger.debug(`Todo 상세 조회: id=${params.id}, user=${user.userId}`);

		return this.queryBus.execute<GetTodoByIdQuery, TodoResponse>(
			new GetTodoByIdQuery(params.id, user.userId),
		);
	}

	@Get("friends/:userId")
	@ApiDoc({
		summary: "친구의 할 일 목록 조회",
		operationId: "getFriendTodos",
		description: `친구의 공개(PUBLIC) 할 일 목록을 조회합니다.

맞팔 관계여야만 조회 가능하며, PRIVATE 할 일은 표시되지 않습니다.

**쿼리 파라미터**
- \`cursor\`: 페이지네이션 커서
- \`size\`: 페이지 크기 (1-200, 기본값: 20)
- \`startDate\`: 시작일 필터 (YYYY-MM-DD)
- \`endDate\`: 종료일 필터 (YYYY-MM-DD)

---

### 정렬

\`GET /todos\` API와 동일한 정렬 순서를 사용합니다:
\`category.sortOrder\` ASC → \`todo.sortOrder\` ASC → \`todo.id\` ASC

---

### 날짜 필터링

날짜 필터링은 \`GET /todos\` API와 동일한 Overlapping Intervals 로직을 사용합니다.
단일 날짜만 전달 시 해당 날짜의 할 일만 반환합니다 (exact match).
자세한 내용은 해당 API 문서를 참조하세요.

#### 에러 케이스

| 케이스 | 응답 |
|--------|------|
| 맞팔 관계가 아닌 경우 | \`403 Forbidden\` (FOLLOW_0906) |
| startDate가 endDate보다 이후 | \`400 Bad Request\` (SYS_0002) |
| 잘못된 날짜 형식 | \`400 Bad Request\` (SYS_0002) |`,
	})
	@ApiSuccessResponse({ type: TodoListResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiForbiddenError(ErrorCode.FOLLOW_0906)
	async findFriendTodos(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: UserIdParamDto,
		@Query() query: GetFriendTodosQueryDto,
	): Promise<TodoListResponseDto> {
		this.#logger.debug(
			`친구 Todo 목록 조회: friendUserId=${params.userId}, user=${user.userId}`,
		);

		const result = await this.queryBus.execute(
			new GetFriendTodosQuery({
				userId: user.userId,
				friendUserId: params.userId,
				cursor: query.cursor,
				size: query.size,
				// DATE 타입 필드는 시간 정보가 없으므로 parseDateOnly 사용
				startDate: query.startDate ? parseDateOnly(query.startDate) : undefined,
				endDate: query.endDate ? parseDateOnly(query.endDate) : undefined,
			}),
		);

		return {
			items: result.items,
			pagination: result.pagination,
		};
	}

	@Patch(":id")
	@HttpCode(HttpStatus.OK)
	@ApiHeader({
		name: "X-Timezone",
		required: false,
		description: "사용자 타임존 (IANA, 기본값: UTC)",
		example: "Asia/Seoul",
	})
	@ApiDoc({
		summary: "할 일 수정",
		operationId: "updateTodo",
		description: `할 일의 정보를 부분 수정합니다.

**수정 가능 필드**: title, categoryId, startDate, endDate, scheduledTime, isAllDay, visibility, completed`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiNotFoundError(ErrorCode.TODO_CATEGORY_0851)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async update(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: UpdateTodoDto,
		@Timezone() tz: string,
	): Promise<UpdateTodoResponseDto> {
		this.#logger.debug(`Todo 수정: id=${params.id}, user=${user.userId}`);

		const todo = await this.commandBus.execute<UpdateTodoCommand, TodoResponse>(
			new UpdateTodoCommand(params.id, user.userId, {
				title: dto.title,
				categoryId: dto.categoryId,
				startDate: dto.startDate ? parseDateOnly(dto.startDate) : undefined,
				endDate:
					dto.endDate === null
						? null
						: dto.endDate
							? parseDateOnly(dto.endDate)
							: undefined,
				scheduledTime:
					dto.scheduledTime === null
						? null
						: dto.scheduledTime && dto.startDate
							? this.#parseScheduledTime(dto.startDate, dto.scheduledTime, tz)
							: undefined,
				isAllDay: dto.isAllDay,
				visibility: dto.visibility,
				completed: dto.completed,
			}),
		);

		this.#logger.log(`Todo 수정 완료: id=${params.id}, user=${user.userId}`);

		return {
			message: "할 일이 수정되었습니다.",
			todo,
		};
	}

	@Patch(":id/complete")
	@HttpCode(HttpStatus.OK)
	@ApiHeader({
		name: "X-Timezone",
		required: false,
		description: "사용자 타임존 (IANA, 기본값: UTC)",
		example: "Asia/Seoul",
	})
	@ApiDoc({
		summary: "할 일 완료 상태 토글",
		operationId: "toggleTodoComplete",
		description: `할 일의 완료 상태를 변경합니다.

**요청 필드**: \`completed\` (boolean, 필수)

**하위 항목과의 관계**
- 부모 할 일의 완료/미완료는 하위 항목의 완료 상태에 **영향을 주지 않습니다**
- 하위 항목이 전부 완료(3/3)되어도 부모 할 일은 **자동 완료되지 않습니다**
- 부모 할 일의 완료 여부만 스트릭/마일스톤/일일 완료 알림에 반영됩니다
- 하위 항목의 완료 토글은 \`PATCH /todos/:id/items/:itemId\` API를 사용하세요`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async toggleComplete(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: ToggleTodoCompleteDto,
		@Timezone() tz: string,
	): Promise<UpdateTodoResponseDto> {
		this.#logger.debug(
			`Todo 완료 상태 변경: id=${params.id}, completed=${dto.completed}, user=${user.userId}`,
		);

		const todo = await this.commandBus.execute<
			ToggleTodoCompleteCommand,
			TodoResponse
		>(new ToggleTodoCompleteCommand(params.id, user.userId, dto.completed, tz));

		return {
			message: dto.completed
				? "할 일이 완료되었습니다."
				: "할 일이 미완료로 변경되었습니다.",
			todo,
		};
	}

	@Patch(":id/visibility")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 공개 범위 변경",
		operationId: "updateTodoVisibility",
		description: `할 일의 공개 범위를 변경합니다.

**요청 필드**: \`visibility\` (PUBLIC/PRIVATE, 필수)`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async updateVisibility(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: UpdateTodoVisibilityDto,
	): Promise<UpdateTodoResponseDto> {
		this.#logger.debug(
			`Todo 공개 범위 변경: id=${params.id}, visibility=${dto.visibility}, user=${user.userId}`,
		);

		const todo = await this.commandBus.execute<
			UpdateTodoVisibilityCommand,
			TodoResponse
		>(new UpdateTodoVisibilityCommand(params.id, user.userId, dto.visibility));

		return {
			message: `공개 범위가 ${dto.visibility}로 변경되었습니다.`,
			todo,
		};
	}

	@Patch(":id/category")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 카테고리 변경",
		operationId: "updateTodoCategory",
		description: `할 일의 카테고리를 변경합니다.

**요청 필드**: \`categoryId\` (number, 필수)`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiNotFoundError(ErrorCode.TODO_CATEGORY_0851)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async updateCategory(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: ChangeTodoCategoryDto,
	): Promise<UpdateTodoResponseDto> {
		this.#logger.debug(
			`Todo 카테고리 변경: id=${params.id}, categoryId=${dto.categoryId}, user=${user.userId}`,
		);

		const todo = await this.todoService.updateCategory(
			params.id,
			user.userId,
			dto,
		);

		return {
			message: "카테고리가 변경되었습니다.",
			todo,
		};
	}

	@Patch(":id/schedule")
	@HttpCode(HttpStatus.OK)
	@ApiHeader({
		name: "X-Timezone",
		required: false,
		description: "사용자 타임존 (IANA, 기본값: UTC)",
		example: "Asia/Seoul",
	})
	@ApiDoc({
		summary: "할 일 일정 변경",
		operationId: "updateTodoSchedule",
		description: `할 일의 날짜와 시간을 변경합니다.

**요청 필드** (모두 선택)
- \`startDate\`: 시작일 (YYYY-MM-DD)
- \`endDate\`: 종료일 (YYYY-MM-DD)
- \`scheduledTime\`: 예정 시간 (HH:mm, 24시간 형식). \`X-Timezone\` 헤더 기반으로 UTC 변환되어 저장됩니다.
- \`isAllDay\`: 종일 여부`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async updateSchedule(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: UpdateTodoScheduleDto,
		@Timezone() tz: string,
	): Promise<UpdateTodoResponseDto> {
		this.#logger.debug(
			`Todo 일정 변경: id=${params.id}, startDate=${dto.startDate}, user=${user.userId}`,
		);

		const todo = await this.commandBus.execute<
			UpdateTodoScheduleCommand,
			TodoResponse
		>(
			new UpdateTodoScheduleCommand(params.id, user.userId, {
				startDate: parseDateOnly(dto.startDate),
				endDate: dto.endDate ? parseDateOnly(dto.endDate) : null,
				scheduledTime: dto.scheduledTime
					? this.#parseScheduledTime(dto.startDate, dto.scheduledTime, tz)
					: null,
				isAllDay: dto.isAllDay ?? true,
			}),
		);

		return {
			message: "일정이 변경되었습니다.",
			todo,
		};
	}

	@Patch(":id/title")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 제목 수정",
		operationId: "updateTodoTitle",
		description: `할 일의 제목을 수정합니다.

**요청 필드**
- \`title\`: 할 일 제목 (1-200자, 필수)`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async updateTitle(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: UpdateTodoTitleDto,
	): Promise<UpdateTodoResponseDto> {
		this.#logger.debug(`Todo 제목 수정: id=${params.id}, user=${user.userId}`);

		const todo = await this.commandBus.execute<
			UpdateTodoTitleCommand,
			TodoResponse
		>(new UpdateTodoTitleCommand(params.id, user.userId, dto.title));

		return {
			message: "할 일이 수정되었습니다.",
			todo,
		};
	}

	@Patch(":id/reorder")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 순서 변경",
		operationId: "reorderTodo",
		description: `할 일을 다른 할 일의 앞 또는 뒤로 이동합니다. 드래그 앤 드롭 UI에 적합합니다.

**요청 필드**
- \`targetTodoId\` (선택): 기준이 되는 할 일 ID. 생략 시 맨 앞/뒤로 이동
- \`position\` (필수): 기준 할 일의 앞(\`before\`) 또는 뒤(\`after\`)`,
	})
	@ApiSuccessResponse({ type: ReorderTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async reorder(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: ReorderTodoDto,
	): Promise<ReorderTodoResponseDto> {
		this.#logger.debug(
			`Todo 순서 변경: id=${params.id}, target=${dto.targetTodoId}, position=${dto.position}, user=${user.userId}`,
		);

		const todo = await this.todoService.reorder(params.id, user.userId, dto);

		return {
			message: "할 일 순서가 변경되었습니다.",
			todo,
		};
	}

	@Delete(":id")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 삭제",
		operationId: "deleteTodo",
		description: `특정 할 일을 삭제합니다. 삭제된 할 일은 복구할 수 없습니다.

할 일을 삭제하면 해당 투두의 모든 하위 항목도 함께 삭제됩니다 (Cascade).`,
	})
	@ApiSuccessResponse({ type: DeleteTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	async delete(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
	): Promise<DeleteTodoResponseDto> {
		this.#logger.debug(`Todo 삭제: id=${params.id}, user=${user.userId}`);

		await this.todoService.delete(params.id, user.userId);

		this.#logger.log(`Todo 삭제 완료: id=${params.id}, user=${user.userId}`);

		return {
			message: "할 일이 삭제되었습니다.",
		};
	}

	// ===== 하위 항목 (체크리스트) 관리 =====
	// 선언 순서: POST → reorder(정적) → PATCH :itemId(동적) → DELETE :itemId

	@Post(":id/items")
	@ApiDoc({
		summary: "하위 항목 추가",
		operationId: "addTodoItem",
		description: `할 일에 하위 항목(체크리스트)을 추가합니다.

**요청 필드**
- \`title\` (필수): 하위 항목 제목 (1-200자)

**동작**
- 새 항목은 기존 항목 맨 뒤에 추가됩니다 (\`sortOrder\` 자동 증가)
- 투두당 최대 ${TODO_ITEM_LIMITS.MAX_PER_TODO}개까지 추가 가능

**응답**
- 부모 할 일 전체 객체를 반환합니다 (\`items\`, \`itemStats\` 포함)
- 클라이언트는 응답의 \`todo\` 객체로 로컬 상태를 교체하면 됩니다

**참고**
- 하위 항목은 카테고리당 활성 할 일 한도(300개)에 포함되지 않습니다
- 하위 항목은 스트릭/마일스톤/일일 완료 알림에 영향을 주지 않습니다

**에러**

| 상황 | 코드 | HTTP |
|------|------|------|
| 인증 실패 | AUTH_0107 | 401 |
| 할 일 없음 | TODO_0801 | 404 |
| 하위 항목 한도 초과 (${TODO_ITEM_LIMITS.MAX_PER_TODO}개) | TODO_0821 | 403 |
| 유효성 검증 실패 | SYS_0002 | 400 |`,
	})
	@ApiCreatedResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiForbiddenError(ErrorCode.TODO_0821)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async addItem(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: CreateTodoItemDto,
	): Promise<UpdateTodoResponseDto> {
		this.#logger.debug(
			`Todo 하위 항목 추가: todoId=${params.id}, user=${user.userId}`,
		);

		const todo = await this.todoService.addItem(params.id, user.userId, dto);

		return {
			message: "하위 항목이 추가되었습니다.",
			todo,
		};
	}

	@Patch(":id/items/reorder")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "하위 항목 순서 변경",
		operationId: "reorderTodoItems",
		description: `하위 항목의 순서를 일괄 변경합니다. 드래그 앤 드롭 UI에 적합합니다.

**요청 필드**
- \`itemIds\` (필수): 새로운 순서대로 정렬된 하위 항목 ID 배열

**사용법**
배열의 인덱스가 새로운 \`sortOrder\`가 됩니다.

\`\`\`json
// 기존: [항목A(id:1), 항목B(id:2), 항목C(id:3)]
// 항목C를 맨 위로 이동:
{ "itemIds": [3, 1, 2] }
// 결과: [항목C(sortOrder:0), 항목A(sortOrder:1), 항목B(sortOrder:2)]
\`\`\`

**주의사항**
- \`itemIds\`에는 해당 투두의 **전체** 하위 항목 ID를 새로운 순서대로 포함해야 합니다
- 일부 ID만 전달하면 sortOrder 충돌이 발생하므로 \`400 Bad Request\` 에러 반환
- 존재하지 않거나 다른 투두의 ID가 포함되면 TODO_0822 에러 반환`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiNotFoundError(ErrorCode.TODO_0822)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async reorderItems(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: ReorderTodoItemsDto,
	): Promise<UpdateTodoResponseDto> {
		this.#logger.debug(
			`Todo 하위 항목 순서 변경: todoId=${params.id}, user=${user.userId}`,
		);

		const todo = await this.todoService.reorderItems(
			params.id,
			user.userId,
			dto,
		);

		return {
			message: "하위 항목 순서가 변경되었습니다.",
			todo,
		};
	}

	@Patch(":id/items/:itemId")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "하위 항목 수정",
		operationId: "updateTodoItem",
		description: `하위 항목의 제목 또는 완료 상태를 수정합니다.

**요청 필드** (최소 1개 필수)
- \`title\` (선택): 변경할 제목 (1-200자)
- \`completed\` (선택): 완료 상태 (true/false)

**완료 토글 사용법**
\`\`\`json
{ "completed": true }   // 체크
{ "completed": false }  // 체크 해제
\`\`\`

**부모 할 일과의 관계**
- 하위 항목의 완료/미완료는 부모 할 일의 \`completed\` 상태에 **영향을 주지 않습니다**
- 모든 하위 항목이 완료(예: 3/3)되어도 부모는 **자동 완료되지 않습니다**
- 부모 할 일의 완료는 \`PATCH /todos/:id/complete\` API를 별도로 호출해야 합니다
- 하위 항목 완료는 스트릭/마일스톤/일일 완료 알림에 **영향을 주지 않습니다** (부모만 카운트)

**에러**

| 상황 | 코드 | HTTP |
|------|------|------|
| 인증 실패 | AUTH_0107 | 401 |
| 할 일 없음 | TODO_0801 | 404 |
| 하위 항목 없음 | TODO_0822 | 404 |
| 유효성 검증 실패 | SYS_0002 | 400 |`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiNotFoundError(ErrorCode.TODO_0822)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async updateItem(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoItemIdParamDto,
		@Body() dto: UpdateTodoItemDto,
	): Promise<UpdateTodoResponseDto> {
		this.#logger.debug(
			`Todo 하위 항목 수정: todoId=${params.id}, itemId=${params.itemId}, user=${user.userId}`,
		);

		const todo = await this.todoService.updateItem(
			params.id,
			params.itemId,
			user.userId,
			dto,
		);

		return {
			message: "하위 항목이 수정되었습니다.",
			todo,
		};
	}

	@Delete(":id/items/:itemId")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "하위 항목 삭제",
		operationId: "deleteTodoItem",
		description: `하위 항목을 삭제합니다. 삭제 후 복구할 수 없습니다.

**응답**
- 부모 할 일 전체 객체를 반환합니다 (삭제된 항목이 제외된 상태)
- \`itemStats\`가 자동으로 재계산됩니다

**참고**
- 부모 할 일 자체를 삭제하면(\`DELETE /todos/:id\`) 모든 하위 항목이 함께 삭제됩니다 (Cascade)
- 개별 하위 항목 삭제는 이 API를 사용하세요

**에러**

| 상황 | 코드 | HTTP |
|------|------|------|
| 인증 실패 | AUTH_0107 | 401 |
| 할 일 없음 | TODO_0801 | 404 |
| 하위 항목 없음 | TODO_0822 | 404 |`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiNotFoundError(ErrorCode.TODO_0822)
	async deleteItem(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoItemIdParamDto,
	): Promise<UpdateTodoResponseDto> {
		this.#logger.debug(
			`Todo 하위 항목 삭제: todoId=${params.id}, itemId=${params.itemId}, user=${user.userId}`,
		);

		const todo = await this.todoService.deleteItem(
			params.id,
			params.itemId,
			user.userId,
		);

		return {
			message: "하위 항목이 삭제되었습니다.",
			todo,
		};
	}

	/**
	 * HH:mm 형식의 시간을 UTC Date 객체로 변환
	 *
	 * 사용자의 로컬 시간을 X-Timezone 헤더 기반으로 UTC 변환하여 저장합니다.
	 * Google Calendar 패턴: 시간 이벤트는 TIMESTAMPTZ(UTC)로 저장
	 *
	 * @param dateStr - YYYY-MM-DD 형식의 날짜 문자열
	 * @param timeStr - HH:mm 형식의 시간 문자열
	 * @param tz - IANA 타임존 (예: "Asia/Seoul", "America/New_York")
	 * @example parseScheduledTime("2026-01-15", "14:00", "Asia/Seoul") → 2026-01-15T05:00:00.000Z
	 */
	#parseScheduledTime(dateStr: string, timeStr: string, tz: string): Date {
		return parseLocalDateTime(dateStr, timeStr, tz);
	}
}
