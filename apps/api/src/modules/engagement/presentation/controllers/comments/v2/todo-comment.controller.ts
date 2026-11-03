import { ErrorCode } from "@aido/api/errors";
import { Controller, Get, Header, Headers, HttpStatus, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import {
  ApiDoc,
  ApiErrorCodesResponse,
  ApiNotFoundError,
  ApiSuccessResponse,
  ApiUnauthorizedError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";

import {
  toTodoCommentRepliesResponse,
  toTodoCommentThreadsResponse,
} from "../../../../application/presenters/comments/v2/index.js";
import { GetTodoCommentReplies } from "../../../../application/use-cases/comments/get-todo-comment-replies.use-case.js";
import {
  GetTodoCommentThreads,
  type GetTodoCommentThreadsPage,
} from "../../../../application/use-cases/comments/get-todo-comment-threads.use-case.js";
import { TodoCommentV2Mapper } from "../../../mappers/comments/v2/todo-comment.mapper.js";
import { TodoCommentIdParamDto, TodoDetailsParamDto } from "../../../schemas/comments/v1/index.js";
import {
  GetTodoCommentRepliesQueryDto,
  GetTodoCommentThreadsQueryDto,
  TodoCommentRepliesResponseDto,
  TodoCommentThreadsResponseDto,
} from "../../../schemas/comments/v2/index.js";

function toThreadsPage(query: GetTodoCommentThreadsQueryDto): GetTodoCommentThreadsPage {
  if (query.cursor != null) {
    return { kind: "CURSOR", cursor: query.cursor };
  }

  if (query.anchorCommentId != null) {
    return { kind: "ANCHOR", commentId: query.anchorCommentId };
  }

  return { kind: "FIRST" };
}

@ApiTags(SWAGGER_TAGS.TODO_COMMENTS_V2)
@ApiBearerAuth()
@Controller({ path: "todos/:todoId/comments", version: API_VERSION.V2 })
export class TodoCommentV2Controller {
  constructor(
    private readonly getTodoCommentThreads: GetTodoCommentThreads,
    private readonly getTodoCommentReplies: GetTodoCommentReplies,
  ) {}

  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @Get()
  @ApiDoc({
    summary: "할 일 댓글 묶음 목록 조회",
    operationId: "getTodoCommentThreads",
    description: `
댓글(묶음 머리)마다 대표 답글 1개와 답글 요약을 함께 돌려줍니다.

### 동작
- 정렬은 \`sort\`(LATEST·POPULAR)이고, 인기순은 첫 페이지에서 정한 순위를 cursor가 이어받습니다.
- 대표 답글은 할 일 주인의 답글을 먼저, 없으면 가장 먼저 쓴 답글입니다.
- 답글이 남은 삭제 댓글은 묘비(\`isDeleted: true\`)로 남고, 답글도 없으면 목록에서 빠집니다.
- \`anchorCommentId\`를 주면 그 글이 속한 묶음이 든 페이지를 주고 \`anchor\`에 위치를 싣습니다. 찾지 못하거나 지운 글이면 오류 없이 첫 페이지와 \`anchor: null\`입니다.
- \`cursor\`는 \`pagination.previousCursor\`·\`nextCursor\`를 그대로 보냅니다(방향이 cursor에 담겨 있습니다).
`,
  })
  @ApiSuccessResponse({ type: TodoCommentThreadsResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  async getThreads(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoDetailsParamDto }) params: TodoDetailsParamDto,
    @Query({ schema: GetTodoCommentThreadsQueryDto }) query: GetTodoCommentThreadsQueryDto,
    @Headers("x-app-version") appVersion?: string,
  ): Promise<TodoCommentThreadsResponseDto> {
    const result = await this.getTodoCommentThreads.execute({
      todoId: params.todoId,
      viewerId: user.userId,
      sort: query.sort,
      size: query.size,
      page: toThreadsPage(query),
    });
    return TodoCommentV2Mapper.toThreads(toTodoCommentThreadsResponse(result), appVersion);
  }

  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @Get(":commentId/replies")
  @ApiDoc({
    summary: "댓글 묶음의 답글 목록 조회",
    operationId: "getTodoCommentReplies",
    description: `
한 댓글 묶음의 답글을 작성 순서로 돌려줍니다.

### 동작
- \`commentId\`는 묶음 머리 댓글이어야 합니다. 답글 ID면 \`TODO_0831\`입니다.
- 지운 답글은 빠집니다. 답글에 단 답글은 \`replyTo\`로 대상을 알려 줍니다.
- \`aroundReplyId\`를 주면 그 답글이 든 페이지를 줍니다. 찾지 못하면 첫 페이지입니다.
`,
  })
  @ApiSuccessResponse({ type: TodoCommentRepliesResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0831])
  async getReplies(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCommentIdParamDto }) params: TodoCommentIdParamDto,
    @Query({ schema: GetTodoCommentRepliesQueryDto }) query: GetTodoCommentRepliesQueryDto,
    @Headers("x-app-version") appVersion?: string,
  ): Promise<TodoCommentRepliesResponseDto> {
    const result = await this.getTodoCommentReplies.execute({
      todoId: params.todoId,
      viewerId: user.userId,
      threadCommentId: params.commentId,
      size: query.size,
      cursor: query.cursor,
      aroundReplyId: query.aroundReplyId,
    });
    return TodoCommentV2Mapper.toReplies(toTodoCommentRepliesResponse(result), appVersion);
  }
}
