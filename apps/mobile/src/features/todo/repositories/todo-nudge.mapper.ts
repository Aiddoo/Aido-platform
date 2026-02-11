import type {
  CreateNudgeResponse,
  NudgeCooldownInfo as NudgeCooldownInfoDTO,
  NudgeLimitInfo as NudgeLimitInfoDTO,
} from '@aido/validators';
import type { NudgeCooldownInfo, NudgeLimitInfo } from '../models/todo-nudge.model';
import type { SendNudgeResult } from './todo-nudge.repository';

export const toNudgeLimitInfo = (dto: NudgeLimitInfoDTO): NudgeLimitInfo => ({
  dailyLimit: dto.dailyLimit,
  usedToday: dto.usedToday,
  remainingToday: dto.remainingToday,
  isUnlimited: dto.isUnlimited,
});

export const toNudgeCooldownInfo = (dto: NudgeCooldownInfoDTO): NudgeCooldownInfo => ({
  canNudge: dto.canNudge,
  cooldownEndsAt: dto.cooldownEndsAt ? new Date(dto.cooldownEndsAt) : null,
  remainingSeconds: dto.remainingSeconds ?? null,
});

export const toSendNudgeResult = (dto: CreateNudgeResponse): SendNudgeResult => ({
  message: dto.message,
});
