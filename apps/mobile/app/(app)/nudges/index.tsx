import { nudgeDirectionSchema } from '@src/features/todo/models/nudge-interaction.model';
import { NudgeList } from '@src/features/todo/presentations/components/nudge-interactions/NudgeList';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  HStack,
  QueryErrorBoundary,
  ScreenTitleBar,
  StyledSafeAreaView,
} from '@src/shared/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';
import { z } from 'zod';

const NudgeSearchSchema = z.object({ direction: nudgeDirectionSchema.catch('received') });

export default function NudgesScreen() {
  const { direction } = NudgeSearchSchema.parse(useLocalSearchParams());
  const { t } = useTranslation('todo');

  return (
    <StyledSafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <ScreenTitleBar
        title={t('interaction.title')}
        onBackPress={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
      />
      <HStack px={16} py={12} gap={8}>
        <Button
          className="flex-1"
          variant="weak"
          color={direction === 'received' ? 'primary' : 'dark'}
          accessibilityState={{ selected: direction === 'received' }}
          onPress={() => router.setParams({ direction: 'received' })}
        >
          {t('interaction.received')}
        </Button>
        <Button
          className="flex-1"
          variant="weak"
          color={direction === 'sent' ? 'primary' : 'dark'}
          accessibilityState={{ selected: direction === 'sent' }}
          onPress={() => router.setParams({ direction: 'sent' })}
        >
          {t('interaction.sent')}
        </Button>
      </HStack>
      <QueryErrorBoundary resetKeys={[direction]} fallback={NudgeList.Error}>
        <Suspense fallback={<NudgeList.Loading />}>
          <NudgeList direction={direction} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
