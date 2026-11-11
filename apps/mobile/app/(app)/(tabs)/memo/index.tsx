import {
  MEMO_CREATE_BUTTON_SIZE,
  MemoCreateButton,
} from '@src/features/notes/memo/components/memo-create-button';
import { MemoEditor } from '@src/features/notes/memo/components/memo-editor';
import { MemoList } from '@src/features/notes/memo/components/memo-list';
import { MemoListScrollView } from '@src/features/notes/memo/components/memo-list-scroll-view';
import {
  useMemoDetailHandoff,
  useSelectedMemoId,
} from '@src/features/notes/memo/hooks/use-memo-params';
import { NotificationBellToolbar } from '@src/features/notification/components/notification-bell-toolbar';
import { VoiceNoteDraftList } from '@src/features/voice/components/note/voice-note-draft-list';
import { VoiceNoteStartButton } from '@src/features/voice/components/note/voice-note-start-button';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  AdaptivePane,
  usePaneSizeClass,
  Box,
  H3,
  HINT_OFFSET,
  HStack,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
} from '@src/shared/ui';
import { Suspense } from 'react';

const HEADER_GAP = 8;

export default function MemoScreen() {
  const { t } = useTranslation('memo');
  const fontScaledSize = useFontScaledSize();
  const isCompact = usePaneSizeClass() === 'compact';
  const [selectedMemoId, setSelectedMemoId] = useSelectedMemoId();
  const deselectMemo = useSingleTap(() => setSelectedMemoId(undefined));

  useMemoDetailHandoff();

  return (
    <>
      <NotificationBellToolbar />

      <AdaptivePane
        primary={
          <Box className="flex-1">
            <StyledSafeAreaView edges={['left', 'right']}>
              <HStack align="center" gap={HEADER_GAP} className="px-4">
                <Box className="flex-1">
                  <H3 numberOfLines={1}>{t('tab.title')}</H3>
                </Box>
                {/* 아래로 펴면 첫 메모를 덮는다. 좁으면 제목 자리, 넓으면 그 자리가 좁아 새 메모 버튼 건너 상세 칸에 편다 */}
                <VoiceNoteStartButton
                  coachmarkPlacement={isCompact ? 'left' : 'right'}
                  coachmarkOffset={
                    isCompact
                      ? undefined
                      : fontScaledSize(MEMO_CREATE_BUTTON_SIZE) + HEADER_GAP + HINT_OFFSET
                  }
                />
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
            <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
              <MemoEditor.Empty />
            </StyledSafeAreaView>
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
