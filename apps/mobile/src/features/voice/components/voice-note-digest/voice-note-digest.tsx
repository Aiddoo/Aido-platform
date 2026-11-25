import { useQuotaStatus } from '@src/features/billing/subscription/hooks/use-quota-status';
import { useSuspenseMyAccountId } from '@src/features/identity/user/hooks/use-suspense-my-account-id';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  AiFilledIcon,
  Box,
  Button,
  CheckmarkIcon,
  HStack,
  SurfaceCard,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatCount } from '@src/shared/utils/number-format';
import { Stack } from 'expo-router';
import { Spinner } from 'heroui-native';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import { VoiceNotePolicy } from '../../domains/voice-note.model';
import { canRetryPlanFailure } from '../../domains/voice.error';
import { useCurrentVoiceNote } from '../../hooks/use-current-voice-note';
import { useVoiceNoteDigest, type VoiceNoteDigestFailure } from '../../hooks/use-voice-note-digest';
import { useVoiceNoteDraftId } from '../../hooks/use-voice-note-params';
import { SentenceCaptionList } from '../sentence-caption-list';
import { VoiceNoteToolbar } from '../voice-note-toolbar';
import { DigestScanPreview } from './digest-scan-preview';

const SCAN_PREVIEW_SENTENCES = 12;

interface VoiceNoteDigestProps {
  onMemoChanged: () => void;
}

export function VoiceNoteDigest({ onMemoChanged }: VoiceNoteDigestProps) {
  const { t } = useTranslation('voiceNote');
  const accountId = useSuspenseMyAccountId();
  const [draftId] = useVoiceNoteDraftId();
  const note = useCurrentVoiceNote(accountId);
  const { digest, isPending, failure } = useVoiceNoteDigest({ accountId, draftId });

  if (isPending) {
    return <VoiceNoteDigest.Progress />;
  }

  return (
    <VStack flex={1} gap={12} className="pb-3">
      <Stack.Screen options={{ title: t('digest.readyTitle') }} />
      <VoiceNoteToolbar onMemoChanged={onMemoChanged} />
      <SentenceCaptionList sentences={note.sentences} className="min-h-24 flex-1" />
      {failure != null && <VoiceNoteDigest.Failure failure={failure} />}
      {(failure == null || canRetryPlanFailure(failure.cause)) && (
        <DigestButton
          label={failure == null ? t('digest.action') : t('digest.retry')}
          isDisabled={!VoiceNotePolicy.canDigest(note)}
          onPress={() => digest()}
        />
      )}
    </VStack>
  );
}

VoiceNoteDigest.Progress = function Progress() {
  const { t } = useTranslation('voiceNote');
  const accountId = useSuspenseMyAccountId();
  const note = useCurrentVoiceNote(accountId);

  return (
    <VStack flex={1} gap={16} className="pb-3" testID="voice-note-digesting">
      <Stack.Screen options={{ title: t('digest.title') }} />
      <DigestScanPreview
        paragraphs={note.sentences.slice(0, SCAN_PREVIEW_SENTENCES).map(({ text }) => text)}
        className="max-h-[50%]"
      />
      <DigestProgress
        characterCount={VoiceNotePolicy.getCharacterCount(note)}
        markCount={VoiceNotePolicy.getMarkCount(note)}
      />
      <Text size="e1" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
        {t('digest.hint')}
      </Text>
    </VStack>
  );
};

VoiceNoteDigest.Failure = function Failure({ failure }: { failure: VoiceNoteDigestFailure }) {
  const { t } = useTranslation(['voiceNote', 'voicePlan']);

  return (
    <SurfaceCard className="gap-1 px-4 py-3" testID="voice-note-digest-failure">
      <Text size="b3" weight="semibold" lineBreakStrategyIOS="hangul-word">
        {t(`voicePlan:failure.${failure.cause}.title`)}
      </Text>
      <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
        {failure.cause === 'too-long' ? `${t('voiceNote:digest.tooLong')} ` : ''}
        {failure.cause === 'network' ? `${t('voiceNote:digest.offline')} ` : ''}
        {t('voiceNote:digest.kept')}
        {failure.isFreeOfCharge ? ` ${t('voiceNote:digest.notCharged')}` : ''}
      </Text>
    </SurfaceCard>
  );
};

