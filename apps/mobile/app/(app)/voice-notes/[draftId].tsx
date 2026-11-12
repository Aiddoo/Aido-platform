import { useSuspenseMyAccountId } from '@src/features/identity/user/hooks/use-suspense-my-account-id';
import { useRefreshMemos } from '@src/features/notes/memo/hooks/use-refresh-memos';
import { VoiceNoteDigest } from '@src/features/voice/components/note/voice-note-digest';
import { VoiceNoteOffline } from '@src/features/voice/components/note/voice-note-offline';
import { VoiceNoteResult } from '@src/features/voice/components/note/voice-note-result';
import { useCurrentVoiceNoteStage } from '@src/features/voice/hooks/use-current-voice-note-stage';
import { useVoiceNoteDraftId } from '@src/features/voice/hooks/use-voice-note-params';
import { voiceNoteParamsSchema } from '@src/features/voice/schemas/voice-note-params.schema';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, Result, StyledSafeAreaView, VStack } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

export default function VoiceNoteRoute() {
  const route = useRouteParamsOrRedirect(voiceNoteParamsSchema, { fallbackHref: '/memo' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return <VoiceNoteScreen />;
}

function VoiceNoteScreen() {
  const [draftId] = useVoiceNoteDraftId();

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
      <QueryErrorBoundary fallback={VoiceNoteResult.Error} resetKeys={[draftId]}>
        <Suspense fallback={<VoiceNoteScreen.Loading />}>
          <VoiceNoteScreen.Stage key={draftId} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}

VoiceNoteScreen.Stage = function Stage() {
  const accountId = useSuspenseMyAccountId();
  const stage = useCurrentVoiceNoteStage(accountId);
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
};

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
