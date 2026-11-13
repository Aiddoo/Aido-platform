import { ErrorCode } from "@aido/api/errors";
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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiConflictError,
  ApiErrorCodesResponse,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import {
  ApiCreatedSuccessResponse,
  ApiSuccessResponse,
} from "#api/platform/http/swagger/decorators/api-response.decorator";

import { CreateTodoCategoryUseCase } from "../../../application/use-cases/create-todo-category.use-case.js";
import { DeleteTodoCategoryUseCase } from "../../../application/use-cases/delete-todo-category.use-case.js";
import { GetTodoCategoryDeletionPreviewUseCase } from "../../../application/use-cases/get-todo-category-deletion-preview.use-case.js";
import { GetTodoCategoryResourceLimitUseCase } from "../../../application/use-cases/get-todo-category-resource-limit.use-case.js";
import { GetTodoCategoryUseCase } from "../../../application/use-cases/get-todo-category.use-case.js";
import { ListTodoCategoriesUseCase } from "../../../application/use-cases/list-todo-categories.use-case.js";
import { ReorderTodoCategoryUseCase } from "../../../application/use-cases/reorder-todo-category.use-case.js";
import { UpdateTodoCategoryUseCase } from "../../../application/use-cases/update-todo-category.use-case.js";
import { TodoCategoryMapper } from "./todo-category-response.mapper.js";
import {
  CreateTodoCategoryDto,
  CreateTodoCategoryResponseDto,
  DeleteTodoCategoryQueryDto,
  DeleteTodoCategoryResponseDto,
  ReorderTodoCategoryDto,
  ReorderTodoCategoryResponseDto,
  TodoCategoryDeletionPreviewDto,
  TodoCategoryIdParamDto,
  TodoCategoryListResponseDto,
  TodoCategoryResourceLimitResponseDto,
  TodoCategoryResponseDto,
  UpdateTodoCategoryDto,
  UpdateTodoCategoryResponseDto,
} from "./todo-category.dto.js";

@ApiTags(SWAGGER_TAGS.TODO_CATEGORIES)
@ApiBearerAuth()
@Controller("todo-categories")
export class TodoCategoryController {
  readonly #getTodoCategoriesUseCase: ListTodoCategoriesUseCase;
  readonly #getTodoCategoryUseCase: GetTodoCategoryUseCase;
  readonly #getTodoCategoryDeletionPreviewUseCase: GetTodoCategoryDeletionPreviewUseCase;
  readonly #getTodoCategoryResourceLimitUseCase: GetTodoCategoryResourceLimitUseCase;
  readonly #createTodoCategoryUseCase: CreateTodoCategoryUseCase;
  readonly #updateTodoCategoryUseCase: UpdateTodoCategoryUseCase;
  readonly #reorderTodoCategoryUseCase: ReorderTodoCategoryUseCase;
  readonly #deleteTodoCategoryUseCase: DeleteTodoCategoryUseCase;

