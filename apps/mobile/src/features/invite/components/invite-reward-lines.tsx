import { useTranslation } from '@src/shared/i18n';
import { Box, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { ComponentProps } from 'react';

import { InviteRewardPolicy } from '../domains/invite-reward.model';
import { InvitedFriendPolicy } from '../domains/invited-friend.model';

/** 내 초대 화면에서 친구와 내가 각각 무엇을 언제 받는지 이름표와 함께 한 줄씩 나눠 보여 준다 */
export function InviteRewardLines({ className, ...props }: ComponentProps<typeof VStack>) {
  const { t } = useTranslation('invite');
  const lines = [
    {
      key: 'invitee',
      label: t('myInvite.rewardInviteeLabel'),
      value: t('myInvite.rewardInvitee', { days: InviteRewardPolicy.welcomePremiumDays() }),
    },
    {
      key: 'inviter',
      label: t('myInvite.rewardInviterLabel'),
      value: t('myInvite.rewardInviter', {
        activeDays: InvitedFriendPolicy.requiredActiveDays(),
        days: InviteRewardPolicy.inviterPremiumDays(),
      }),
    },
  ];

  return (
    <VStack
      gap={14}
      className={cn('rounded-3xl border border-gray-2 bg-white px-[18px] py-4', className)}
      {...props}
    >
      {lines.map((line) => (
        <VStack
          key={line.key}
          gap={6}
          accessible
          accessibilityLabel={`${line.label}, ${line.value}`}
        >
          <Box className="self-start rounded-full bg-main/10 px-2.5 py-0.5">
            <Text size="e1" weight="bold" tone="brand">
              {line.label}
            </Text>
          </Box>
          <Text
            size="b3"
            shade={9}
            lineBreakStrategyIOS="hangul-word"
            textBreakStrategy="highQuality"
          >
            {line.value}
          </Text>
        </VStack>
      ))}
    </VStack>
  );
}
