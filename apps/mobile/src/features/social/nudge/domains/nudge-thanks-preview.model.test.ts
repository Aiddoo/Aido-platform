import { createNudgeThanksPreview } from '../__tests__/nudge-interaction.fixtures';
import { NudgeThanksPreviewPolicy } from './nudge-thanks-preview.model';

describe('NudgeThanksPreviewPolicy', () => {
  describe('hasThankableRecipients', () => {
    it.each([
      [1, [{ id: 'friend', name: '친구', userTag: 'FRIEND01', profileImage: null }], true],
      [null, [{ id: 'friend', name: '친구', userTag: 'FRIEND01', profileImage: null }], false],
      [1, [], false],
    ])(
      '마지막 콕 %s와 받을 친구 목록으로 감사 가능 여부를 판단한다',
      (throughNudgeId, items, expected) => {
        // Given
        const preview = createNudgeThanksPreview({ throughNudgeId, items });

        // When
        const hasThankable = NudgeThanksPreviewPolicy.hasThankableRecipients(preview);

        // Then
        expect(hasThankable).toBe(expected);
      },
    );
  });

  describe('getThanksSummary', () => {
    const recipient = { id: 'friend-1', name: '응원냥', userTag: 'FRIEND01', profileImage: null };

    it.each([
      [10, 3, 0, 'PENDING', 3],
      [10, 3, 2, 'SENT_WITH_PENDING', 3],
      [null, 0, 2, 'SENT', 0],
      [null, 0, 0, 'NONE', 0],
    ] as const)(
      '기준 콕 %s·남은 친구 %s명·감사한 친구 %s명이면 %s 상태다',
      (throughNudgeId, totalRecipients, thankedRecipientCount, expectedState, expectedPending) => {
        // Given
        const preview = createNudgeThanksPreview({
          throughNudgeId,
          items: totalRecipients > 0 ? [recipient] : [],
          totalRecipients,
          thankedRecipientCount,
        });

        // When
        const summary = NudgeThanksPreviewPolicy.getThanksSummary(preview);

        // Then
        expect(summary).toEqual({ state: expectedState, pendingRecipientCount: expectedPending });
      },
    );

    it('감사 기준 콕이 없으면 남은 친구 수가 있어도 보낼 친구로 세지 않는다', () => {
      // Given
      const preview = createNudgeThanksPreview({
        throughNudgeId: null,
        items: [recipient],
        totalRecipients: 1,
        thankedRecipientCount: 0,
      });

      // When
      const summary = NudgeThanksPreviewPolicy.getThanksSummary(preview);

      // Then
      expect(summary).toEqual({ state: 'NONE', pendingRecipientCount: 0 });
    });
  });
});
