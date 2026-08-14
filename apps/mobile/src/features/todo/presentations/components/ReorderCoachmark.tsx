import { useReorderCoachmarkService } from '@src/bootstrap/providers/di-context';
import { useTranslation } from '@src/shared/i18n';
import { CloseIcon, HStack, InfoIcon, Text } from '@src/shared/ui';
import { fontScaledSize } from '@src/shared/utils/scale';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';

import type { ReorderCoachmarkKind } from '../../repositories/reorder-coachmark.repository';

interface ReorderCoachmarkProps {
  accountId: string;
  kind: ReorderCoachmarkKind;
}

export function ReorderCoachmark({ accountId, kind }: ReorderCoachmarkProps) {
  const { t } = useTranslation('todo');
  const service = useReorderCoachmarkService();
  const [isVisible, setIsVisible] = useState(() => service.claim({ accountId, kind }));

  if (!isVisible) {
    return null;
  }

  return (
    <HStack
      gap={8}
      align="center"
      className="rounded-xl bg-gray-2 px-3 py-2.5"
      accessibilityRole="alert"
    >
      <InfoIcon width={fontScaledSize(17)} height={fontScaledSize(17)} colorClassName="text-main" />
      <Text size="b4" shade={7} className="flex-1 shrink">
        {t(`reorderCoachmark.${kind}`)}
      </Text>
      <PressableFeedback
        hitSlop={14}
        onPress={() => setIsVisible(false)}
        accessibilityRole="button"
        accessibilityLabel={t('reorderCoachmark.dismiss')}
      >
        <CloseIcon
          width={fontScaledSize(16)}
          height={fontScaledSize(16)}
          colorClassName="text-gray-6"
        />
      </PressableFeedback>
    </HStack>
  );
}
