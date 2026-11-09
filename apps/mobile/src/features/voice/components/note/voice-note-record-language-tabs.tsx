import { useLogger } from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { getErrorMessage } from '@src/shared/errors/to-error';
import { useTranslation } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';

import { VOICE_LOG_EVENT } from '../../constants/voice-log-events';
import { useEnsureMicrophonePermission } from '../../hooks/use-ensure-microphone-permission';
import { useRecognitionLanguage } from '../../hooks/use-recognition-language';
import { RecognitionLanguageTabs } from '../quick-voice/recognition-language-tabs';

interface VoiceNoteRecordLanguageTabsProps {
  onLocaleChange: (next: SpeechLocale) => Promise<void>;
}

/** 언어마다 필요한 권한이 달라 허용된 뒤에만 바꾼다. 거절하면 듣던 언어로 이어 간다 */
export function VoiceNoteRecordLanguageTabs({ onLocaleChange }: VoiceNoteRecordLanguageTabsProps) {
  const { t } = useTranslation('voiceNote');
  const toast = useAppToast();
  const logger = useLogger();
  const [locale, setLocale] = useRecognitionLanguage();
  const ensureMicrophonePermission = useEnsureMicrophonePermission();

  const handleLocaleChange = async (next: SpeechLocale) => {
    if (await ensureMicrophonePermission('note', next)) {
      await onLocaleChange(next);
      setLocale(next);
    }
  };

  return (
    <RecognitionLanguageTabs
      value={locale}
      onValueChange={(next) => {
        handleLocaleChange(next).catch((error: unknown) => {
          logger.warn(VOICE_LOG_EVENT.RECORD_LANGUAGE_CHANGE_FAILED, {
            error: getErrorMessage(error),
          });
          toast.error(t('record.languageChangeFailed'));
        });
      }}
    />
  );
}
