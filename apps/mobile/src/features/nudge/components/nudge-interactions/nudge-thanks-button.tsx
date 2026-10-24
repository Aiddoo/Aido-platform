import { useTranslation } from '@src/shared/i18n';
import { Button, HeartFilledIcon, HStack, Text } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { type ComponentProps } from 'react';

import { useGetNudgeInteractionAvailabilityQueryOptions } from '../../queries/get-nudge-interaction-availability-query-options';

export function NudgeThanksButton(props: Omit<ComponentProps<typeof Button>, 'children'>) {
  const { t } = useTranslation('todo');
  const availability = useQuery(useGetNudgeInteractionAvailabilityQueryOptions());
  if (!availability.data) {
    return null;
  }

  return (
    <Button {...props} variant={props.variant ?? 'weak'} color={props.color ?? 'primary'}>
      <HStack align="center" justify="center" gap={8}>
        <HeartFilledIcon width={20} height={20} colorClassName="text-main" />
        <Text size="b4" tone="brand" weight="semibold" className="shrink">
          {t('interaction.thanksAction')}
        </Text>
      </HStack>
    </Button>
  );
}
