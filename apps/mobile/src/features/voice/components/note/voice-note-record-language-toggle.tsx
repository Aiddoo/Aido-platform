import { useLogger } from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { getErrorMessage } from '@src/shared/errors/to-error';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useTranslation } from '@src/shared/i18n';

import { VOICE_NOTE_LOG_EVENT } from '../../constants/voice-note-log-events';
import { useMicrophonePermission } from '../../hooks/use-microphone-permission';
import { useRecognitionLanguage } from '../../hooks/use-recognition-language';
import { RecognitionLanguageToggle } from '../quick-voice/recognition-language-toggle';

interface VoiceNoteRecordLanguageToggleProps {
  onLocaleChange: (next: SpeechLocale) => Promise<void>;
}

/** 언어마다 필요한 권한이 달라 허용된 뒤에만 바꾼다. 거절하면 듣던 언어로 이어 간다 */
export function VoiceNoteRecordLanguageToggle({
  onLocaleChange,
}: VoiceNoteRecordLanguageToggleProps) {
  const { t } = useTranslation('voiceNote');
  const toast = useAppToast();
  const logger = useLogger();
  const [locale, setLocale] = useRecognitionLanguage();
  const ensureMicrophonePermission = useMicrophonePermission();

  const handleLocaleChange = async (next: SpeechLocale) => {
    if (await ensureMicrophonePermission('note', next)) {
      setLocale(next);
      await onLocaleChange(next);
    }
  };

  return (
    <RecognitionLanguageToggle
      value={locale}
      onValueChange={(next) => {
        handleLocaleChange(next).catch((error: unknown) => {
          logger.warn(VOICE_NOTE_LOG_EVENT.RECORD_LANGUAGE_CHANGE_FAILED, {
            error: getErrorMessage(error),
          });
          toast.error(t('record.languageChangeFailed'));
        });
      }}
    />
  );
}
