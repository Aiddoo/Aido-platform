import { ErrorCode } from "@aido/api/errors";
import { TODO_REMINDER_SNOOZE_MINUTES } from "@aido/api/vocabulary";
import { Body, Controller, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/sessions/identity-sessions.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiConflictError,
  ApiNotFoundError,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { RateLimit } from "#api/platform/throttle/rate-limits";
import { THROTTLED_DESCRIPTION } from "#api/platform/throttle/throttle.constants";

import { SnoozeTodoReminderUseCase } from "../../../application/use-cases/snooze-todo-reminder.use-case.js";
import { ReminderRateLimits } from "../reminders.rate-limits.js";
import { toTodoReminderSnoozeResponse } from "./todo-reminder-response.mapper.js";
import {
  SnoozeTodoReminderDto,
  TodoReminderParamDto,
  TodoReminderSnoozeResponseDto,
} from "./todo-reminder.dto.js";

@ApiTags(SWAGGER_TAGS.NOTIFICATIONS)
@ApiBearerAuth()
@Controller({ path: "todo-reminders", version: API_VERSION.V1 })
export class TodoReminderController {
  readonly #snoozeTodoReminder: SnoozeTodoReminderUseCase;

  constructor(snoozeTodoReminder: SnoozeTodoReminderUseCase) {
    this.#snoozeTodoReminder = snoozeTodoReminder;
  }

  @Post(":todoId/snoozes")
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit(ReminderRateLimits.snoozeTodoReminder)
  @ApiDoc({
    summary: "리마인드 알림 다시 받기",
    operationId: "snoozeTodoReminder",
    description: `리마인드 알림의 [${TODO_REMINDER_SNOOZE_MINUTES}분 뒤 다시] 버튼입니다. 지금부터 ${TODO_REMINDER_SNOOZE_MINUTES}분 뒤에 같은 할 일의 리마인드 알림을 한 번 더 보냅니다.

- 내 할 일이고 아직 완료하지 않았을 때만 예약합니다. 없거나 남의 할 일은 TODO_0801, 완료한 할 일은 NOTIFICATION_1007입니다.
- 같은 \`notificationId\`로 다시 보내도 예약은 하나입니다. 다시 온 알림에서 또 누르면 그 알림으로 한 번 더 예약합니다.
- 보낼 때 할 일을 다시 봐서 그사이 완료하거나 지웠으면 보내지 않습니다. 야간·푸시 설정·기기 권한은 다른 리마인드 알림과 같습니다.
- 사용자마다 1분에 10번, 하루 200번까지 받습니다.`,
  })
  @ApiSuccessResponse({ type: TodoReminderSnoozeResponseDto, status: HttpStatus.ACCEPTED })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  @ApiConflictError(ErrorCode.NOTIFICATION_1007)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async snooze(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoReminderParamDto }) params: TodoReminderParamDto,
    @Body({ schema: SnoozeTodoReminderDto }) dto: SnoozeTodoReminderDto,
  ): Promise<TodoReminderSnoozeResponseDto> {
    const snooze = await this.#snoozeTodoReminder.execute({
      userId: user.userId,
      todoId: params.todoId,
      notificationId: dto.notificationId,
    });
    return toTodoReminderSnoozeResponse(snooze);
  }
}
