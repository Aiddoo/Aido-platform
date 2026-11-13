import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { router } from 'expo-router';

import type { VoiceCaptureEntry } from '../constants/voice.events';
import { useRecognitionLanguage } from './use-recognition-language';
import { useVoiceCaptureReadiness } from './use-voice-capture-readiness';

interface StartVoiceNoteOptions {
  entry?: Extract<VoiceCaptureEntry, 'memo_tab' | 'quick_voice_upgrade'>;
  onSubscribe?: () => void;
  /** 한도·동의·마이크 권한을 모두 통과했다. 기본은 녹음 화면을 지금 화면 위에 쌓는다 */
  onReadyToRecord?: () => void;
}

export function useStartVoiceNote() {
  const ensureReady = useVoiceCaptureReadiness({
    feature: 'VOICE_NOTE',
    surface: 'voice_note',
    mode: 'note',
  });
  const [locale] = useRecognitionLanguage();
  const push = useSingleTap(router.push);

  return async ({
    entry = 'memo_tab',
    onSubscribe,
    onReadyToRecord = () => push('/voice-notes/record'),
  }: StartVoiceNoteOptions = {}) => {
    const { isReady } = await ensureReady({ locale, entry, onSubscribe });
    if (isReady) {
      onReadyToRecord();
    }
  };
}
