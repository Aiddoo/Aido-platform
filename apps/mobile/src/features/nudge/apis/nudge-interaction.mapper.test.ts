import { createNudgeInteractionDto } from '../__tests__/nudge-interaction.factories';
import { toNudgeInteraction, toNudgeThanksPreview } from './nudge-interaction.mapper';

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

describe('감사 미리보기 페이지 변환', () => {
  test('이전 서버의 전체 목록 응답은 마지막 페이지로 해석한다', () => {
    // Given
    const dto = { todoId: 1, throughNudgeId: 10, recipients: [createNudgeInteractionDto().sender] };
    // When
    const preview = toNudgeThanksPreview(dto);
    // Then
    expect(preview).toMatchObject({ totalRecipients: 1, nextCursor: null, hasNext: false });
  });

  test('페이지 메타데이터가 있으면 전체 인원과 다음 커서를 보존한다', () => {
    // Given
    const dto = {
      todoId: 1,
      throughNudgeId: 100,
      recipients: [createNudgeInteractionDto().sender],
      totalRecipients: 1000,
      nextCursor: 80,
      hasNext: true,
    };
    // When
    const preview = toNudgeThanksPreview(dto);
    // Then
    expect(preview).toMatchObject({
      totalRecipients: 1000,
      nextCursor: 80,
      hasNext: true,
      throughNudgeId: 100,
    });
  });

  test('대상이 없는 응답에서 null은 다음 커서와 감사 기준이 없음을 나타낸다', () => {
    // Given
    const dto = {
      todoId: 1,
      throughNudgeId: null,
      recipients: [],
      totalRecipients: 0,
      nextCursor: null,
      hasNext: false,
    };
    // When
    const preview = toNudgeThanksPreview(dto);
    // Then
    expect(preview.recipients).toEqual([]);
    expect(preview.throughNudgeId).toBeNull();
    expect(preview.nextCursor).toBeNull();
    expect(preview.totalRecipients).toBe(0);
  });
});
