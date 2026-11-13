import { VoiceNoteDraftList } from '@src/features/voice/components/voice-note-draft-list';
import { QueryErrorBoundary, ReadableContent, StyledSafeAreaView } from '@src/shared/ui';
import { Suspense } from 'react';

export default function VoiceNoteListRoute() {
  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <QueryErrorBoundary fallback={VoiceNoteDraftList.Error}>
          <Suspense fallback={<VoiceNoteDraftList.Loading />}>
            <VoiceNoteDraftList.All />
          </Suspense>
        </QueryErrorBoundary>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
