import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { Box, CheckIcon, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';

import { useActivationChecklist } from '../hooks/use-activation-progress';

interface ActivationChecklistProps {
  className?: string;
}

export function ActivationChecklist({ className }: ActivationChecklistProps) {
  const { t } = useTranslation('todo');
  const { progress, isVisible } = useActivationChecklist();

  if (!isVisible) {
    return null;
  }

  const hasCreated = progress.todoCreatedAt != null;
  const hasCompleted = progress.activatedAt != null;

  return (
    <VStack
      gap={12}
      className={cn('rounded-2xl border border-gray-2 bg-white p-4', className)}
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

      <ActivationStep label={t('activation.createTodo')} isCompleted={hasCreated} />
      <ActivationStep label={t('activation.completeTodo')} isCompleted={hasCompleted} />
    </VStack>
  );
}

function ActivationStep({ label, isCompleted }: { label: string; isCompleted: boolean }) {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('todo');
  const status = isCompleted ? t('activation.completed') : t('activation.incomplete');

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
          isCompleted ? 'border-main bg-main' : 'border-gray-4 bg-white',
        )}
      >
        {isCompleted && (
          <CheckIcon
            width={fontScaledSize(14)}
            height={fontScaledSize(14)}
            colorClassName="text-white"
          />
        )}
      </Box>
      <Text size="b3" weight={isCompleted ? 'medium' : 'normal'} shade={isCompleted ? 5 : 8}>
        {label}
      </Text>
    </HStack>
  );
}
