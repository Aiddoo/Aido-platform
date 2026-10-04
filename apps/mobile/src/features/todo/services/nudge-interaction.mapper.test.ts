import { createNudgeInteractionDto } from '../__tests__/nudge-interaction.factories';
import { toNudgeInteraction } from './nudge-interaction.mapper';

describe('콕 응답을 클라이언트 모델로 변환', () => {
  test('친구 정보는 평탄하게 만들고 감사 시각을 Date로 변환한다', () => {
    // Given
    const dto = createNudgeInteractionDto({ thankedAt: '2026-10-04T00:00:00.000Z' });
    // When
    const nudge = toNudgeInteraction(dto);
    // Then
    expect(nudge).toMatchObject({
      senderName: '응원냥',
      receiverName: '시작냥',
      todoTitle: '산책하기',
      isTodoCompleted: false,
    });
    expect(nudge.thankedAt).toEqual(new Date('2026-10-04T00:00:00.000Z'));
    expect(nudge).not.toHaveProperty('sender');
  });

  test('비공개로 가려진 할 일이나 없는 이름을 추측하지 않는다', () => {
    // Given
    const dto = createNudgeInteractionDto({ todo: null, isAvailable: false });
    dto.sender.name = null;
    // When
    const nudge = toNudgeInteraction(dto);
    // Then
    expect(nudge.todoTitle).toBeNull();
    expect(nudge.senderName).toBe('SENDER01');
    expect(nudge.isAvailable).toBe(false);
    expect(nudge.thankedAt).toBeNull();
  });
});
