import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useTranslation } from '@src/shared/i18n';
import { Result } from '@src/shared/ui';

/** 캐시 없이 오프라인이면 조회가 연결될 때까지 멈추므로 이유를 알리고 닫을 길을 준다 */
export function VoiceNoteOffline({ className }: { className?: string }) {
  const { t } = useTranslation('voiceNote');
  // 빠른 실행·위젯처럼 쌓인 화면 없이 열었으면 메모 탭으로 닫는다
  const close = useGoBack({ fallbackHref: '/memo' });

  return (
    <Result
      testID="voice-note-screen-offline"
      className={className}
      title={t('offlineScreen.title')}
      description={t('offlineScreen.description')}
      button={<Result.Button onPress={close}>{t('record.close')}</Result.Button>}
    />
  );
}
