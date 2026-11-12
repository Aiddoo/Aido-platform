import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { Box, CheckmarkIcon, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatCount } from '@src/shared/utils/number-format';
import { Spinner } from 'heroui-native';

interface DigestProgressProps {
  characterCount: number;
  markCount: number;
}

export function DigestProgress({ characterCount, markCount }: DigestProgressProps) {
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
        {status === 'done' && <CheckmarkIcon colorClassName="text-white" width={14} height={14} />}
        {status === 'doing' && <Spinner size="sm" color="accent" />}
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
