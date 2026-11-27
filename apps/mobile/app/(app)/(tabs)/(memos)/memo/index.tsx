import {
  MEMO_CREATE_BUTTON_SIZE,
  MemoCreateButton,
} from '@src/features/notes/memo/components/memo-create-button';
import { MemoPaneEditor } from '@src/features/notes/memo/components/memo-editor';
import { MemoList } from '@src/features/notes/memo/components/memo-list';
import { useMemoDetailHandoff } from '@src/features/notes/memo/hooks/use-memo-detail-handoff';
import { useSelectedMemoId } from '@src/features/notes/memo/hooks/use-memo-params';
import { NotificationBellToolbar } from '@src/features/notification/components/notification-bell-toolbar';
import { VoiceNoteStartButton } from '@src/features/voice/components/voice-note-start-button';
import { useTranslation } from '@src/shared/i18n';
import {
  AdaptivePane,
  Box,
  H3,
  HINT_OFFSET,
  HStack,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  usePaneSizeClass,
} from '@src/shared/ui';
import { Suspense } from 'react';
import { match, P } from 'ts-pattern';

const HEADER_GAP = 8;

export default function MemoScreen() {
  const { t } = useTranslation('memo');
  const isCompact = usePaneSizeClass() === 'compact';
  const [selectedMemoId] = useSelectedMemoId();

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
                    isCompact ? undefined : MEMO_CREATE_BUTTON_SIZE + HEADER_GAP + HINT_OFFSET
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

            {/* 말로 남긴 메모 초안은 메모 목록 머리말로 함께 스크롤된다. 좌우 safe area는 목록·로딩·실패가 스스로 둔다 */}
            <QueryErrorBoundary fallback={MemoList.Error}>
              <Suspense fallback={<MemoList.Loading />}>
                <MemoList />
              </Suspense>
            </QueryErrorBoundary>
          </Box>
        }
        secondary={match(selectedMemoId)
          .with(undefined, () => (
            <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
              <MemoPaneEditor.Empty />
            </StyledSafeAreaView>
          ))
          .with(P.number, (id) => (
            <StyledSafeAreaView key={id} edges={['left', 'right']} className="flex-1 bg-white">
              <QueryErrorBoundary resetKeys={[id]} fallback={MemoPaneEditor.Error}>
                <Suspense fallback={<MemoPaneEditor.Loading />}>
                  <MemoPaneEditor />
                </Suspense>
              </QueryErrorBoundary>
            </StyledSafeAreaView>
          ))
          .exhaustive()}
      />
    </>
  );
}
