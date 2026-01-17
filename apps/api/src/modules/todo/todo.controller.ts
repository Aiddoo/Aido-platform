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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
	ApiCreatedResponse,
	ApiDoc,
	ApiErrorResponse,
	ApiNotFoundError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/common/swagger";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators";
import { JwtAuthGuard } from "../auth/guards";

import {
	CreateTodoDto,
	CreateTodoResponseDto,
	DeleteTodoResponseDto,
	GetTodosQueryDto,
	TodoIdParamDto,
	TodoListResponseDto,
	TodoResponseDto,
	ToggleTodoCompleteDto,
	UpdateTodoColorDto,
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
 * ## 📝 할 일 관리 API
 *
 * 사용자의 할 일을 생성, 조회, 수정, 삭제하는 API입니다.
 *
 * ### CRUD 엔드포인트
 * - POST /todos - 할 일 생성
 * - GET /todos - 할 일 목록 조회 (커서 기반 페이지네이션)
 * - GET /todos/:id - 단일 할 일 조회
 * - PATCH /todos/:id - 할 일 수정
 * - DELETE /todos/:id - 할 일 삭제
 */
@ApiTags(SWAGGER_TAGS.TODOS)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("todos")
export class TodoController {
	private readonly logger = new Logger(TodoController.name);

	constructor(private readonly todoService: TodoService) {}

	// ============================================
	// 생성
	// ============================================

	@Post()
	@ApiDoc({
		summary: "할 일 생성",
		description: `
## 📝 할 일 생성

새로운 할 일을 생성합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 필수 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| \`title\` | string | 제목 (1-200자) |
| \`startDate\` | string | 시작 날짜 (YYYY-MM-DD) |

### 📋 선택 필드
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| \`content\` | string | null | 상세 내용 (최대 5000자) |
| \`color\` | string | null | HEX 색상 코드 (#FF5733) |
| \`endDate\` | string | null | 종료 날짜 (YYYY-MM-DD) |
| \`scheduledTime\` | string | null | 예정 시간 (HH:mm) |
| \`isAllDay\` | boolean | true | 종일 여부 |
| \`visibility\` | enum | PUBLIC | 공개 범위 (PUBLIC/PRIVATE) |

### 📝 요청 예시
\`\`\`json
{
  "title": "운동하기",
  "content": "헬스장에서 1시간 운동",
  "color": "#FF5733",
  "startDate": "2024-01-15",
  "endDate": "2024-01-15",
  "scheduledTime": "09:00",
  "isAllDay": false,
  "visibility": "PUBLIC"
}
\`\`\`

### ⚠️ 유효성 검사
- \`endDate\`는 \`startDate\` 이후여야 합니다
- \`color\`는 HEX 형식이어야 합니다 (#RRGGBB)
- \`scheduledTime\`은 HH:mm 형식이어야 합니다
		`,
	})
	@ApiCreatedResponse({ type: CreateTodoResponseDto })
	@ApiUnauthorizedError()
	async create(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: CreateTodoDto,
	): Promise<CreateTodoResponseDto> {
		this.logger.debug(`Todo 생성 요청: user=${user.userId}`);

		const todo = await this.todoService.create({
			userId: user.userId,
			title: dto.title,
			content: dto.content,
			color: dto.color,
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
			todo: this.mapToResponse(todo),
		};
	}

	// ============================================
	// 조회
	// ============================================

	@Get()
	@ApiDoc({
		summary: "할 일 목록 조회",
		description: `
## 📋 할 일 목록 조회

사용자의 할 일 목록을 커서 기반 페이지네이션으로 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 🔍 쿼리 파라미터
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| \`cursor\` | string | - | 페이지네이션 커서 |
| \`size\` | number | 20 | 페이지 크기 (1-100) |
| \`completed\` | boolean | - | 완료 상태 필터 |
| \`startDate\` | string | - | 시작일 필터 (YYYY-MM-DD) |
| \`endDate\` | string | - | 종료일 필터 (YYYY-MM-DD) |

### 📝 요청 예시
\`\`\`
GET /todos?size=20&completed=false&startDate=2024-01-01&endDate=2024-01-31
\`\`\`

### 📤 응답 구조
\`\`\`json
{
  "items": [...],
  "pagination": {
    "nextCursor": 21,
    "prevCursor": null,
    "hasNext": true,
    "hasPrevious": false,
    "size": 20
  }
}
\`\`\`

### 💡 페이지네이션 사용법
1. 첫 요청: \`cursor\` 없이 호출
2. 다음 페이지: \`pagination.nextCursor\` 값을 \`cursor\`로 전달
3. \`pagination.hasNext\`가 \`false\`이면 마지막 페이지
		`,
	})
	@ApiSuccessResponse({ type: TodoListResponseDto })
	@ApiUnauthorizedError()
	async findMany(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetTodosQueryDto,
	): Promise<TodoListResponseDto> {
		this.logger.debug(`Todo 목록 조회: user=${user.userId}`);

		const result = await this.todoService.findMany({
			userId: user.userId,
			cursor: query.cursor,
			size: query.size,
			completed: query.completed,
			startDate: query.startDate ? new Date(query.startDate) : undefined,
			endDate: query.endDate ? new Date(query.endDate) : undefined,
		});

		return {
			items: result.items.map((todo) => this.mapToResponse(todo)),
			pagination: result.pagination,
		};
	}

	@Get(":id")
	@ApiDoc({
		summary: "할 일 상세 조회",
		description: `
## 🔍 할 일 상세 조회

특정 할 일의 상세 정보를 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`id\`: 할 일 고유 ID (숫자)

### ⚠️ 에러 케이스
- \`TODO_NOT_FOUND\`: 존재하지 않거나 접근 권한이 없는 할 일
		`,
	})
	@ApiSuccessResponse({ type: TodoResponseDto })
	@ApiUnauthorizedError()
	@ApiNotFoundError(ErrorCode.TODO_0801)
	async findById(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
	): Promise<TodoResponseDto> {
		this.logger.debug(`Todo 조회: id=${params.id}, user=${user.userId}`);

		const todo = await this.todoService.findById(params.id, user.userId);

		return this.mapToResponse(todo);
	}

	// ============================================
	// 수정
	// ============================================

	@Patch(":id")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 수정",
		description: `
## ✏️ 할 일 수정

기존 할 일의 정보를 수정합니다.
변경하려는 필드만 전송하면 됩니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`id\`: 할 일 고유 ID (숫자)

### 📋 수정 가능 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| \`title\` | string | 제목 |
| \`content\` | string \\| null | 내용 (null 전송 시 삭제) |
| \`color\` | string \\| null | 색상 (null 전송 시 삭제) |
| \`startDate\` | string | 시작 날짜 |
| \`endDate\` | string \\| null | 종료 날짜 |
| \`scheduledTime\` | string \\| null | 예정 시간 |
| \`isAllDay\` | boolean | 종일 여부 |
| \`visibility\` | enum | 공개 범위 |
| \`completed\` | boolean | 완료 여부 |

### 📝 요청 예시 (완료 처리)
\`\`\`json
{
  "completed": true
}
\`\`\`

### 📝 요청 예시 (내용 수정)
\`\`\`json
{
  "title": "운동하기 (수정)",
  "content": "2시간 운동으로 변경"
}
\`\`\`

### ⚠️ 에러 케이스
- \`TODO_NOT_FOUND\`: 존재하지 않거나 접근 권한이 없는 할 일

### 💡 완료 처리 시
\`completed: true\`로 설정하면 \`completedAt\`이 자동으로 현재 시각으로 설정됩니다.
\`completed: false\`로 설정하면 \`completedAt\`이 \`null\`로 초기화됩니다.
		`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError()
	@ApiNotFoundError(ErrorCode.TODO_0801)
	async update(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: UpdateTodoDto,
	): Promise<UpdateTodoResponseDto> {
		this.logger.debug(`Todo 수정 요청: id=${params.id}, user=${user.userId}`);

		const todo = await this.todoService.update(params.id, user.userId, {
			title: dto.title,
			content: dto.content,
			color: dto.color,
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
			todo: this.mapToResponse(todo),
		};
	}

	// ============================================
	// 액션별 수정 (SRP)
	// ============================================

	@Patch(":id/complete")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 완료 상태 토글",
		description: `
## ✅ 할 일 완료 상태 토글

할 일의 완료 상태를 변경합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`id\`: 할 일 고유 ID (숫자)

### 📋 요청 본문
| 필드 | 타입 | 설명 |
|------|------|------|
| \`completed\` | boolean | 완료 여부 |

### 📝 요청 예시
\`\`\`json
{
  "completed": true
}
\`\`\`

### 💡 동작
- \`completed: true\` → \`completedAt\`이 현재 시각으로 설정
- \`completed: false\` → \`completedAt\`이 \`null\`로 초기화
		`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError()
	@ApiNotFoundError(ErrorCode.TODO_0801)
	async toggleComplete(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: ToggleTodoCompleteDto,
	): Promise<UpdateTodoResponseDto> {
		this.logger.debug(
			`Todo 완료 상태 토글: id=${params.id}, completed=${dto.completed}, user=${user.userId}`,
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
			todo: this.mapToResponse(todo),
		};
	}

	@Patch(":id/visibility")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 공개 범위 변경",
		description: `
## 🔒 할 일 공개 범위 변경

할 일의 공개 범위를 변경합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`id\`: 할 일 고유 ID (숫자)

### 📋 요청 본문
| 필드 | 타입 | 설명 |
|------|------|------|
| \`visibility\` | enum | PUBLIC 또는 PRIVATE |

### 📝 요청 예시
\`\`\`json
{
  "visibility": "PRIVATE"
}
\`\`\`
		`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError()
	@ApiNotFoundError(ErrorCode.TODO_0801)
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
			message: "공개 범위가 변경되었습니다.",
			todo: this.mapToResponse(todo),
		};
	}

	@Patch(":id/color")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 색상 변경",
		description: `
## 🎨 할 일 색상 변경

할 일의 색상을 변경합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`id\`: 할 일 고유 ID (숫자)

### 📋 요청 본문
| 필드 | 타입 | 설명 |
|------|------|------|
| \`color\` | string \\| null | HEX 색상 코드 (#RRGGBB) 또는 null |

### 📝 요청 예시 (색상 설정)
\`\`\`json
{
  "color": "#FF5733"
}
\`\`\`

### 📝 요청 예시 (색상 제거)
\`\`\`json
{
  "color": null
}
\`\`\`
		`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError()
	@ApiNotFoundError(ErrorCode.TODO_0801)
	async updateColor(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
		@Body() dto: UpdateTodoColorDto,
	): Promise<UpdateTodoResponseDto> {
		this.logger.debug(
			`Todo 색상 변경: id=${params.id}, color=${dto.color}, user=${user.userId}`,
		);

		const todo = await this.todoService.updateColor(
			params.id,
			user.userId,
			dto,
		);

		return {
			message: dto.color ? "색상이 변경되었습니다." : "색상이 제거되었습니다.",
			todo: this.mapToResponse(todo),
		};
	}

	@Patch(":id/schedule")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 일정 변경",
		description: `
## 📅 할 일 일정 변경

할 일의 일정(날짜, 시간)을 변경합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`id\`: 할 일 고유 ID (숫자)

### 📋 요청 본문
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| \`startDate\` | string | ✅ | 시작 날짜 (YYYY-MM-DD) |
| \`endDate\` | string \\| null | ❌ | 종료 날짜 (YYYY-MM-DD) |
| \`scheduledTime\` | string \\| null | ❌ | 예정 시간 (HH:mm) |
| \`isAllDay\` | boolean | ❌ | 종일 여부 (기본: true) |

### 📝 요청 예시
\`\`\`json
{
  "startDate": "2024-01-20",
  "endDate": "2024-01-21",
  "scheduledTime": "14:00",
  "isAllDay": false
}
\`\`\`

### ⚠️ 유효성 검사
- \`endDate\`는 \`startDate\` 이후여야 합니다
		`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError()
	@ApiNotFoundError(ErrorCode.TODO_0801)
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
			todo: this.mapToResponse(todo),
		};
	}

	@Patch(":id/content")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 제목/내용 수정",
		description: `
## ✏️ 할 일 제목/내용 수정

할 일의 제목 또는 내용을 수정합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`id\`: 할 일 고유 ID (숫자)

### 📋 요청 본문
| 필드 | 타입 | 설명 |
|------|------|------|
| \`title\` | string | 제목 (1-200자) |
| \`content\` | string \\| null | 내용 (최대 5000자) |

### 📝 요청 예시
\`\`\`json
{
  "title": "새로운 제목",
  "content": "새로운 내용"
}
\`\`\`

### ⚠️ 유효성 검사
- \`title\`과 \`content\` 중 최소 하나는 필수입니다
		`,
	})
	@ApiSuccessResponse({ type: UpdateTodoResponseDto })
	@ApiUnauthorizedError()
	@ApiNotFoundError(ErrorCode.TODO_0801)
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
			todo: this.mapToResponse(todo),
		};
	}

	// ============================================
	// 삭제
	// ============================================

	@Delete(":id")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "할 일 삭제",
		description: `
## 🗑️ 할 일 삭제

특정 할 일을 삭제합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`id\`: 할 일 고유 ID (숫자)

### ⚠️ 주의사항
- 삭제된 할 일은 복구할 수 없습니다
- 본인이 생성한 할 일만 삭제할 수 있습니다

### ⚠️ 에러 케이스
- \`TODO_NOT_FOUND\`: 존재하지 않거나 접근 권한이 없는 할 일
		`,
	})
	@ApiSuccessResponse({ type: DeleteTodoResponseDto })
	@ApiUnauthorizedError()
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiErrorResponse({ errorCode: ErrorCode.TODO_0801 })
	async delete(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoIdParamDto,
	): Promise<DeleteTodoResponseDto> {
		this.logger.debug(`Todo 삭제 요청: id=${params.id}, user=${user.userId}`);

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

	/**
	 * ISO 날짜 문자열에서 날짜 부분만 추출 (YYYY-MM-DD)
	 */
	private formatDate(date: Date): string {
		return date.toISOString().split("T")[0] ?? date.toISOString().slice(0, 10);
	}

	/**
	 * Prisma Todo 엔티티를 응답 DTO로 변환
	 */
	private mapToResponse(todo: {
		id: number;
		userId: string;
		title: string;
		content: string | null;
		color: string | null;
		completed: boolean;
		completedAt: Date | null;
		startDate: Date;
		endDate: Date | null;
		scheduledTime: Date | null;
		isAllDay: boolean;
		visibility: string;
		createdAt: Date;
		updatedAt: Date;
	}): TodoResponseDto {
		return {
			id: todo.id,
			userId: todo.userId,
			title: todo.title,
			content: todo.content,
			color: todo.color,
			completed: todo.completed,
			completedAt: todo.completedAt?.toISOString() ?? null,
			startDate: this.formatDate(todo.startDate),
			endDate: todo.endDate ? this.formatDate(todo.endDate) : null,
			scheduledTime: todo.scheduledTime?.toISOString() ?? null,
			isAllDay: todo.isAllDay,
			visibility: todo.visibility as "PUBLIC" | "PRIVATE",
			createdAt: todo.createdAt.toISOString(),
			updatedAt: todo.updatedAt.toISOString(),
		};
	}
}