  constructor(
    getTodoCategoriesUseCase: ListTodoCategoriesUseCase,
    getTodoCategoryUseCase: GetTodoCategoryUseCase,
    getTodoCategoryResourceLimitUseCase: GetTodoCategoryResourceLimitUseCase,
    createTodoCategoryUseCase: CreateTodoCategoryUseCase,
    updateTodoCategoryUseCase: UpdateTodoCategoryUseCase,
    reorderTodoCategoryUseCase: ReorderTodoCategoryUseCase,
    deleteTodoCategoryUseCase: DeleteTodoCategoryUseCase,
    getTodoCategoryDeletionPreviewUseCase: GetTodoCategoryDeletionPreviewUseCase,
  ) {
    this.#getTodoCategoriesUseCase = getTodoCategoriesUseCase;
    this.#getTodoCategoryUseCase = getTodoCategoryUseCase;
    this.#getTodoCategoryDeletionPreviewUseCase = getTodoCategoryDeletionPreviewUseCase;
    this.#getTodoCategoryResourceLimitUseCase = getTodoCategoryResourceLimitUseCase;
    this.#createTodoCategoryUseCase = createTodoCategoryUseCase;
    this.#updateTodoCategoryUseCase = updateTodoCategoryUseCase;
    this.#reorderTodoCategoryUseCase = reorderTodoCategoryUseCase;
    this.#deleteTodoCategoryUseCase = deleteTodoCategoryUseCase;
  }

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
    return this.#getTodoCategoryResourceLimitUseCase.execute({ userId: user.userId });
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
  @ApiCreatedSuccessResponse({ type: CreateTodoCategoryResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiConflictError(ErrorCode.TODO_CATEGORY_0853)
  @ApiForbiddenError(ErrorCode.TODO_CATEGORY_0857)
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: CreateTodoCategoryDto }) dto: CreateTodoCategoryDto,
  ): Promise<CreateTodoCategoryResponseDto> {
    const category = await this.#createTodoCategoryUseCase.execute({
      userId: user.userId,
      name: dto.name,
      color: dto.color,
    });

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
회원가입 시 자동 생성되는 기본 카테고리(이름은 가입 요청의 Accept-Language로 한 번 정한다. en은 Important·To-do, 그 밖은 아래 이름):
- **중요한 일** (\`#FFB3B3\`, 빨간색 파스텔톤)
- **할 일** (\`#FF6B43\`, 앱 메인 주황색)`,
  })
  @ApiSuccessResponse({ type: TodoCategoryListResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async findAll(@CurrentUser() user: CurrentUserPayload): Promise<TodoCategoryListResponseDto> {
    const categories = await this.#getTodoCategoriesUseCase.execute({ userId: user.userId });

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
    @Param({ schema: TodoCategoryIdParamDto }) params: TodoCategoryIdParamDto,
  ): Promise<TodoCategoryResponseDto> {
    const category = await this.#getTodoCategoryUseCase.execute({
      id: params.id,
      userId: user.userId,
    });

    return {
      category: TodoCategoryMapper.toResponseWithCount(category),
    };
  }

  @Get(":id/deletion-preview")
  @ApiDoc({
    summary: "카테고리 삭제 미리보기",
    operationId: "getTodoCategoryDeletionPreview",
    description: `카테고리를 지우기 전에 안의 할 일을 옮길지 함께 지울지 고르는 데 필요한 수를 조회합니다.
삭제(\`DELETE /todo-categories/{id}\`)와 같은 기준으로 셉니다.

## 응답 필드
- \`todoCount\`: 카테고리 안의 할 일 수 (완료 포함, 목록의 \`todoCount\`와 같은 값)
- \`completedTodoCount\`: 그중 완료한 할 일 수. 함께 삭제하면 날짜별 완료 기록에서도 빠집니다
- \`activeSeriesCount\`: 진행 중 반복 규칙 수. 할 일이 0이어도 이 값이 있으면 옮기거나 함께 지울지 골라야 합니다
- \`isLastCategory\`: 마지막 남은 카테고리면 \`true\`이고 삭제할 수 없습니다(\`TODO_CATEGORY_0854\`)`,
  })
  @ApiSuccessResponse({ type: TodoCategoryDeletionPreviewDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_CATEGORY_0851)
  async getDeletionPreview(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCategoryIdParamDto }) params: TodoCategoryIdParamDto,
  ): Promise<TodoCategoryDeletionPreviewDto> {
    const preview = await this.#getTodoCategoryDeletionPreviewUseCase.execute({
      userId: user.userId,
      categoryId: params.id,
    });

    return TodoCategoryMapper.toDeletionPreview(preview);
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
    @Param({ schema: TodoCategoryIdParamDto }) params: TodoCategoryIdParamDto,
    @Body({ schema: UpdateTodoCategoryDto }) dto: UpdateTodoCategoryDto,
  ): Promise<UpdateTodoCategoryResponseDto> {
    const category = await this.#updateTodoCategoryUseCase.execute({
      id: params.id,
      userId: user.userId,
      data: dto,
    });

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
    @Param({ schema: TodoCategoryIdParamDto }) params: TodoCategoryIdParamDto,
    @Body({ schema: ReorderTodoCategoryDto }) dto: ReorderTodoCategoryDto,
  ): Promise<ReorderTodoCategoryResponseDto> {
    const category = await this.#reorderTodoCategoryUseCase.execute({
      userId: user.userId,
      categoryId: params.id,
      targetCategoryId: dto.targetCategoryId,
      position: dto.position,
    });

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
    description: `카테고리를 삭제합니다. 안에 할 일(완료 포함)이나 진행 중 반복이 있으면 옮길지 함께 지울지 고릅니다.
지우기 전에 \`GET /todo-categories/{id}/deletion-preview\`로 할 일·완료·반복 수를 보여 줄 수 있습니다.

## 삭제 규칙
1. **최소 1개의 카테고리 필요**: 마지막 남은 카테고리는 삭제할 수 없습니다.
2. **안의 할 일 처리** (\`todoHandling\`, 선택)
   - \`move\`: \`moveToCategoryId\`(필수)로 할 일과 반복 규칙을 옮긴 뒤 삭제합니다.
   - \`delete\`: 할 일·하위 항목·댓글·반복 규칙을 함께 삭제합니다. \`moveToCategoryId\`를 함께 보내면 \`400\`입니다. 완료한 할 일도 지워져 날짜별 완료 기록에서 빠집니다.
   - 생략(1.15.0까지 앱): 할 일이 있으면 \`moveToCategoryId\`로 옮깁니다. 없으면 \`TODO_CATEGORY_0855\`입니다.
3. 할 일과 진행 중 반복이 없으면 \`todoHandling\`·\`moveToCategoryId\`와 상관없이 바로 삭제합니다(\`result.todoHandling = none\`).

## 사용 예시
\`\`\`
DELETE /todo-categories/3
DELETE /todo-categories/3?moveToCategoryId=1
DELETE /todo-categories/3?todoHandling=move&moveToCategoryId=1
DELETE /todo-categories/3?todoHandling=delete
\`\`\`

## 응답
- \`result\`: 실제로 한 처리(\`move\`·\`delete\`·\`none\`), 옮기거나 지운 할 일 수(\`todoCount\`), 진행 중 반복 수(\`seriesCount\`), 옮긴 카테고리(\`moveToCategoryId\`)

## 에러 케이스
| 상황 | 에러 코드 | 메시지 |
|------|-----------|--------|
| 마지막 카테고리 삭제 시도 | \`TODO_CATEGORY_0854\` | 최소 1개의 카테고리가 필요합니다 |
| 할 일이 있는데 moveToCategoryId 없음 | \`TODO_CATEGORY_0855\` | 카테고리에 할 일이 있습니다 (details에 todoCount 포함) |
| moveToCategoryId가 삭제 대상과 같음 | \`SYS_0002\` | 삭제할 카테고리와 이동 대상 카테고리가 같을 수 없습니다 |
| move인데 moveToCategoryId 없음, delete인데 moveToCategoryId 있음 | \`SYS_0002\` | 입력 검증 실패 |
| moveToCategoryId 카테고리 없음 | \`TODO_CATEGORY_0851\` | 카테고리를 찾을 수 없습니다 |`,
  })
  @ApiSuccessResponse({ type: DeleteTodoCategoryResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_CATEGORY_0851)
  @ApiErrorCodesResponse(HttpStatus.BAD_REQUEST, [
    ErrorCode.TODO_CATEGORY_0854,
    ErrorCode.TODO_CATEGORY_0855,
  ])
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCategoryIdParamDto }) params: TodoCategoryIdParamDto,
    @Query({ schema: DeleteTodoCategoryQueryDto }) query: DeleteTodoCategoryQueryDto,
  ): Promise<DeleteTodoCategoryResponseDto> {
    const deletion = await this.#deleteTodoCategoryUseCase.execute({
      userId: user.userId,
      categoryId: params.id,
      moveToCategoryId: query.moveToCategoryId,
      todoHandling: query.todoHandling,
    });

    return {
      message: "카테고리가 삭제되었습니다.",
      result: TodoCategoryMapper.toDeletionResult(deletion),
    };
  }
}
