import { useTranslation } from '@src/shared/i18n';
import { Result } from '@src/shared/ui';
import { router } from 'expo-router';

/** 캐시 없이 오프라인이면 조회가 연결될 때까지 멈추므로 이유를 알리고 닫을 길을 준다 */
export function VoiceNoteOffline({ className }: { className?: string }) {
  const { t } = useTranslation('voiceNote');

  return (
    <Result
      testID="voice-note-screen-offline"
      className={className}
      title={t('offlineScreen.title')}
      description={t('offlineScreen.description')}
      button={<Result.Button onPress={() => router.back()}>{t('record.close')}</Result.Button>}
    />
  );
}