interface DigestButtonProps extends Omit<ComponentProps<typeof Button>, 'children'> {
  label: string;
}

/** 확인 창 없이 횟수를 쓰므로 보조 문구로 알린다. 프리미엄·관리자는 숨기고, 읽는 동안 자리를 잡아 밀리지 않게 한다 */
function DigestButton({ label, ...buttonProps }: DigestButtonProps) {
  const { t } = useTranslation('voiceNote');
  const fontScaledSize = useFontScaledSize();
  const { status, isPending } = useQuotaStatus('VOICE_NOTE');
  const cost = match(status)
    .with({ type: 'untracked' }, () => null)
    .with({ type: 'remaining' }, ({ count }) => t('digest.cost', { amount: count }))
    .with({ type: 'used-up' }, () => t('digest.usedUp'))
    .exhaustive();

  return (
    <VStack gap={8}>
      <Button {...buttonProps} testID="voice-note-digest">
        {label}
      </Button>
      {cost == null && isPending && <TextSkeleton size="e1" className="mx-auto w-32" />}
      {cost != null && (
        <HStack gap={4} align="center" justify="center">
          <AiFilledIcon
            width={fontScaledSize(14)}
            height={fontScaledSize(14)}
            colorClassName="text-main"
          />
          <Text size="e1" shade={6} numberOfLines={1} testID="voice-note-digest-cost">
            {cost}
          </Text>
        </HStack>
      )}
    </VStack>
  );
}

interface DigestProgressProps {
  characterCount: number;
  markCount: number;
}

function DigestProgress({ characterCount, markCount }: DigestProgressProps) {
  const { t } = useTranslation('voiceNote');
  const { locale } = useDateFormatContext();

  // 핵심과 할 일은 서버가 한 요청으로 만들어 어느 쪽이 끝났는지 몰라 둘 다 진행 중으로 둔다
  return (
    <VStack gap={12}>
      <DigestProgress.Step
        label={t('digest.steps.transcript')}
        status="done"
        detail={t('digest.characters', {
          count: characterCount,
          amount: formatCount(characterCount, locale),
        })}
      />
      <DigestProgress.Step
        label={t('digest.steps.keyPoints')}
        status="doing"
        detail={markCount > 0 ? t('digest.marks', { count: markCount }) : undefined}
      />
      <DigestProgress.Step label={t('digest.steps.todos')} status="doing" />
    </VStack>
  );
}

interface DigestStepProps {
  label: string;
  status: 'done' | 'doing';
  detail?: string;
}

DigestProgress.Step = function Step({ label, status, detail }: DigestStepProps) {
  const { t } = useTranslation('voiceNote');
  const fontScaledSize = useFontScaledSize();
  const stateLabel = {
    done: t('digest.state.done'),
    doing: t('digest.state.doing'),
  }[status];

  return (
    <HStack
      accessible
      accessibilityLabel={`${label}, ${stateLabel}`}
      gap={12}
      className="items-center"
    >
      <Box
        className={cn(
          'size-6 items-center justify-center rounded-full border-2',
          status === 'done' ? 'border-main bg-main' : 'border-gray-3',
        )}
      >
        {status === 'done' && (
          <CheckmarkIcon
            colorClassName="text-white"
            width={fontScaledSize(14)}
            height={fontScaledSize(14)}
          />
        )}
        {status === 'doing' && <Spinner size="sm" />}
      </Box>
      <Text
        size="b3"
        weight={status === 'doing' ? 'semibold' : 'normal'}
        shade={10}
        numberOfLines={1}
        className="shrink"
      >
        {label}
      </Text>
      {detail != null && (
        <Text size="e1" shade={6} numberOfLines={1} className="ml-auto tabular-nums">
          {detail}
        </Text>
      )}
    </HStack>
  );
};
