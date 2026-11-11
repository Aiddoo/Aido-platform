import { useTrack } from '@src/shared/analytics';
import { formatYearAwareDateKeyLabel } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Text, VStack } from '@src/shared/ui';
import { router } from 'expo-router';
import { Chip, PressableFeedback } from 'heroui-native';

import { WhatsNewPolicy } from '../domains/whats-new.model';
import { useUnseenCampaignReleaseId } from '../hooks/use-unseen-campaign-release-id';
import type { ReleaseEntry } from '../schemas/release-entry.schema';

type ReleaseRowProps = {
  release: ReleaseEntry;
};

/**
 * 기능이 주인공이고 버전·날짜는 조용히 아래에 둔다. 소개가 남은 출시는 소개를 열고,
 * 소개를 뺀 지난 출시는 바로 해 보기 화면으로 간다. 둘 다 없으면 누를 수 없다
 */
export function ReleaseRow({ release }: ReleaseRowProps) {
  const { t } = useTranslation('whatsNew');
  const { trackEvent } = useTrack();
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const push = useSingleTap(router.push);
  // 새 기능 표시는 서버 캠페인이 가리키는 출시를 아직 보지 않았을 때만이다
  const isNew = useUnseenCampaignReleaseId() === release.id;
  const tourId = WhatsNewPolicy.findTourId(release);
  const { cta } = release;
  const isPressable = tourId != null || cta != null;
  const title = t(release.titleKey);
  const updatedOn = {
    version: release.version,
    date: formatYearAwareDateKeyLabel(release.releasedOn, todayKey, dateFormatContext),
  };
  const label = `${title}, ${t('list.updatedOnLabel', updatedOn)}`;

  const handlePress = () => {
    if (tourId != null) {
      push({ pathname: '/whats-new', params: { releaseId: tourId, source: 'mypage' } });
      return;
    }
    if (cta != null) {
      trackEvent('whats_new_cta_pressed', { release_id: release.id, step: 'list' });
      push(cta.href);
    }
  };

  return (
    <PressableFeedback
      accessibilityRole={isPressable ? 'button' : 'text'}
      accessibilityLabel={isNew ? `${label}, ${t('list.unseenLabel')}` : label}
      testID={`whats-new-release-${release.id}`}
      className="rounded-2xl bg-gray-1 p-4"
      isDisabled={!isPressable}
      onPress={handlePress}
    >
      <VStack gap={8}>
        {/* Chip도 Pressable이라 그대로 두면 칩 자리 탭을 가로채 줄이 눌리지 않는다 */}
        {isNew && (
          <Chip size="sm" className="self-start bg-highlight" pointerEvents="none">
            <Text size="e1" weight="semibold" tone="brand">
              {t('list.newBadge')}
            </Text>
          </Chip>
        )}
        <VStack gap={4}>
          <Text size="b2" weight="semibold" lineBreakStrategyIOS="hangul-word">
            {title}
          </Text>
          <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
            {t(release.descriptionKey)}
          </Text>
        </VStack>
        <Text size="e1" shade={5}>
          {t('list.updatedOn', updatedOn)}
        </Text>
      </VStack>
    </PressableFeedback>
  );
}
