import { ErrorCode } from "@aido/errors";
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
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";

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
import { JwtAuthGuard } from "../auth/guards";
import { UserIdParamDto } from "../follow/dtos";

import {
	ChangeTodoCategoryDto,
	CreateTodoDto,
	CreateTodoResponseDto,
	DeleteTodoResponseDto,
	GetTodosQueryDto,
	ReorderTodoDto,
	ReorderTodoResponseDto,
	TodoIdParamDto,
	TodoListResponseDto,
	TodoResponseDto,
	ToggleTodoCompleteDto,
	UpdateTodoContentDto,
	UpdateTodoDto,
	UpdateTodoResponseDto,
	UpdateTodoScheduleDto,
	UpdateTodoVisibilityDto,
} from "./dtos";
import { TodoService } from "./todo.service";

/**
 * Todo API 컨트롤러
 *
 * 사용자의 할 일을 생성, 조회, 수정, 삭제하는 CRUD API입니다.
 *
 * ### 주요 기능
 * - 할 일 생성/조회/수정/삭제
 * - 할 일 완료 상태 관리
 * - 할 일 공개 범위 설정
 * - 친구의 공개 할 일 조회
 * - 커서 기반 페이지네이션
 * - 날짜 범위 필터링
 */
@ApiTags(SWAGGER_TAGS.TODOS)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("todos")
export class TodoController {
	private readonly logger = new Logger(TodoController.name);

	constructor(private readonly todoService: TodoService) {}

	// ============================================
	// CREATE - 할 일 생성
	// ============================================

	/**
	 * POST /todos - 할 일 생성
	 *
	 * 새로운 할 일을 생성합니다.
	 */
	@Post()
	@ApiDoc({
		summary: "할 일 생성",
		operationId: "createTodo",
		description: `새로운 할 일을 생성합니다.

📝 **필수 필드**
| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| \`title\` | string | 1-200자 | 할 일 제목 |
| \`categoryId\` | number | 양수 | 카테고리 ID |
| \`startDate\` | string | YYYY-MM-DD | 시작 날짜 |

📝 **선택 필드**
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| \`content\` | string | null | 상세 내용 (최대 5000자) |
| \`endDate\` | string | null | 종료 날짜 (YYYY-MM-DD) |
| \`scheduledTime\` | string | null | 예정 시간 (HH:mm) |
| \`isAllDay\` | boolean | true | 종일 여부 |
| \`visibility\` | enum | PUBLIC | 공개 범위 (PUBLIC: 전체 공개, PRIVATE: 비공개) |`,
	})
	@ApiCreatedResponse({ type: CreateTodoResponseDto })
	@ApiUnauthorizedError()
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async create(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: CreateTodoDto,
	): Promise<CreateTodoResponseDto> {
		this.logger.debug(`Todo 생성: user=${user.userId}, title=${dto.title}`);

		const todo = await this.todoService.create({
			userId: user.userId,
			title: dto.title,
			content: dto.content,
			categoryId: dto.categoryId,
			startDate: new Date(dto.startDate),
			endDate: dto.endDate ? new Date(dto.endDate) : undefined,
			scheduledTime: dto.scheduledTime
				? this.parseScheduledTime(dto.startDate, dto.scheduledTime)
				: undefined,
			isAllDay: dto.isAllDay,
			visibility: dto.visibility,
		});

		this.logger.log(`Todo 생성 완료: id=${todo.id}, user=${user.userId}`);

		return {
			message: "할 일이 생성되었습니다.",
			todo,
		};
	}

	// ============================================
	// READ - 할 일 조회
	// ============================================

