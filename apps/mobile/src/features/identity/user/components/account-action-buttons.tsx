import {
  useDeleteAccountMutationOptions,
  useLogoutMutationOptions,
} from '@src/features/identity/auth/queries/auth.mutations';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, TextButton, TextSkeleton, useConfirmDialog } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';

import { UserPolicy } from '../domains/user.model';
import { useMyPageMenuNavigation } from '../hooks/use-my-page-menu-navigation';
import { useGetMeQueryOptions } from '../queries/user.queries';

export function AccountActionButtons() {
  const { navigate } = useMyPageMenuNavigation();
  const { t } = useTranslation(['user', 'common']);
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const logout = useMutation(useLogoutMutationOptions());
  const deleteAccount = useMutation(useDeleteAccountMutationOptions());
  const confirmDialog = useConfirmDialog();

  const handleLogoutPress = async () => {
    const isConfirmed = await confirmDialog.openAsync({
      title: t('logout.confirmTitle'),
      description: t('logout.confirmDescription'),
      cancelLabel: t('common:actions.cancel'),
      confirmLabel: t('common:actions.confirm'),
    });
    if (isConfirmed) {
      logout.mutate();
    }
  };

  const handleWithdrawPress = async () => {
    if (UserPolicy.hasCredential(user)) {
      navigate('/settings/delete-account');
      return;
    }

    const isConfirmed = await confirmDialog.openAsync({
      title: t('withdraw.confirmTitle'),
      description: t('withdraw.confirmDescription'),
      cancelLabel: t('common:actions.cancel'),
      confirmLabel: t('withdraw.confirmAction'),
      confirmColor: 'danger',
    });
    if (isConfirmed) {
      deleteAccount.mutate({});
    }
  };

  return (
    <HStack justify="center" align="center" gap={8}>
      <TextButton size="medium" onPress={handleLogoutPress}>
        {t('logout.action')}
      </TextButton>
      <Separator orientation="vertical" className="h-3 bg-gray-6" />
      <TextButton size="medium" onPress={handleWithdrawPress}>
        {t('withdraw.action')}
      </TextButton>
    </HStack>
  );
}

AccountActionButtons.Loading = function Loading() {
  return (
    <Box accessibilityState={{ busy: true }} className="items-center">
      <TextSkeleton size="b4" className="w-40" />
    </Box>
  );
};
