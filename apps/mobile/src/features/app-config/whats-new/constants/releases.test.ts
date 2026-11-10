import { i18n } from '@src/shared/i18n';
import { compareSemanticVersions } from '@src/shared/utils/semantic-version';
import { orderBy, sortBy } from 'es-toolkit';

import { WhatsNewPolicy } from '../domains/whats-new.model';
import { RELEASES } from './releases';
import { TOUR_RELEASE_IDS } from './whats-new.constants';

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

  it('여러 단계 소개는 최근 두 출시에만 남고 최신 출시가 맨 앞이다', () => {
    // Given
    const latestTwoIds = orderBy(RELEASES, [(release) => release.releasedOn], ['desc'])
      .slice(0, 2)
      .map((release) => release.id);

    // When
    const tourIds = RELEASES.flatMap((release) => WhatsNewPolicy.findTourId(release) ?? []);

    // Then
    expect(TOUR_RELEASE_IDS[0]).toBe(WhatsNewPolicy.getLatestRelease(RELEASES).id);
    expect(tourIds.every((id) => latestTwoIds.includes(id))).toBe(true);
    expect(tourIds).toHaveLength(TOUR_RELEASE_IDS.length);
  });

  it('서버가 자동으로 열 수 있는(캠페인이 있는) 출시는 모두 소개가 있다', () => {
    // When
    const campaignReleasesWithoutTour = RELEASES.filter(
      (release) => release.campaignId != null && WhatsNewPolicy.findTourId(release) == null,
    );

    // Then
    expect(campaignReleasesWithoutTour).toEqual([]);
  });

  it('출시 id와 캠페인 id가 서로 겹치지 않는다', () => {
    // When
    const ids = RELEASES.map((release) => release.id);
    const campaignIds = RELEASES.flatMap((release) => release.campaignId ?? []);

    // Then
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(campaignIds).size).toBe(campaignIds.length);
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
