import type {
  CreateNudgeResponse,
  CreateRemindNudgeResponse,
  NudgeCooldownInfo as NudgeCooldownInfoDto,
  NudgeLimitInfo as NudgeLimitInfoDto,
} from '@aido/api';
import { toNullableInstant } from '@src/shared/date/instant';
import { pick } from 'es-toolkit';

import type {
  NudgeCooldownInfo,
  NudgeLimitInfo,
  SendTodoNudgeResult,
} from '../domains/todo-nudge.model';

export function toNudgeLimitInfo(dto: NudgeLimitInfoDto): NudgeLimitInfo {
  return pick(dto, ['dailyLimit', 'usedToday', 'remainingToday', 'isUnlimited']);
}

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
