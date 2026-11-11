import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { router } from 'expo-router';

import { useRecognitionLanguage } from './use-recognition-language';
import { useVoiceCaptureReadiness } from './use-voice-capture-readiness';

interface StartVoiceNoteOptions {
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
    onSubscribe,
    onReadyToRecord = () => push('/voice-notes/record'),
  }: StartVoiceNoteOptions = {}) => {
    const { isReady } = await ensureReady({ locale, onSubscribe });
    if (isReady) {
      onReadyToRecord();
    }
  };
}
