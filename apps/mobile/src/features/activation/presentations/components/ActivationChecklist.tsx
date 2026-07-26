import type { ActivationProgress } from '@src/features/activation/models/activation.model';
import { useTranslation } from '@src/shared/i18n';
import { Box, CheckIcon, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { fontScaledSize } from '@src/shared/utils/scale';

interface ActivationChecklistProps {
  progress: ActivationProgress;
}

export function ActivationChecklist({ progress }: ActivationChecklistProps) {
  const { t } = useTranslation('todo');
  const hasCreated = progress.todoCreatedAt !== null;
  const hasCompleted = progress.activatedAt !== null;

  return (
    <VStack
      gap={12}
      className="rounded-2xl border border-gray-2 bg-white p-4"
      accessibilityLabel={t('activation.accessibilityLabel')}
    >
      <VStack gap={2}>
        <Text size="b2" weight="semibold">
          {t('activation.title')}
        </Text>
        <Text size="b4" shade={6}>
          {t('activation.description')}
        </Text>
      </VStack>

      <ActivationStep label={t('activation.createTodo')} completed={hasCreated} />
      <ActivationStep label={t('activation.completeTodo')} completed={hasCompleted} />
    </VStack>
  );
}

function ActivationStep({ label, completed }: { label: string; completed: boolean }) {
  const { t } = useTranslation('todo');
  const status = completed ? t('activation.completed') : t('activation.incomplete');

  return (
    <HStack
      gap={10}
      align="center"
      accessibilityRole="text"
      accessibilityLabel={t('activation.stepAccessibilityLabel', { label, status })}
    >
      <Box
        className={cn(
          'size-6 items-center justify-center rounded-full border',
          completed ? 'border-main bg-main' : 'border-gray-4 bg-white',
        )}
      >
        {completed && (
          <CheckIcon
            width={fontScaledSize(14)}
            height={fontScaledSize(14)}
            colorClassName="text-white"
          />
        )}
      </Box>
      <Text size="b3" weight={completed ? 'medium' : 'normal'} shade={completed ? 5 : 8}>
        {label}
      </Text>
    </HStack>
  );
}
