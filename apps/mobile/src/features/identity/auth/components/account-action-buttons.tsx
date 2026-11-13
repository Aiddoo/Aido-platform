import { UserPolicy } from '@src/features/identity/user/domains/user.model';
import { useMyPageMenuNavigate } from '@src/features/identity/user/hooks/use-my-page-menu-navigation';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  TextButton,
  TextSkeleton,
  useConfirmDialog,
  SettingsListGroup,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';

import {
  useDeleteAccountMutationOptions,
  useLogoutMutationOptions,
} from '../queries/auth.mutations';

export function AccountActionButtons() {
  const navigate = useMyPageMenuNavigate();
  const { t } = useTranslation(['user', 'common']);
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const logout = useMutation(useLogoutMutationOptions());
  const deleteAccount = useMutation(useDeleteAccountMutationOptions());
  const confirmDialog = useConfirmDialog();
  const isPending = logout.isPending || deleteAccount.isPending;

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

    await confirmDialog.openAsync({
      title: t('withdraw.confirmTitle'),
      description: t('withdraw.confirmDescription'),
      cancelLabel: t('common:actions.cancel'),
      confirmLabel: t('withdraw.confirmAction'),
      confirmColor: 'danger',
      onConfirm: () => deleteAccount.mutateAsync({}),
    });
  };

  return (
    <HStack justify="center" align="center" gap={8}>
      <TextButton size="medium" onPress={handleLogoutPress} isDisabled={isPending}>
        {t('logout.action')}
      </TextButton>
      <Separator orientation="vertical" className="h-3 bg-gray-6" />
      <TextButton size="medium" onPress={handleWithdrawPress} isDisabled={isPending}>
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

AccountActionButtons.Error = SettingsListGroup.Error;
