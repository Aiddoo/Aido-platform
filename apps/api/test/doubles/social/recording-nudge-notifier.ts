import {
  type NudgeInteractionNotification,
  NudgeNotifierPort,
  type NudgeSentNotification,
} from "#api/modules/social/nudges/application/ports/nudge-notifier.port";

// 답장·감사 알림은 배치 단위도 남긴다(감사는 100명씩 묶어 기록한다)
export class RecordingNudgeNotifier extends NudgeNotifierPort {
  readonly sent: NudgeSentNotification[] = [];
  readonly interactions: NudgeInteractionNotification[] = [];
  readonly interactionBatchSizes: number[] = [];

  async notifyNudgeSent(notification: NudgeSentNotification): Promise<void> {
    this.sent.push(notification);
  }

  async recordInteraction(notification: NudgeInteractionNotification): Promise<void> {
    this.interactions.push(notification);
    this.interactionBatchSizes.push(1);
  }

  async recordInteractions(notifications: readonly NudgeInteractionNotification[]): Promise<void> {
    this.interactions.push(...notifications);
    this.interactionBatchSizes.push(notifications.length);
  }
}
