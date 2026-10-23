import { SentNudgeList } from '@src/features/nudge/components/nudge-interactions/sent-nudge-list';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, ScreenTitleBar, StyledSafeAreaView } from '@src/shared/ui';
import { router } from 'expo-router';
import { Suspense } from 'react';

export default function SentNudgesScreen() {
  const { t } = useTranslation('todo');
  const goBack = useSingleTap(() =>
    router.canGoBack() ? router.back() : router.replace('/notifications'),
  );

  return (
    <StyledSafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-background">
      <ScreenTitleBar title={t('interaction.sent')} onBackPress={goBack} />
      <QueryErrorBoundary fallback={SentNudgeList.Error}>
        <Suspense fallback={<SentNudgeList.Loading />}>
          <SentNudgeList />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
