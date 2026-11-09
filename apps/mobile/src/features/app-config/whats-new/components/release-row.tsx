import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Text, VStack } from '@src/shared/ui';
import { router } from 'expo-router';
import { Chip, PressableFeedback } from 'heroui-native';

import { RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';
import { useHasUnseenRelease } from '../hooks/use-has-unseen-release';
import type { ReleaseEntry } from '../schemas/release-entry.schema';

export function ReleaseRow({ release }: { release: Pick<ReleaseEntry, 'id' | 'summaryKey'> }) {
  const { t } = useTranslation('whatsNew');
  const push = useSingleTap(router.push);
  const hasUnseenRelease = useHasUnseenRelease();
  const isLatest = WhatsNewPolicy.getLatestRelease(RELEASES).id === release.id;
  const isUnseen = isLatest && hasUnseenRelease;
  const summary = t(release.summaryKey);

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={isUnseen ? `${summary}, ${t('list.unseenLabel')}` : summary}
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
              {release.id}
            </Text>
          </HStack>
          <Text size="b2" weight="semibold" lineBreakStrategyIOS="hangul-word">
            {summary}
          </Text>
        </VStack>
        {isUnseen && <Box testID="whats-new-unseen-dot" className="size-2 rounded-full bg-main" />}
      </HStack>
    </PressableFeedback>
  );
}
