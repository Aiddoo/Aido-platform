import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { Box, CheckIcon, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { toDateFormatLocale } from '@src/shared/utils/date-format';
import { formatCount } from '@src/shared/utils/format';
import { Spinner } from 'heroui-native';
import type { ComponentProps } from 'react';

import {
  type DigestProgress as DigestProgressValue,
  type DigestStepStatus,
  getDigestStepStatus,
} from '../../utils/view-models/digest-progress.view-model';

interface DigestProgressProps extends Omit<ComponentProps<typeof VStack>, 'children'> {
  /** 실제 진행 단계. 서버 응답을 기다리는 동안은 핵심 고르기다 */
  progress: DigestProgressValue;
  characterCount: number;
  markCount: number;
}

/** 정리 중 단계 3개. 글자 정리는 기기에서 끝나고, 핵심·할 일은 응답이 오면 차례로 끝난다 */
export function DigestProgress({
  progress,
  characterCount,
  markCount,
  ...stackProps
}: DigestProgressProps) {
  const { t } = useTranslation('voiceNote');
  const locale = toDateFormatLocale(useLanguage().resolvedLanguage);

  return (
    <VStack gap={10} {...stackProps}>
      <DigestProgress.Step
        label={t('digest.steps.transcript')}
        status={getDigestStepStatus(progress, 'transcript')}
        detail={t('digest.characters', {
          count: characterCount,
          amount: formatCount(characterCount, locale),
        })}
      />
      <DigestProgress.Step
        label={t('digest.steps.keyPoints')}
        status={getDigestStepStatus(progress, 'key-points')}
        detail={markCount > 0 ? t('digest.marks', { count: markCount }) : undefined}
      />
      <DigestProgress.Step
        label={t('digest.steps.todos')}
        status={getDigestStepStatus(progress, 'to-dos')}
      />
    </VStack>
  );
}

interface DigestStepProps {
  label: string;
  status: DigestStepStatus;
  detail?: string;
}

function DigestStep({ label, status, detail }: DigestStepProps) {
  const { t } = useTranslation('voiceNote');
  const stateLabel = {
    done: t('digest.state.done'),
    doing: t('digest.state.doing'),
    waiting: t('digest.state.waiting'),
  }[status];

  return (
    <HStack
      accessible
      accessibilityLabel={`${label}, ${stateLabel}`}
      gap={10}
      className="items-center"
    >
      <Box
        className={cn(
          'size-[22px] items-center justify-center rounded-full border-2',
          status === 'done' ? 'border-main bg-main' : 'border-gray-3',
        )}
      >
        {status === 'done' && <CheckIcon colorClassName="accent-white" width={12} height={12} />}
        {status === 'doing' && <Spinner size="sm" color="accent" />}
      </Box>
      <Text
        size="b3"
        weight={status === 'doing' ? 'semibold' : 'normal'}
        shade={status === 'waiting' ? 5 : 10}
        maxLines={1}
        className="shrink"
      >
        {label}
      </Text>
      {detail != null && (
        <Text size="e1" shade={6} maxLines={1} className="ml-auto tabular-nums">
          {detail}
        </Text>
      )}
    </HStack>
  );
}

DigestProgress.Step = DigestStep;
