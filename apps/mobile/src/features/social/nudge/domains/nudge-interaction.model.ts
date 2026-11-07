import type { TodoVisibility } from '@aido/api/vocabulary';
import { match } from 'ts-pattern';

import type {
  NudgeInteraction,
  NudgeInteractionStatus,
  NudgeThanksPreview,
  NudgeThanksSummaryState,
} from '../schemas/nudge-interaction.schema';

interface NudgeThanksSummary {
  state: NudgeThanksSummaryState;
  pendingRecipientCount: number;
}

function getNudgeInteractionStatus(
  nudge: Pick<NudgeInteraction, 'isAvailable' | 'isTodoCompleted' | 'replyKind' | 'thankedAt'>,
): NudgeInteractionStatus {
  return match({
    isAvailable: nudge.isAvailable,
    isTodoCompleted: nudge.isTodoCompleted,
    hasReply: nudge.replyKind != null,
    isThanked: nudge.thankedAt != null,
  })
    .returnType<NudgeInteractionStatus>()
    .with({ isAvailable: false }, () => 'UNAVAILABLE')
    .with({ isThanked: true }, () => 'THANKED')
    .with({ isTodoCompleted: true }, () => 'COMPLETED')
    .with({ hasReply: true }, () => 'REPLIED')
    .with({ hasReply: false }, () => 'WAITING')
    .exhaustive();
}

/** 고맙다는 인사는 완료한 공개 할 일의 주인만 받는다. 할 일은 주인만 고칠 수 있어 수정 권한으로 주인을 안다 */
function canThankTodo(
  todo: { completed: boolean; visibility: TodoVisibility },
  { canEditTodo }: { canEditTodo: boolean },
): boolean {
  return canEditTodo && todo.completed && todo.visibility === 'PUBLIC';
}

function isReceivedBy(nudge: Pick<NudgeInteraction, 'receiverId'>, userId: string): boolean {
  return nudge.receiverId === userId;
}

function canReply(
  nudge: Pick<NudgeInteraction, 'receiverId' | 'isAvailable'>,
  userId: string,
): boolean {
  return isReceivedBy(nudge, userId) && nudge.isAvailable;
}

function hasThankableRecipients(
  preview: Pick<NudgeThanksPreview, 'throughNudgeId' | 'recipients'>,
): boolean {
  return preview.throughNudgeId != null && preview.recipients.length > 0;
}

function getThanksSummary(
  preview: Pick<
    NudgeThanksPreview,
    'throughNudgeId' | 'recipients' | 'totalRecipients' | 'thankedRecipientCount'
  >,
): NudgeThanksSummary {
  const pendingRecipientCount = hasThankableRecipients(preview) ? preview.totalRecipients : 0;
  const state = match({
    hasPending: pendingRecipientCount > 0,
    hasThanked: preview.thankedRecipientCount > 0,
  })
    .returnType<NudgeThanksSummaryState>()
    .with({ hasPending: true, hasThanked: true }, () => 'SENT_WITH_PENDING')
    .with({ hasPending: true, hasThanked: false }, () => 'PENDING')
    .with({ hasPending: false, hasThanked: true }, () => 'SENT')
    .with({ hasPending: false, hasThanked: false }, () => 'NONE')
    .exhaustive();
  return { state, pendingRecipientCount };
}

type NudgeResponseStage = 'unavailable' | 'reply' | 'thanksPrompt' | 'thanked' | 'status';

/**
 * 상세 화면이 응답 자리에 보일 단계. 받은 사람이 아직 끝나지 않은 할 일에 답할 수 있으면 답장이 먼저고,
 * 완료된 뒤에는 고맙다고 했는지로 가른다
 */
function getResponseStage(
  nudge: Pick<
    NudgeInteraction,
    'receiverId' | 'isAvailable' | 'isTodoCompleted' | 'replyKind' | 'thankedAt'
  >,
  userId: string,
): NudgeResponseStage {
  const status = getNudgeInteractionStatus(nudge);
  if (status === 'UNAVAILABLE') {
    return 'unavailable';
  }
  const isReceived = isReceivedBy(nudge, userId);
  if (isReceived && !nudge.isTodoCompleted && canReply(nudge, userId)) {
    return 'reply';
  }
  if (isReceived && nudge.isTodoCompleted) {
    return status === 'THANKED' ? 'thanked' : 'thanksPrompt';
  }

  return status === 'THANKED' ? 'thanked' : 'status';
}

export const NudgeInteractionPolicy = {
  getNudgeInteractionStatus,
  getResponseStage,
  isReceivedBy,
  canThankTodo,
  hasThankableRecipients,
  getThanksSummary,
} as const;
