import { RELEASE_ID } from '../constants/whats-new.constants';
import { whatsNewParamsSchema } from './whats-new-params.schema';

describe('whatsNewParamsSchema', () => {
  it('잘못된 출시와 들어온 곳은 최신 출시와 메뉴로 읽는다', () => {
    // When
    const result = whatsNewParamsSchema.parse({ releaseId: '0.0.1', source: 'unknown' });

    // Then
    expect(result).toEqual({ releaseId: RELEASE_ID.v1_15_0, source: 'mypage' });
  });

  it('값이 없어도 최신 출시를 연다', () => {
    // When
    const result = whatsNewParamsSchema.parse({});

    // Then
    expect(result.releaseId).toBe(RELEASE_ID.v1_15_0);
  });

  it('있는 출시와 들어온 곳은 그대로 읽는다', () => {
    // When
    const result = whatsNewParamsSchema.parse({ releaseId: '1.15.0', source: 'feed_reentry' });

    // Then
    expect(result).toEqual({ releaseId: RELEASE_ID.v1_15_0, source: 'feed_reentry' });
  });

  it('지운 1.14.0 소개로 남은 링크는 최신 소개를 연다', () => {
    // When
    const result = whatsNewParamsSchema.parse({ releaseId: '1.14.0', source: 'mypage' });

    // Then
    expect(result.releaseId).toBe(RELEASE_ID.v1_15_0);
  });
});
