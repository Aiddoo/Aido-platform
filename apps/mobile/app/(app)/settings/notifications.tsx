import { getPreferenceQueryOptions } from '@src/features/auth/presentations/queries/get-preference-query-options';
import { updatePreferenceMutationOptions } from '@src/features/auth/presentations/queries/update-preference-mutation-options';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Divider, FormField, Skeleton, SkeletonGroup } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView, View } from 'react-native';

const NotificationSettingsScreen = () => {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <Spacing size={20} />
        <QueryErrorBoundary>
          <Suspense fallback={<NotificationSettingsForm.Loading />}>
            <NotificationSettingsForm />
          </Suspense>
        </QueryErrorBoundary>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default NotificationSettingsScreen;

function NotificationSettingsForm() {
  const { data: preference } = useSuspenseQuery(getPreferenceQueryOptions());
  const updateMutation = useMutation(updatePreferenceMutationOptions());

  return (
    <VStack p={8} gap={8} className="bg-white rounded-2xl">
      <FormField
        isSelected={preference.pushEnabled}
        onSelectedChange={(enabled) => updateMutation.mutate({ pushEnabled: enabled })}
        isDisabled={updateMutation.isPending}
        className="py-2"
      >
        <View className="flex-1">
          <FormField.Label>푸시 알림</FormField.Label>
          <FormField.Description>모든 푸시 알림을 받습니다</FormField.Description>
        </View>
        <FormField.Indicator />
      </FormField>

      <Divider className="bg-gray-2" />

      <FormField
        isSelected={preference.nightPushEnabled}
        onSelectedChange={(enabled) => {
          if (!preference.pushEnabled) return;
          updateMutation.mutate({ nightPushEnabled: enabled });
        }}
        isDisabled={updateMutation.isPending || !preference.pushEnabled}
        className="py-2"
      >
        <View className="flex-1">
          <FormField.Label>야간 푸시 알림</FormField.Label>
          <FormField.Description>
            {preference.pushEnabled
              ? '21:00 - 08:00 시간대에도 알림을 받습니다'
              : '푸시 알림을 먼저 활성화해주세요'}
          </FormField.Description>
        </View>
        <FormField.Indicator />
      </FormField>
    </VStack>
  );
}

NotificationSettingsForm.Loading = function Loading() {
  return (
    <VStack p={8} gap={8} className="bg-white rounded-2xl">
      <SkeletonGroup isLoading isSkeletonOnly>
        <HStack justify="between" align="center" className="py-2">
          <VStack flex={1} gap={2}>
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-4 w-48 rounded" />
          </VStack>
          <Skeleton className="h-8 w-14 rounded-full" />
        </HStack>

        <Divider className="bg-gray-2" />

        <HStack justify="between" align="center" className="py-2">
          <VStack flex={1} gap={2}>
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-4 w-56 rounded" />
          </VStack>
          <Skeleton className="h-8 w-14 rounded-full" />
        </HStack>
      </SkeletonGroup>
    </VStack>
  );
};
