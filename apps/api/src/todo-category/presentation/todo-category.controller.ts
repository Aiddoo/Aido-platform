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
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
	ApiBadRequestError,
	ApiConflictError,
	ApiCreatedResponse,
	ApiDoc,
	ApiForbiddenError,
	ApiNotFoundError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/shared/presentation/swagger";

import {
	CurrentUser,
	type CurrentUserPayload,
} from "../../auth/presentation/decorators";
import { TodoCategoryReader } from "../application/services/todo-category.reader";
import { CreateTodoCategoryUseCase } from "../application/use-cases/create-todo-category/create-todo-category.use-case";
import { DeleteTodoCategoryUseCase } from "../application/use-cases/delete-todo-category/delete-todo-category.use-case";
import { ReorderTodoCategoryUseCase } from "../application/use-cases/reorder-todo-category/reorder-todo-category.use-case";
import { UpdateTodoCategoryUseCase } from "../application/use-cases/update-todo-category/update-todo-category.use-case";
import {
	CreateTodoCategoryDto,
	CreateTodoCategoryResponseDto,
	DeleteTodoCategoryQueryDto,
	DeleteTodoCategoryResponseDto,
	ReorderTodoCategoryDto,
	ReorderTodoCategoryResponseDto,
	TodoCategoryIdParamDto,
	TodoCategoryListResponseDto,
	TodoCategoryResourceLimitResponseDto,
	TodoCategoryResponseDto,
	UpdateTodoCategoryDto,
	UpdateTodoCategoryResponseDto,
} from "./dtos";
import { TodoCategoryMapper } from "./todo-category.mapper";

@ApiTags(SWAGGER_TAGS.TODO_CATEGORIES)
@ApiBearerAuth()
@Controller("todo-categories")
export class TodoCategoryController {
	readonly #logger = new Logger(TodoCategoryController.name);

	constructor(
		private readonly todoCategoryReader: TodoCategoryReader,
		private readonly createTodoCategoryUseCase: CreateTodoCategoryUseCase,
		private readonly updateTodoCategoryUseCase: UpdateTodoCategoryUseCase,
		private readonly reorderTodoCategoryUseCase: ReorderTodoCategoryUseCase,
		private readonly deleteTodoCategoryUseCase: DeleteTodoCategoryUseCase,
	) {}

