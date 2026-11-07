import { AddFriendForm } from '@src/features/social/friend/components/add-friend-form';
import { useFriendLimitInvite } from '@src/features/social/invite/hooks/use-friend-limit-invite';
import { useTranslation } from '@src/shared/i18n';
import { Box, H3, QueryErrorBoundary, Spacing, Text } from '@src/shared/ui';

export default function AddFriendScreen() {
  const { t } = useTranslation('friend');
  const onFriendLimitInvite = useFriendLimitInvite();

  return (
    <Box className="flex-1 bg-white">
      <QueryErrorBoundary>
        <AddFriendForm onFriendLimitInvite={onFriendLimitInvite}>
          <H3>{t('add.title')}</H3>

          <Spacing size={4} />

          <Text size="b4" shade={6}>
            {t('add.description')}
          </Text>

          <Spacing size={24} />
        </AddFriendForm>
      </QueryErrorBoundary>
    </Box>
  );
}
