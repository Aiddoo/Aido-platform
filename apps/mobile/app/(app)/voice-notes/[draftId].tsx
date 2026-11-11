import { useRefreshMemos } from '@src/features/notes/memo/hooks/use-refresh-memos';
import { VoiceNoteDigest } from '@src/features/voice/components/note/voice-note-digest';
import { VoiceNoteOffline } from '@src/features/voice/components/note/voice-note-offline';
import { VoiceNoteResult } from '@src/features/voice/components/note/voice-note-result';
import { useCurrentVoiceNoteStage } from '@src/features/voice/hooks/use-current-voice-note';
import { voiceNoteParamsSchema } from '@src/features/voice/schemas/voice-note-params.schema';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, Result, StyledSafeAreaView, VStack } from '@src/shared/ui';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

function VoiceNoteScreen() {
  const stage = useCurrentVoiceNoteStage();
  const refreshMemos = useRefreshMemos();

  return (
    <VStack flex={1} className="px-4 pt-2">
      {match(stage)
        .with('missing', () => <VoiceNoteScreen.NotFound />)
        .with('recorded', () => <VoiceNoteDigest onMemoChanged={refreshMemos} />)
        .with('digested', () => <VoiceNoteResult onMemoChanged={refreshMemos} />)
        .exhaustive()}
    </VStack>
  );
}

/** 헤더는 레이아웃이 미리 그려 받은 뒤에 밀리지 않는다. 오프라인이면 연결을 기다린다고 알린다 */
VoiceNoteScreen.Loading = function Loading() {
  const isOnline = useIsOnline();

  return match(isOnline)
    .with(true, () => (
      // 단계는 내 정보를 받아야 알아 정리 전 노트도 결과 모양으로 기다린다. 내 정보가 캐시에 없을 때(콜드 딥링크)만 보인다
      <VStack flex={1} className="px-4 pt-2">
        <VoiceNoteResult.Loading />
      </VStack>
    ))
    .with(false, () => <VoiceNoteOffline className="px-4" />)
    .exhaustive();
};

VoiceNoteScreen.NotFound = function NotFound() {
  const { t } = useTranslation('voiceNote');

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <Result title={t('result.notFound')} testID="voice-note-not-found" />
    </>
  );
};

export default function VoiceNoteRoute() {
  const params = voiceNoteParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/memo" />;
  }

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
      <QueryErrorBoundary fallback={VoiceNoteResult.Error} resetKeys={[params.data.draftId]}>
        <Suspense fallback={<VoiceNoteScreen.Loading />}>
          <VoiceNoteScreen key={params.data.draftId} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
