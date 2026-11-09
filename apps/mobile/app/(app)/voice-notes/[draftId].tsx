import { useRefreshMemos } from '@src/features/notes/memo/hooks/use-refresh-memos';
import { VoiceNoteDigest } from '@src/features/voice/components/note/voice-note-digest';
import { VoiceNoteOffline } from '@src/features/voice/components/note/voice-note-offline';
import { VoiceNoteResult } from '@src/features/voice/components/note/voice-note-result';
import { useCurrentVoiceNote } from '@src/features/voice/hooks/use-current-voice-note';
import { voiceNoteParamsSchema } from '@src/features/voice/schemas/voice-note-params.schema';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useTranslation } from '@src/shared/i18n';
import {
  QueryErrorBoundary,
  Result,
  StyledSafeAreaView,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { range } from 'es-toolkit';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';
import { match, P } from 'ts-pattern';

const LOADING_LINE_COUNT = 4;

function VoiceNoteScreen() {
  const [{ note }] = useCurrentVoiceNote();
  const refreshMemos = useRefreshMemos();

  return match(note)
    .with(P.nullish, () => <VoiceNoteScreen.NotFound />)
    .with({ digest: P.nullish }, (pending) => (
      <VStack flex={1} className="px-4 pt-2">
        <VoiceNoteDigest note={pending} onMemoChanged={refreshMemos} />
      </VStack>
    ))
    .with(P.nonNullable, (digested) => (
      <VStack flex={1} className="px-4 pt-2">
        <VoiceNoteResult note={digested} onMemoChanged={refreshMemos} />
      </VStack>
    ))
    .exhaustive();
}

/** 헤더는 레이아웃이 미리 그려 받은 뒤에 밀리지 않는다. 오프라인이면 연결을 기다린다고 알린다 */
VoiceNoteScreen.Loading = function Loading() {
  const isOnline = useIsOnline();

  return match(isOnline)
    .with(true, () => (
      <VStack gap={8} className="px-4 pb-3 pt-2" testID="voice-note-screen-loading">
        {range(LOADING_LINE_COUNT).map((index) => (
          <TextSkeleton key={index} size="b2" className="w-full" />
        ))}
      </VStack>
    ))
    .with(false, () => <VoiceNoteOffline className="px-4" />)
    .exhaustive();
};

VoiceNoteScreen.NotFound = function NotFound() {
  const { t } = useTranslation('voiceNote');

  return (
    <VStack flex={1} className="px-4 pt-2">
      <Stack.Screen options={{ title: '' }} />
      <Result title={t('result.notFound')} testID="voice-note-not-found" />
    </VStack>
  );
};

export default function VoiceNoteRoute() {
  const params = voiceNoteParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/memo" />;
  }

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
      <QueryErrorBoundary resetKeys={[params.data.draftId]}>
        <Suspense fallback={<VoiceNoteScreen.Loading />}>
          <VoiceNoteScreen key={params.data.draftId} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
