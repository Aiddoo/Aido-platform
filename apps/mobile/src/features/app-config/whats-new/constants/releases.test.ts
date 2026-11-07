import { i18n } from '@src/shared/i18n';

import { RELEASES } from './releases';

describe('RELEASES', () => {
  it('출시 id가 서로 겹치지 않는다', () => {
    // When
    const ids = RELEASES.map((release) => release.id);

    // Then
    expect(new Set(ids).size).toBe(RELEASES.length);
  });

  it('캠페인 id가 서로 겹치지 않는다', () => {
    // When
    const campaignIds = RELEASES.map((release) => release.campaignId);

    // Then
    expect(new Set(campaignIds).size).toBe(RELEASES.length);
  });

  it('모든 출시에 요약 문구가 있다', () => {
    // When
    const missingSummaryKeys = RELEASES.map((release) => release.summaryKey).filter(
      (summaryKey) => !i18n.exists(summaryKey, { ns: 'whatsNew' }),
    );

    // Then
    expect(missingSummaryKeys).toEqual([]);
  });
});
