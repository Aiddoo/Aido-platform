import { ErrorCode } from "@aido/api/errors";
import { Controller, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiNotFoundError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";

import { GetTodoSeriesUseCase } from "../../../application/use-cases/get-todo-series.use-case.js";
import { toTodoSeriesResponse } from "./todo-series-response.mapper.js";
import { TodoSeriesIdParamDto, TodoSeriesResponseDto } from "./todo-series.dto.js";

@ApiTags(SWAGGER_TAGS.TODOS)
@ApiBearerAuth()
@Controller("todo-series")
export class TodoSeriesController {
  readonly #getTodoSeriesUseCase: GetTodoSeriesUseCase;

  constructor(getTodoSeriesUseCase: GetTodoSeriesUseCase) {
    this.#getTodoSeriesUseCase = getTodoSeriesUseCase;
  }

  @Get(":seriesId")
  @ApiDoc({
    summary: "반복 할 일 규칙 조회",
    operationId: "getTodoSeries",
    description: `편집 시트에서 반복 규칙을 불러올 때 씁니다. 할 일 응답의 \`recurrenceGroupId\`가 \`seriesId\`입니다.

**응답 필드**
- \`repeat\`: 반복 규칙
- \`nextOccurrenceDate\`: 다음에 만들 회차 날짜, 더 만들 회차가 없으면 null
- \`isActive\`: 더 만들 회차가 남았는지`,
  })
  @ApiSuccessResponse({ type: TodoSeriesResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0841)
  async findById(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoSeriesIdParamDto }) params: TodoSeriesIdParamDto,
  ): Promise<TodoSeriesResponseDto> {
    const series = await this.#getTodoSeriesUseCase.execute({
      seriesId: params.seriesId,
      userId: user.userId,
    });
    return toTodoSeriesResponse(series);
  }
}
