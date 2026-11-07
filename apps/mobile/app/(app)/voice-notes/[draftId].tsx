import { useRefreshMemos } from '@src/features/notes/memo/hooks/use-refresh-memos';
import { VoiceNoteDigest } from '@src/features/voice/components/note/voice-note-digest';
import { VoiceNoteResult } from '@src/features/voice/components/note/voice-note-result';
import { VoiceNoteScreenLoading } from '@src/features/voice/components/note/voice-note-screen-loading';
import { useCurrentVoiceNote } from '@src/features/voice/hooks/use-current-voice-note';
import { voiceNoteParamsSchema } from '@src/features/voice/schemas/voice-note-params.schema';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, Result, StyledSafeAreaView, VStack } from '@src/shared/ui';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';

function VoiceNoteScreen() {
  const { t } = useTranslation('voiceNote');
  const { note } = useCurrentVoiceNote();
  const refreshMemos = useRefreshMemos();

  if (note == null) {
    return (
      <VStack flex={1} className="px-4 pt-2">
        <Stack.Screen options={{ title: '' }} />
        <Result title={t('result.notFound')} testID="voice-note-not-found" />
      </VStack>
    );
  }

  return note.digest == null ? (
    <VoiceNoteDigest note={note} onMemoChanged={refreshMemos} />
  ) : (
    <VoiceNoteResult note={note} onMemoChanged={refreshMemos} />
  );
}

export default function VoiceNoteRoute() {
  const params = voiceNoteParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/memo" />;
  }

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
      <QueryErrorBoundary resetKeys={[params.data.draftId]}>
        <Suspense fallback={<VoiceNoteScreenLoading />}>
          <VoiceNoteScreen key={params.data.draftId} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
