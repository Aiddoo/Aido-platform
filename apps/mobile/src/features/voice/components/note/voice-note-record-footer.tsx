import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  HStack,
  PauseIcon,
  StopIcon,
  Text,
  VStack,
  SurfaceCard,
} from '@src/shared/ui';
import { match, P } from 'ts-pattern';

import { VoiceCapturePolicy, type VoiceCaptureState } from '../../domains/voice-capture.model';
import { RECORD_BUTTON_ICON_SIZE, RecordButton } from './record-button';
import { VoiceNoteMarkControl } from './voice-note-mark-control';

interface VoiceNoteRecordFooterProps {
  state: VoiceCaptureState;
  limitMs: number | null;
  markCount: number;
  onPause: () => void;
  onFinish: () => void;
  onMark: () => void;
  onSummarize: () => void;
  onClose: () => void;
  onResume: () => void;
}

export function VoiceNoteRecordFooter({
  state,
  limitMs,
  markCount,
  onPause,
  onFinish,
  onMark,
  onSummarize,
  onClose,
  onResume,
}: VoiceNoteRecordFooterProps) {
  const { t } = useTranslation('voiceNote');

  return (
    <VStack gap={12} className="self-stretch">
      {match(state)
        .with({ status: P.union('paused', 'failed') }, (stopped) => (
          <StoppedPanel
            state={stopped}
            canResume={VoiceCapturePolicy.canResumeWithinLimit(stopped, limitMs)}
            onSummarize={onSummarize}
            onClose={onClose}
            onResume={onResume}
          />
        ))
        .otherwise(() => (
          <Box className="w-full max-w-90 self-center">
            <ListeningControls
              isListening={state.status === 'listening'}
              markCount={markCount}
              onPause={onPause}
              onFinish={onFinish}
              onMark={onMark}
            />
          </Box>
        ))}
      <Text size="e1" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
        {t('record.privacy')}
      </Text>
    </VStack>
  );
}

function ListeningControls({
  isListening,
  markCount,
  onPause,
  onFinish,
  onMark,
}: {
  isListening: boolean;
  markCount: number;
  onPause: () => void;
  onFinish: () => void;
  onMark: () => void;
}) {
  const { t } = useTranslation('voiceNote');
  const fontScaledSize = useFontScaledSize();
  const iconSize = fontScaledSize(RECORD_BUTTON_ICON_SIZE);

  return (
    <HStack align="start">
      <RecordButton
        label={t('record.pause')}
        onPress={onPause}
        isDisabled={!isListening}
        testID="voice-note-pause"
      >
        <PauseIcon width={iconSize} height={iconSize} colorClassName="text-gray-7" />
      </RecordButton>
      <RecordButton
        label={t('record.finish')}
        onPress={onFinish}
        isDisabled={!isListening}
        isPrimary
        testID="voice-note-finish"
      >
        <StopIcon width={iconSize} height={iconSize} colorClassName="text-white dark:text-gray-9" />
      </RecordButton>
      <VoiceNoteMarkControl markCount={markCount} isListening={isListening} onPress={onMark} />
    </HStack>
  );
}

function StoppedPanel({
  state,
  canResume,
  onSummarize,
  onClose,
  onResume,
}: {
  state: Extract<VoiceCaptureState, { status: 'paused' | 'failed' }>;
  canResume: boolean;
  onSummarize: () => void;
  onClose: () => void;
  onResume: () => void;
}) {
  const { t } = useTranslation('voiceNote');
  const hasHeard = VoiceCapturePolicy.canFinish(state);

  return (
    <VStack gap={12}>
      <SurfaceCard className="gap-1 px-4 py-3">
        <Text size="b3" weight="semibold" lineBreakStrategyIOS="hangul-word">
          {state.status === 'paused' ? t('record.pausedTitle') : t('record.failedTitle')}
        </Text>
        <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
          {match(state)
            .with({ status: 'paused' }, ({ cause }) =>
              hasHeard
                ? t(`record.pausedDescription.${cause}`)
                : t(`record.pausedEmptyDescription.${cause}`),
            )
            .with({ status: 'failed', reason: P.union('not-allowed', 'service-not-allowed') }, () =>
              t('record.failedPermission'),
            )
            .otherwise(() =>
              hasHeard ? t('record.failedDescription') : t('record.failedEmptyDescription'),
            )}
        </Text>
      </SurfaceCard>
      <HStack gap={8}>
        <Box flex={1}>
          {hasHeard ? (
            <Button
              size="large"
              variant="weak"
              color="dark"
              onPress={onSummarize}
              testID="voice-note-summarize"
            >
              {t('record.summarize')}
            </Button>
          ) : (
            <Button
              size="large"
              variant="weak"
              color="dark"
              onPress={onClose}
              testID="voice-note-stopped-close"
            >
              {t('record.close')}
            </Button>
          )}
        </Box>
        {canResume && (
          <Box flex={1}>
            <Button size="large" onPress={onResume} testID="voice-note-resume">
              {t('record.resume')}
            </Button>
          </Box>
        )}
      </HStack>
    </VStack>
  );
}
