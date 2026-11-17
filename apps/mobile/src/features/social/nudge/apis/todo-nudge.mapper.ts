import type {
  CreateNudgeResponse,
  CreateRemindNudgeResponse,
  NudgeCooldownInfo as NudgeCooldownInfoDto,
} from '@aido/api/contracts/nudge/v1';
import { toNullableInstant } from '@src/shared/date/instant';
import { pick } from 'es-toolkit';

import type { NudgeCooldownInfo, SendTodoNudgeResult } from '../domains/todo-nudge.model';

export function toNudgeCooldownInfo(dto: NudgeCooldownInfoDto): NudgeCooldownInfo {
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