	@Get("resource-limit")
	@ApiDoc({
		summary: "카테고리 리소스 제한 정보 조회",
		operationId: "getTodoCategoryResourceLimit",
		description: `현재 카테고리 개수와 최대 한도를 조회합니다.

**응답 필드**
- \`categoryCount\`: 현재 카테고리 개수
- \`maxCount\`: 최대 한도 (null이면 무제한)`,
	})
	@ApiSuccessResponse({ type: TodoCategoryResourceLimitResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getResourceLimit(
		@CurrentUser() user: CurrentUserPayload,
	): Promise<TodoCategoryResourceLimitResponseDto> {
		return this.todoCategoryReader.getResourceLimitInfo(user.userId);
	}

	@Post()
	@ApiDoc({
		summary: "카테고리 생성",
		operationId: "createTodoCategory",
		description: `새로운 할 일 카테고리를 생성합니다.

## 필수 필드
| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| \`name\` | string | 1-50자 | 카테고리명 (사용자별 중복 불가) |
| \`color\` | string | HEX | 색상 코드 (#RRGGBB) |

## 동작 방식
- 새 카테고리는 목록 맨 끝에 추가됩니다 (sortOrder 자동 부여)
- 같은 이름의 카테고리가 이미 존재하면 \`409 Conflict\` 에러 반환`,
	})
	@ApiCreatedResponse({ type: CreateTodoCategoryResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	@ApiConflictError(ErrorCode.TODO_CATEGORY_0853)
	@ApiForbiddenError(ErrorCode.TODO_CATEGORY_0857)
	async create(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: CreateTodoCategoryDto,
	): Promise<CreateTodoCategoryResponseDto> {
		this.#logger.debug(`카테고리 생성: user=${user.userId}, name=${dto.name}`);

		const category = await this.createTodoCategoryUseCase.execute({
			userId: user.userId,
			name: dto.name,
			color: dto.color,
		});

		this.#logger.log(
			`카테고리 생성 완료: id=${category.id}, user=${user.userId}`,
		);

		return {
			message: "카테고리가 생성되었습니다.",
			category: TodoCategoryMapper.toResponse(category),
		};
	}

	@Get()
	@ApiDoc({
		summary: "카테고리 목록 조회",
		operationId: "getTodoCategories",
		description: `사용자의 모든 카테고리 목록을 조회합니다.

## 응답 데이터
- 각 카테고리에 \`todoCount\` (해당 카테고리의 할 일 개수) 포함
- \`sortOrder\` 오름차순으로 정렬됨

## 기본 카테고리
회원가입 시 자동 생성되는 기본 카테고리:
- **중요한 일** (\`#FFB3B3\`, 빨간색 파스텔톤)
- **할 일** (\`#FF6B43\`, 앱 메인 주황색)`,
	})
	@ApiSuccessResponse({ type: TodoCategoryListResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async findAll(
		@CurrentUser() user: CurrentUserPayload,
	): Promise<TodoCategoryListResponseDto> {
		this.#logger.debug(`카테고리 목록 조회: user=${user.userId}`);

		const categories = await this.todoCategoryReader.findMany(user.userId);

		return {
			items: TodoCategoryMapper.toManyResponseWithCount(categories),
		};
	}

	@Get(":id")
	@ApiDoc({
		summary: "카테고리 상세 조회",
		operationId: "getTodoCategory",
		description: `특정 카테고리의 상세 정보를 조회합니다.

## 응답 데이터
- \`todoCount\`: 해당 카테고리의 할 일 개수 포함`,
	})
	@ApiSuccessResponse({ type: TodoCategoryResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_CATEGORY_0851)
	@ApiForbiddenError(ErrorCode.TODO_CATEGORY_0852)
	async findOne(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoCategoryIdParamDto,
	): Promise<TodoCategoryResponseDto> {
		this.#logger.debug(`카테고리 조회: id=${params.id}, user=${user.userId}`);

		const category = await this.todoCategoryReader.findById(
			params.id,
			user.userId,
		);

		return {
			category: TodoCategoryMapper.toResponseWithCount(category),
		};
	}

	@Patch(":id")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "카테고리 수정",
		operationId: "updateTodoCategory",
		description: `카테고리의 이름 또는 색상을 수정합니다.

## 수정 가능한 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| \`name\` | string | 카테고리명 (1-50자, 중복 불가) |
| \`color\` | string | 색상 코드 (#RRGGBB) |

## 주의사항
- 이름 변경 시 동일한 이름의 카테고리가 이미 존재하면 \`409 Conflict\` 에러`,
	})
	@ApiSuccessResponse({ type: UpdateTodoCategoryResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_CATEGORY_0851)
	@ApiConflictError(ErrorCode.TODO_CATEGORY_0853)
	async update(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoCategoryIdParamDto,
		@Body() dto: UpdateTodoCategoryDto,
	): Promise<UpdateTodoCategoryResponseDto> {
		this.#logger.debug(`카테고리 수정: id=${params.id}, user=${user.userId}`);

		const category = await this.updateTodoCategoryUseCase.execute(
			params.id,
			user.userId,
			dto,
		);

		this.#logger.log(`카테고리 수정 완료: id=${params.id}`);

		return {
			message: "카테고리가 수정되었습니다.",
			category: TodoCategoryMapper.toResponse(category),
		};
	}

	@Patch(":id/reorder")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "카테고리 순서 변경",
		operationId: "reorderTodoCategory",
		description: `특정 카테고리를 다른 카테고리의 앞 또는 뒤로 이동합니다.
드래그 앤 드롭으로 카테고리 순서를 변경할 때 사용합니다.

## 동작 방식
1. \`targetCategoryId\`: 기준이 되는 카테고리 ID
2. \`position\`: 기준 카테고리의 앞(\`before\`) 또는 뒤(\`after\`)로 이동

## 예시
현재 순서: [중요한 일, 할 일, 공부] (sortOrder: 0, 1, 2)

### Case 1: 공부를 중요한 일 앞으로 이동
- Request: \`{ targetCategoryId: 1, position: "before" }\`
- 결과: [공부, 중요한 일, 할 일]

### Case 2: 중요한 일을 할 일 뒤로 이동
- Request: \`{ targetCategoryId: 2, position: "after" }\`
- 결과: [할 일, 중요한 일, 공부]

### Case 3: 맨 처음으로 이동 (targetCategoryId 없이)
- Request: \`{ position: "before" }\`
- 결과: 해당 카테고리가 맨 앞으로 이동

### Case 4: 맨 끝으로 이동 (targetCategoryId 없이)
- Request: \`{ position: "after" }\`
- 결과: 해당 카테고리가 맨 뒤로 이동

## 주의사항
- 자기 자신을 targetCategoryId로 지정하면 무시 (변경 없음)`,
	})
	@ApiSuccessResponse({ type: ReorderTodoCategoryResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_CATEGORY_0851)
	async reorder(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoCategoryIdParamDto,
		@Body() dto: ReorderTodoCategoryDto,
	): Promise<ReorderTodoCategoryResponseDto> {
		this.#logger.debug(
			`카테고리 순서 변경: id=${params.id}, target=${dto.targetCategoryId}, position=${dto.position}`,
		);

		const category = await this.reorderTodoCategoryUseCase.execute({
			userId: user.userId,
			categoryId: params.id,
			targetCategoryId: dto.targetCategoryId,
			position: dto.position,
		});

		this.#logger.log(`카테고리 순서 변경 완료: id=${params.id}`);

		return {
			message: "카테고리 순서가 변경되었습니다.",
			category: TodoCategoryMapper.toResponse(category),
		};
	}

	@Delete(":id")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "카테고리 삭제",
		operationId: "deleteTodoCategory",
		description: `카테고리를 삭제합니다.

## 삭제 규칙
1. **최소 1개의 카테고리 필요**: 마지막 남은 카테고리는 삭제할 수 없습니다.
2. **할 일 이동 필수**: 카테고리에 할 일이 있으면 \`moveToCategoryId\` 쿼리 파라미터로 이동 대상 카테고리를 지정해야 합니다.

## 사용 예시

### 할 일이 없는 카테고리 삭제
\`\`\`
DELETE /todo-categories/3
\`\`\`

### 할 일이 있는 카테고리 삭제 (다른 카테고리로 이동)
\`\`\`
DELETE /todo-categories/3?moveToCategoryId=1
\`\`\`

## 에러 케이스
| 상황 | 에러 코드 | 메시지 |
|------|-----------|--------|
| 마지막 카테고리 삭제 시도 | \`TODO_CATEGORY_0854\` | 최소 1개의 카테고리가 필요합니다 |
| 할 일이 있는데 moveToCategoryId 없음 | \`TODO_CATEGORY_0855\` | 카테고리에 할 일이 있습니다 (details에 todoCount 포함) |
| moveToCategoryId가 삭제 대상과 같음 | \`SYS_0002\` | 삭제할 카테고리와 이동 대상 카테고리가 같을 수 없습니다 |
| moveToCategoryId 카테고리 없음 | \`TODO_CATEGORY_0851\` | 카테고리를 찾을 수 없습니다 |`,
	})
	@ApiSuccessResponse({ type: DeleteTodoCategoryResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_CATEGORY_0851)
	@ApiBadRequestError(ErrorCode.TODO_CATEGORY_0854)
	@ApiBadRequestError(ErrorCode.TODO_CATEGORY_0855)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	async delete(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoCategoryIdParamDto,
		@Query() query: DeleteTodoCategoryQueryDto,
	): Promise<DeleteTodoCategoryResponseDto> {
		this.#logger.debug(
			`카테고리 삭제: id=${params.id}, moveTo=${query.moveToCategoryId}`,
		);

		await this.deleteTodoCategoryUseCase.execute({
			userId: user.userId,
			categoryId: params.id,
			moveToCategoryId: query.moveToCategoryId,
		});

		this.#logger.log(`카테고리 삭제 완료: id=${params.id}`);

		return {
			message: "카테고리가 삭제되었습니다.",
		};
	}
}
