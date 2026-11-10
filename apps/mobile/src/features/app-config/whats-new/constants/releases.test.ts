import { i18n } from '@src/shared/i18n';
import { compareSemanticVersions } from '@src/shared/utils/semantic-version';
import { sortBy } from 'es-toolkit';

import { RELEASES } from './releases';

describe('RELEASES', () => {
  it('늦게 나온 출시일수록 버전이 높아 목록의 최신 표시와 버전이 어긋나지 않는다', () => {
    // Given
    const releasesByDate = sortBy(RELEASES, [(release) => release.releasedOn]);

    // When
    const versionSteps = releasesByDate
      .slice(1)
      .map((release, index) =>
        compareSemanticVersions(release.version, releasesByDate[index]?.version),
      );

    // Then
    expect(versionSteps.every((step) => step != null && step > 0)).toBe(true);
  });

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

  it('모든 출시에 목록 제목과 설명 문구가 있다', () => {
    // When
    const missingKeys = RELEASES.flatMap(({ titleKey, descriptionKey }) => [
      titleKey,
      descriptionKey,
    ]).filter((key) => !i18n.exists(key, { ns: 'whatsNew' }));

    // Then
    expect(missingKeys).toEqual([]);
  });
});
