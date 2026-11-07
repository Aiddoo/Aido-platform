import { useTranslation } from '@src/shared/i18n';

import { useCaptureElapsedMs } from '../../hooks/use-capture-elapsed-ms';
import type { VoiceCaptureState } from '../../schemas/voice-capture.schema';
import { RecordingTimer } from './recording-timer';

interface VoiceNoteRecordClockProps {
  state: VoiceCaptureState;
  limitMs: number | null;
}

export function VoiceNoteRecordClock({ state, limitMs }: VoiceNoteRecordClockProps) {
  const { t } = useTranslation('voiceNote');
  const elapsedMs = useCaptureElapsedMs(state);

  return (
    <RecordingTimer
      elapsedMs={elapsedMs}
      limitMs={limitMs}
      label={state.status === 'paused' ? t('record.pausedLabel') : undefined}
    />
  );
}
