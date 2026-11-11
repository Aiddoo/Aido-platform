import { createNudgeInteractionDto } from '../__tests__/nudge-interaction.fixtures';
import { nudgeInteractionSchema } from '../domains/nudge-interaction.model';
import { toNudgeInteraction, toNudgeThanksPreview } from './nudge-interaction.mapper';

describe('콕 응답을 클라이언트 모델로 변환', () => {
  it('친구 정보는 평탄하게 만들고 감사 시각을 Instant로 둔다', () => {
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
    expect(nudge.thankedAt).toBe('2026-10-04T00:00:00.000Z');
    expect(nudge).not.toHaveProperty('sender');
  });

  it('계약을 통과한 콕 응답은 앱 콕 모델도 통과한다', () => {
    // Given
    const dto = createNudgeInteractionDto({ replyKind: 'THANKFUL' });

    // When
    const nudge = toNudgeInteraction(dto);

    // Then
    expect(nudgeInteractionSchema.parse(nudge)).toEqual(nudge);
  });

  it('비공개로 가려진 할 일이나 없는 이름을 추측하지 않는다', () => {
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
  it('쪽 정보가 없는 전체 목록 응답은 마지막 페이지로 해석한다', () => {
    // Given
    const dto = {
      todoId: 1,
      throughNudgeId: 10,
      recipients: [createNudgeInteractionDto().sender],
      thankedRecipientCount: 0,
      lastThankedAt: null,
    };
    // When
    const preview = toNudgeThanksPreview(dto);
    // Then
    expect(preview).toMatchObject({
      totalRecipients: 1,
      nextCursor: null,
      hasNext: false,
      thankedRecipientCount: 0,
      lastThankedAt: null,
    });
  });

  it('감사한 친구 수와 마지막 감사 시각을 보존하고 시각은 Instant로 둔다', () => {
    // Given
    const dto = {
      todoId: 1,
      throughNudgeId: null,
      recipients: [],
      thankedRecipientCount: 3,
      lastThankedAt: '2026-10-26T06:12:00.000Z',
    };
    // When
    const preview = toNudgeThanksPreview(dto);
    // Then
    expect(preview.thankedRecipientCount).toBe(3);
    expect(preview.lastThankedAt).toBe('2026-10-26T06:12:00.000Z');
  });

  it('페이지 메타데이터가 있으면 전체 인원과 다음 커서를 보존한다', () => {
    // Given
    const dto = {
      todoId: 1,
      throughNudgeId: 100,
      recipients: [createNudgeInteractionDto().sender],
      totalRecipients: 1000,
      nextCursor: 80,
      hasNext: true,
      thankedRecipientCount: 0,
      lastThankedAt: null,
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

  it('대상이 없는 응답에서 null은 다음 커서와 감사 기준이 없음을 나타낸다', () => {
    // Given
    const dto = {
      todoId: 1,
      throughNudgeId: null,
      recipients: [],
      totalRecipients: 0,
      nextCursor: null,
      hasNext: false,
      thankedRecipientCount: 0,
      lastThankedAt: null,
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
