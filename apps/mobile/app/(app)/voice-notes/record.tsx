import { VoiceNoteRecorder } from '@src/features/voice/components/voice-note-recorder/voice-note-recorder';
import { useKeepScreenAwake } from '@src/shared/infra/keep-awake/use-keep-screen-awake';
import { QueryErrorBoundary, StyledSafeAreaView } from '@src/shared/ui';
import { Suspense } from 'react';

export default function VoiceNoteRecordRoute() {
  useKeepScreenAwake();

  return (
    <StyledSafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
      <QueryErrorBoundary>
        <Suspense fallback={<VoiceNoteRecorder.Loading />}>
          <VoiceNoteRecorder />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
