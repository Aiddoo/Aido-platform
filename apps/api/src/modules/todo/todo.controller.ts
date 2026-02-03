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

**필수 필드**
- \`title\`: 할 일 제목 (1-200자)
- \`categoryId\`: 카테고리 ID
- \`startDate\`: 시작 날짜 (YYYY-MM-DD)

**선택 필드**
- \`content\`: 상세 내용 (최대 5000자)
- \`endDate\`: 종료 날짜 (YYYY-MM-DD)
- \`scheduledTime\`: 예정 시간 (HH:mm)
- \`isAllDay\`: 종일 여부 (기본값: true)
- \`visibility\`: 공개 범위 (PUBLIC/PRIVATE, 기본값: PUBLIC)`,
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

**쿼리 파라미터**
- \`cursor\`: 페이지네이션 커서
- \`size\`: 페이지 크기 (1-100, 기본값: 20)
- \`completed\`: 완료 상태 필터
- \`categoryId\`: 카테고리 ID 필터
- \`startDate\`: 시작일 이후 필터 (YYYY-MM-DD)
- \`endDate\`: 종료일 이전 필터 (YYYY-MM-DD)`,
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

본인 소유의 할 일만 조회할 수 있습니다.`,
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

맞팔 관계여야만 조회 가능하며, PRIVATE 할 일은 표시되지 않습니다.

**쿼리 파라미터**: cursor, size, startDate, endDate`,
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

**수정 가능 필드**: title, content, categoryId, startDate, endDate, scheduledTime, isAllDay, visibility, completed`,
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

**요청 필드**: \`completed\` (boolean, 필수)`,
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

**요청 필드**: \`categoryId\` (number, 필수)`,
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

**요청 필드** (모두 선택)
- \`startDate\`: 시작일 (YYYY-MM-DD)
- \`endDate\`: 종료일 (YYYY-MM-DD)
- \`scheduledTime\`: 예정 시간 (HH:mm)
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

**요청 필드** (최소 1개 필수)
- \`title\`: 할 일 제목 (1-200자)
- \`content\`: 상세 내용 (0-5000자)`,
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
		description: `특정 할 일을 삭제합니다. 삭제된 할 일은 복구할 수 없습니다.`,
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
