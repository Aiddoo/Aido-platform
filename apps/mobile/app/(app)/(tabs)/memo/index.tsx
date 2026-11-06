import { MemoEditor } from '@src/features/memo/components/memo-editor';
import { MemoList } from '@src/features/memo/components/memo-list';
import { MemoListScrollView } from '@src/features/memo/components/memo-list-scroll-view';
import { MemoPolicy } from '@src/features/memo/domains/memo.model';
import { useSelectedMemo } from '@src/features/memo/hooks/use-memo-params';
import { useGetMemoResourceLimitQueryOptions } from '@src/features/memo/queries/memo.queries';
import { memoDetailHref } from '@src/features/memo/utils/memo-href';
import { NotificationBell } from '@src/features/notification/components/notification-bell';
import { VoiceNoteDraftList } from '@src/features/voice/components/note/voice-note-draft-list';
import { VoiceNoteStartButton } from '@src/features/voice/components/note/voice-note-start-button';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useCompactDetailHandoff } from '@src/shared/hooks/use-compact-detail-handoff';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  AdaptivePane,
  Box,
  H3,
  HStack,
  PlusIcon,
  QueryErrorBoundary,
  RefreshIcon,
  Spacing,
  StyledSafeAreaView,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { Suspense } from 'react';

export default function MemoScreen() {
  const { t } = useTranslation('memo');
  const [selectedMemoId, setSelectedMemoId] = useSelectedMemo();
  const deselectMemo = useSingleTap(() => setSelectedMemoId(undefined));

  useCompactDetailHandoff(selectedMemoId, (memoId) => {
    router.setParams({ memoId: undefined });
    router.push(memoDetailHref(memoId));
  });

  return (
    <>
      <NotificationBell.Toolbar />

      <AdaptivePane
        primary={
          <Box className="flex-1">
            <StyledSafeAreaView edges={['left', 'right']}>
              <HStack align="center" gap={8} className="px-4">
                <Box className="flex-1">
                  <H3 maxLines={1}>{t('tab.title')}</H3>
                </Box>
                <VoiceNoteStartButton />
                <QueryErrorBoundary fallback={MemoCreateButton.Error}>
                  <Suspense fallback={<MemoCreateButton.Loading />}>
                    <MemoCreateButton />
                  </Suspense>
                </QueryErrorBoundary>
              </HStack>

              <Spacing size={16} />
            </StyledSafeAreaView>

            <MemoListScrollView>
              {/* 초안이 없는 사용자가 대부분이라 로딩·실패 때 자리를 잡지 않는다. 자리를 잡으면 아래 메모가 위로 밀린다 */}
              <QueryErrorBoundary fallback={() => null}>
                <Suspense fallback={null}>
                  <VoiceNoteDraftList />
                </Suspense>
              </QueryErrorBoundary>

              <QueryErrorBoundary fallback={MemoList.Error}>
                <Suspense fallback={<MemoList.Loading />}>
                  <MemoList />
                </Suspense>
              </QueryErrorBoundary>
            </MemoListScrollView>
          </Box>
        }
        secondary={
          selectedMemoId == null ? (
            <MemoEditor.Empty />
          ) : (
            <StyledSafeAreaView
              key={selectedMemoId}
              edges={['left', 'right']}
              className="flex-1 bg-white"
            >
              <QueryErrorBoundary resetKeys={[selectedMemoId]} fallback={MemoEditor.PaneError}>
                <Suspense fallback={<MemoEditor.PaneLoading />}>
                  <MemoEditor toolbar={MemoEditor.PaneToolbar} onLeave={deselectMemo} />
                </Suspense>
              </QueryErrorBoundary>
            </StyledSafeAreaView>
          )
        }
      />
    </>
  );
}

function MemoCreateButton() {
  const fontScaledSize = useFontScaledSize();
  const push = useSingleTap(router.push);

  const toast = useAppToast();
  const { t } = useTranslation('memo');
  const { data: resourceLimit } = useSuspenseQuery(useGetMemoResourceLimitQueryOptions());
  const canCreate = MemoPolicy.canCreateMemo(resourceLimit);

  const handleCreate = () => {
    if (!canCreate) {
      toast.error(t('toasts.limitReached'));
      return;
    }
    push('/memo/create');
  };

  return (
    <PressableFeedback
      onPress={handleCreate}
      accessibilityRole="button"
      accessibilityLabel={t('titles.create')}
      style={{ width: fontScaledSize(44), height: fontScaledSize(44) }}
      className={cn(
        'items-center justify-center rounded-full',
        canCreate ? 'bg-main' : 'bg-gray-4',
      )}
    >
      <PlusIcon width={24} height={24} colorClassName="text-white dark:text-gray-9" />
    </PressableFeedback>
  );
}

MemoCreateButton.Loading = function Loading() {
  const fontScaledSize = useFontScaledSize();
  return <Box style={{ width: fontScaledSize(44), height: fontScaledSize(44) }} />;
};

MemoCreateButton.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('common');
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={t('actions.retry')}
      onPress={reset}
      style={{ width: fontScaledSize(44), height: fontScaledSize(44) }}
      className="items-center justify-center rounded-full bg-gray-8"
    >
      <RefreshIcon width={20} height={20} colorClassName="text-white" />
    </PressableFeedback>
  );
};
