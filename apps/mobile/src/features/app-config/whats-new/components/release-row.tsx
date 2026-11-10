import { formatYearAwareDateKeyLabel } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Text, VStack } from '@src/shared/ui';
import { router } from 'expo-router';
import { Chip, PressableFeedback } from 'heroui-native';

import { RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';
import { useHasUnseenRelease } from '../hooks/use-has-unseen-release';
import type { ReleaseEntry } from '../schemas/release-entry.schema';

type ReleaseRowProps = {
  release: Pick<ReleaseEntry, 'id' | 'version' | 'releasedOn' | 'titleKey' | 'descriptionKey'>;
};

export function ReleaseRow({ release }: ReleaseRowProps) {
  const { t } = useTranslation('whatsNew');
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const push = useSingleTap(router.push);
  const hasUnseenRelease = useHasUnseenRelease();
  const isLatest = WhatsNewPolicy.getLatestRelease(RELEASES).id === release.id;
  const isUnseen = isLatest && hasUnseenRelease;
  const title = t(release.titleKey);
  const updatedOn = {
    version: release.version,
    date: formatYearAwareDateKeyLabel(release.releasedOn, todayKey, dateFormatContext),
  };
  const label = `${title}, ${t('list.updatedOnLabel', updatedOn)}`;

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={isUnseen ? `${label}, ${t('list.unseenLabel')}` : label}
      testID={`whats-new-release-${release.id}`}
      className="rounded-2xl bg-gray-1 p-4"
      onPress={() =>
        push({ pathname: '/whats-new', params: { releaseId: release.id, source: 'mypage' } })
      }
    >
      <HStack align="center" gap={12}>
        <VStack flex={1} gap={8}>
          <HStack align="center" gap={8}>
            {/* Chip도 Pressable이라 그대로 두면 칩 자리 탭을 가로채 줄이 눌리지 않는다 */}
            {isLatest && (
              <Chip size="sm" className="bg-highlight" pointerEvents="none">
                <Text size="e1" weight="semibold" tone="brand">
                  {t('list.newBadge')}
                </Text>
              </Chip>
            )}
            <Text size="e1" shade={6}>
              {t('list.updatedOn', updatedOn)}
            </Text>
          </HStack>
          <VStack gap={4}>
            <Text size="b2" weight="semibold" lineBreakStrategyIOS="hangul-word">
              {title}
            </Text>
            <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
              {t(release.descriptionKey)}
            </Text>
          </VStack>
        </VStack>
        {isUnseen && <Box testID="whats-new-unseen-dot" className="size-2 rounded-full bg-main" />}
      </HStack>
    </PressableFeedback>
  );
}