	/**
	 * GET /todos - 할 일 목록 조회
	 *
	 * 사용자의 할 일 목록을 커서 기반 페이지네이션으로 조회합니다.
	 */
	@Get()
	@ApiDoc({
		summary: "할 일 목록 조회",
		operationId: "getTodos",
		description: `사용자의 할 일 목록을 커서 기반 페이지네이션으로 조회합니다.

📝 **쿼리 파라미터**
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| \`cursor\` | string | - | 페이지네이션 커서 |
| \`size\` | number | 20 | 페이지 크기 (1-100) |
| \`completed\` | boolean | - | 완료 상태 필터 |
| \`categoryId\` | number | - | 카테고리 ID 필터 |
| \`startDate\` | string | - | 시작일 이후 필터 (YYYY-MM-DD) |
| \`endDate\` | string | - | 종료일 이전 필터 (YYYY-MM-DD) |

💡 **예시**: \`GET /todos?size=20&completed=false&categoryId=1&startDate=2025-01-01\``,
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
		description: "페이지 크기 (1-100)",
		schema: { type: "number", minimum: 1, maximum: 100, default: 20 },
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
		description: "시작일 이후 필터 (YYYY-MM-DD)",
		schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
		example: "2026-01-01",
	})
	@ApiQuery({
		name: "endDate",
		required: false,
		description: "종료일 이전 필터 (YYYY-MM-DD)",
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
		this.logger.debug(
			`Todo 목록 조회: user=${user.userId}, size=${query.size}, completed=${query.completed}`,
		);

		const result = await this.todoService.findMany({
			userId: user.userId,
			cursor: query.cursor,
			size: query.size,
			completed: query.completed,
			categoryId: query.categoryId,
			startDate: query.startDate ? new Date(query.startDate) : undefined,
			endDate: query.endDate ? new Date(query.endDate) : undefined,
		});

		return {
			items: result.items,
			pagination: result.pagination,
		};
	}

	/**
	 * GET /todos/:id - 할 일 상세 조회
	 *
	 * 특정 할 일의 상세 정보를 조회합니다.
	 */
	@Get(":id")
	@ApiDoc({
		summary: "할 일 상세 조회",
		operationId: "getTodoById",
		description: `특정 할 일의 상세 정보를 조회합니다.

📝 **경로 파라미터**: \`:id\` - 할 일 고유 ID (숫자)

❌ **에러 코드**
| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| \`TODO_0801\` | 404 | Todo를 찾을 수 없습니다 | 존재하지 않거나 본인 소유가 아님 |`,
	})
	@ApiSuccessResponse({ type: TodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	async findById(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
	): Promise<TodoResponseDto> {
		this.logger.debug(`Todo 상세 조회: id=${params.id}, user=${user.userId}`);

		const todo = await this.todoService.findById(params.id, user.userId);

		return todo;
	}

	/**
	 * GET /todos/friends/:userId - 친구의 할 일 목록 조회
	 *
	 * 친구의 공개(PUBLIC) 할 일 목록을 조회합니다.
	 * 맞팔 관계여야만 조회 가능합니다.
	 */
	@Get("friends/:userId")
	@ApiDoc({
		summary: "친구의 할 일 목록 조회",
		operationId: "getFriendTodos",
		description: `친구의 공개(PUBLIC) 할 일 목록을 조회합니다.

⚠️ **접근 조건**: 맞팔 관계여야만 조회 가능 (PRIVATE 투두는 조회 불가)

📝 **경로 파라미터**: \`:userId\` - 친구의 사용자 ID

📝 **쿼리 파라미터**: 할 일 목록 조회와 동일 (cursor, size, startDate, endDate)

❌ **에러 코드**
| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| \`FOLLOW_0906\` | 403 | 친구가 아닌 사용자의 투두를 볼 수 없습니다 | 맞팔 관계 아님 |`,
	})
	@ApiSuccessResponse({ type: TodoListResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiForbiddenError(ErrorCode.FOLLOW_0906)
	async findFriendTodos(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: UserIdParamDto,
		@Query() query: GetTodosQueryDto,
	): Promise<TodoListResponseDto> {
		this.logger.debug(
			`친구 Todo 목록 조회: friendUserId=${params.userId}, user=${user.userId}`,
		);

		const result = await this.todoService.findFriendTodos({
			userId: user.userId,
			friendUserId: params.userId,
			cursor: query.cursor,
			size: query.size,
			startDate: query.startDate ? new Date(query.startDate) : undefined,
			endDate: query.endDate ? new Date(query.endDate) : undefined,
		});

		return {
			items: result.items,
			pagination: result.pagination,
		};
	}

	// ============================================
	// UPDATE - 할 일 수정
	// ============================================

	/**
	 * PATCH /todos/:id - 할 일 수정
	 *
	 * 할 일의 정보를 수정합니다 (부분 수정 가능).
	 */
	@Patch(":id")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 수정",
		operationId: "updateTodo",
		description: `할 일의 정보를 부분 수정합니다.

📝 **수정 가능 필드**: title, content, categoryId, startDate, endDate, scheduledTime, isAllDay, visibility, completed

❌ **에러 코드**
| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| \`TODO_0801\` | 404 | Todo를 찾을 수 없습니다 | 존재하지 않거나 본인 소유가 아님 |
| \`TODO_CATEGORY_0851\` | 404 | 카테고리를 찾을 수 없습니다 | 카테고리가 존재하지 않음 |
| \`SYS_0002\` | 400 | 잘못된 파라미터입니다 | 형식 오류 (startDate 등) |`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async update(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: UpdateTodoDto,
	): Promise<UpdateTodoResponseDto> {
		this.logger.debug(`Todo 수정: id=${params.id}, user=${user.userId}`);

		const todo = await this.todoService.update(params.id, user.userId, {
			title: dto.title,
			content: dto.content,
			categoryId: dto.categoryId,
			startDate: dto.startDate ? new Date(dto.startDate) : undefined,
			endDate:
				dto.endDate === null
					? null
					: dto.endDate
						? new Date(dto.endDate)
						: undefined,
			scheduledTime:
				dto.scheduledTime === null
					? null
					: dto.scheduledTime && dto.startDate
						? this.parseScheduledTime(dto.startDate, dto.scheduledTime)
						: undefined,
			isAllDay: dto.isAllDay,
			visibility: dto.visibility,
			completed: dto.completed,
		});

		this.logger.log(`Todo 수정 완료: id=${params.id}, user=${user.userId}`);

		return {
			message: "할 일이 수정되었습니다.",
			todo,
		};
	}

	/**
	 * PATCH /todos/:id/complete - 할 일 완료 상태 토글
	 */
	@Patch(":id/complete")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 완료 상태 토글",
		operationId: "toggleTodoComplete",
		description: `할 일의 완료 상태를 변경합니다.

📝 **요청 필드**: \`completed\` (boolean, 필수)

❌ **에러 코드**
| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| \`TODO_0801\` | 404 | Todo를 찾을 수 없습니다 | 존재하지 않거나 본인 소유가 아님 |
| \`SYS_0002\` | 400 | 잘못된 파라미터입니다 | completed 필드 누락/타입 오류 |`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async toggleComplete(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: ToggleTodoCompleteDto,
	): Promise<UpdateTodoResponseDto> {
		this.logger.debug(
			`Todo 완료 상태 변경: id=${params.id}, completed=${dto.completed}, user=${user.userId}`,
		);

		const todo = await this.todoService.toggleComplete(
			params.id,
			user.userId,
			dto,
		);

		return {
			message: dto.completed
				? "할 일이 완료되었습니다."
				: "할 일이 미완료로 변경되었습니다.",
			todo,
		};
	}

	/**
	 * PATCH /todos/:id/visibility - 할 일 공개 범위 변경
	 */
	@Patch(":id/visibility")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 공개 범위 변경",
		operationId: "updateTodoVisibility",
		description: `할 일의 공개 범위를 변경합니다.

### 📝 요청 Body
| 필드 | 타입 | 필수 | 옵션 | 설명 |
|------|------|------|------|------|
| \`visibility\` | enum | ✅ | PUBLIC, PRIVATE | 공개 범위 (PUBLIC: 전체 공개, PRIVATE: 비공개) |

❌ **에러 코드**
| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| \`TODO_0801\` | 404 | Todo를 찾을 수 없습니다 | 존재하지 않거나 본인 소유가 아님 |
| \`SYS_0002\` | 400 | 잘못된 파라미터입니다 | visibility가 PUBLIC/PRIVATE가 아님 |`,
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
		this.logger.debug(
			`Todo 공개 범위 변경: id=${params.id}, visibility=${dto.visibility}, user=${user.userId}`,
		);

		const todo = await this.todoService.updateVisibility(
			params.id,
			user.userId,
			dto,
		);

		return {
			message: `공개 범위가 ${dto.visibility}로 변경되었습니다.`,
			todo,
		};
	}

	/**
	 * PATCH /todos/:id/color - 할 일 색상 변경
	 */
	@Patch(":id/category")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 카테고리 변경",
		operationId: "updateTodoCategory",
		description: `할 일의 카테고리를 변경합니다.

📝 **요청 필드**: \`categoryId\` (number, 필수) - 변경할 카테고리 ID

❌ **에러 코드**
| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| \`TODO_0801\` | 404 | Todo를 찾을 수 없습니다 | 존재하지 않거나 본인 소유가 아님 |
| \`TODO_CATEGORY_0851\` | 404 | 카테고리를 찾을 수 없습니다 | 카테고리가 존재하지 않음 |`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async updateCategory(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: ChangeTodoCategoryDto,
	): Promise<UpdateTodoResponseDto> {
		this.logger.debug(
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

	/**
	 * PATCH /todos/:id/schedule - 할 일 일정 변경
	 */
	@Patch(":id/schedule")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 일정 변경",
		operationId: "updateTodoSchedule",
		description: `할 일의 날짜와 시간을 변경합니다.

📝 **요청 필드** (모두 선택)
| 필드 | 타입 | 설명 |
|------|------|------|
| startDate | YYYY-MM-DD | 시작일 |
| endDate | YYYY-MM-DD | 종료일 |
| scheduledTime | HH:mm | 예정 시간 |
| isAllDay | boolean | 종일 여부 |

❌ **에러 코드**
| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| \`TODO_0801\` | 404 | Todo를 찾을 수 없습니다 | 존재하지 않거나 본인 소유가 아님 |
| \`SYS_0002\` | 400 | 잘못된 파라미터입니다 | 날짜/시간 형식 오류 |`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async updateSchedule(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: UpdateTodoScheduleDto,
	): Promise<UpdateTodoResponseDto> {
		this.logger.debug(
			`Todo 일정 변경: id=${params.id}, startDate=${dto.startDate}, user=${user.userId}`,
		);

		const todo = await this.todoService.updateSchedule(
			params.id,
			user.userId,
			dto,
		);

		return {
			message: "일정이 변경되었습니다.",
			todo,
		};
	}

	/**
	 * PATCH /todos/:id/content - 할 일 제목/내용 수정
	 */
	@Patch(":id/content")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 제목/내용 수정",
		operationId: "updateTodoContent",
		description: `할 일의 제목 또는 내용을 수정합니다.

📝 **요청 필드** (최소 1개 필수)
| 필드 | 타입 | 제한 |
|------|------|------|
| title | string | 1-200자 |
| content | string | 0-5000자 |

❌ **에러 코드**
| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| \`TODO_0801\` | 404 | Todo를 찾을 수 없습니다 | 존재하지 않거나 본인 소유가 아님 |
| \`SYS_0002\` | 400 | 잘못된 파라미터입니다 | title 200자 초과/content 5000자 초과 |`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async updateContent(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: UpdateTodoContentDto,
	): Promise<UpdateTodoResponseDto> {
		this.logger.debug(
			`Todo 제목/내용 수정: id=${params.id}, user=${user.userId}`,
		);

		const todo = await this.todoService.updateContent(
			params.id,
			user.userId,
			dto,
		);

		return {
			message: "할 일이 수정되었습니다.",
			todo,
		};
	}

	/**
	 * PATCH /todos/:id/reorder - 할 일 순서 변경
	 */
	@Patch(":id/reorder")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 순서 변경",
		operationId: "reorderTodo",
		description: `특정 할 일을 다른 할 일의 앞 또는 뒤로 이동합니다.
드래그 앤 드롭으로 할 일의 우선순위를 변경할 때 사용합니다.

## 동작 방식
1. \`targetTodoId\`: 기준이 되는 할 일 ID
2. \`position\`: 기준 할 일의 앞(\`before\`) 또는 뒤(\`after\`)로 이동

## 예시
현재 순서: [A, B, C, D, E] (sortOrder: 0, 1, 2, 3, 4)

### Case 1: D를 B 앞으로 이동
- Request: \`{ targetTodoId: B의 ID, position: "before" }\`
- 결과: [A, D, B, C, E]

### Case 2: A를 C 뒤로 이동  
- Request: \`{ targetTodoId: C의 ID, position: "after" }\`
- 결과: [B, C, A, D, E]

### Case 3: 맨 처음으로 이동 (targetTodoId 없이)
- Request: \`{ position: "before" }\`
- 결과: 해당 Todo가 맨 앞으로 이동

### Case 4: 맨 끝으로 이동 (targetTodoId 없이)
- Request: \`{ position: "after" }\`
- 결과: 해당 Todo가 맨 뒤로 이동

## 주의사항
- targetTodoId가 다른 사용자의 할 일이면 404 에러
- 자기 자신을 targetTodoId로 지정하면 무시 (변경 없음)`,
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
		this.logger.debug(
			`Todo 순서 변경: id=${params.id}, target=${dto.targetTodoId}, position=${dto.position}, user=${user.userId}`,
		);

		const todo = await this.todoService.reorder(params.id, user.userId, dto);

		return {
			message: "할 일 순서가 변경되었습니다.",
			todo,
		};
	}

	// ============================================
	// DELETE - 할 일 삭제
	// ============================================

	/**
	 * DELETE /todos/:id - 할 일 삭제
	 */
	@Delete(":id")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 삭제",
		operationId: "deleteTodo",
		description: `특정 할 일을 삭제합니다.

⚠️ **주의**: 삭제된 할 일은 복구할 수 없습니다.

❌ **에러 코드**
| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| \`TODO_0801\` | 404 | Todo를 찾을 수 없습니다 | 존재하지 않거나 본인 소유가 아님 |`,
	})
	@ApiSuccessResponse({ type: DeleteTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	async delete(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
	): Promise<DeleteTodoResponseDto> {
		this.logger.debug(`Todo 삭제: id=${params.id}, user=${user.userId}`);

		await this.todoService.delete(params.id, user.userId);

		this.logger.log(`Todo 삭제 완료: id=${params.id}, user=${user.userId}`);

		return {
			message: "할 일이 삭제되었습니다.",
		};
	}

	// ============================================
	// Helper Methods
	// ============================================

	/**
	 * HH:mm 형식의 시간을 Date 객체로 변환
	 */
	private parseScheduledTime(dateStr: string, timeStr: string): Date {
		const timeParts = timeStr.split(":");
		const hours = Number(timeParts[0] ?? 0);
		const minutes = Number(timeParts[1] ?? 0);
		const date = new Date(dateStr);
		date.setHours(hours, minutes, 0, 0);
		return date;
	}
}
