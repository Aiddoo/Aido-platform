import type { CreateNudgeResponse, CreateRemindNudgeResponse } from '@aido/api';
import { toInstant } from '@src/shared/date/instant';
import { pick } from 'es-toolkit';

import type {
  NudgeCooldownInfo,
  NudgeLimitInfo,
  SendTodoNudgeResult,
} from '../schemas/todo-nudge.schema';

export function toNudgeLimitInfo(dto: NudgeLimitInfo): NudgeLimitInfo {
  return pick(dto, ['dailyLimit', 'usedToday', 'remainingToday', 'isUnlimited']);
}

export function toNudgeCooldownInfo(
  dto: Omit<NudgeCooldownInfo, 'cooldownEndsAt'> & { cooldownEndsAt: string | null },
): NudgeCooldownInfo {
  return {
    ...pick(dto, ['canNudge', 'remainingSeconds']),
    cooldownEndsAt: dto.cooldownEndsAt == null ? null : toInstant(dto.cooldownEndsAt),
  };
}

export function toSendNudgeResult(dto: CreateNudgeResponse): SendTodoNudgeResult {
  return pick(dto, ['message']);
}

export function toSendRemindNudgeResult(dto: CreateRemindNudgeResponse): SendTodoNudgeResult {
  return pick(dto, ['message']);
}
