import { useTranslation } from '@src/shared/i18n';
import { Box, Button, HStack, PawIcon, Text } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { useGetNudgeInteractionAvailabilityQueryOptions } from '../../queries/get-nudge-interaction-availability-query-options';

export function NudgeInboxLink() {
  const { t } = useTranslation('todo');
  const { data: isAvailable } = useQuery(useGetNudgeInteractionAvailabilityQueryOptions());
  if (!isAvailable) return null;
  return (
    <Box px={16} py={8}>
      <Button variant="weak" color="primary" onPress={() => router.push('/nudges')}>
        <HStack align="center" gap={8}>
          <PawIcon width={18} height={18} colorClassName="text-main" />
          <Text size="b3" weight="semibold" tone="brand">
            {t('interaction.entry')}
          </Text>
        </HStack>
      </Button>
    </Box>
  );
}
