import type {
  CreateNudgeResponse,
  CreateRemindNudgeResponse,
  NudgeCooldownInfo as NudgeCooldownDto,
} from '@aido/api/contracts/nudge/v1';
import { toNullableInstant } from '@src/shared/date/instant';
import { toOptionalText } from '@src/shared/utils/to-optional-text';
import { pick } from 'es-toolkit';

import type { NudgeCooldown } from '../domains/nudge-cooldown.model';
import type { SendTodoNudgeResult } from '../domains/todo-nudge.model';
import type { CreateNudgeInput, CreateRemindNudgeInput } from '../schemas/nudge-request.schema';

export function toNudgeCooldown(dto: NudgeCooldownDto): NudgeCooldown {
  return {
    ...pick(dto, ['canNudge', 'remainingSeconds']),
    cooldownEndsAt: toNullableInstant(dto.cooldownEndsAt),
  };
}

export function toSendNudgeResult(dto: CreateNudgeResponse): SendTodoNudgeResult {
  return pick(dto, ['message']);
}

export function toSendRemindNudgeResult(dto: CreateRemindNudgeResponse): SendTodoNudgeResult {
  return pick(dto, ['message']);
}

export function toCreateNudgeRequest(input: CreateNudgeInput): CreateNudgeInput {
  return {
    receiverId: input.receiverId,
    todoId: input.todoId,
    message: toOptionalText(input.message),
  };
}

export function toCreateRemindNudgeRequest(input: CreateRemindNudgeInput): CreateRemindNudgeInput {
  return { receiverId: input.receiverId, message: toOptionalText(input.message) };
}
