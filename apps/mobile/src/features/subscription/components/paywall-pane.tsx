import { useIsOnline } from '@src/shared/hooks/use-is-online';
import {
  Box,
  HStack,
  type QueryErrorFallbackProps,
  ScallopedContainer,
  Spacing,
  StyledSafeAreaView,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Skeleton } from 'heroui-native';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

import { useGetOfferingsQueryOptions } from '../queries/get-offerings-query-options';
import {
  toSubscriptionLoadFailure,
  toSubscriptionStoreUnavailableFailure,
} from '../utils/view-models/subscription-failure.view-model';
import { Paywall } from './paywall';
import { SubscriptionResult } from './subscription-result';

const BENEFIT_ROW_COUNT = 3;
const PLAN_ROW_COUNT = 2;

/** 요금제를 스토어에서 받아 페이월을 그린다. 스토어를 쓸 수 없으면 예상한 상태라 오류 경계 대신 안내한다 */
export function PaywallPane() {
  const { data: availability, refetch } = useSuspenseQuery(useGetOfferingsQueryOptions());

  return match(availability)
    .with({ status: 'available' }, ({ offering }) => <Paywall offering={offering} />)
    .with({ status: 'unavailable' }, ({ unavailable }) => (
      <SubscriptionResult.Failure
        failure={toSubscriptionStoreUnavailableFailure(unavailable)}
        onRetry={() => refetch()}
      />
    ))
    .exhaustive();
}

/** 받은 뒤에 화면이 밀리지 않게 요금제 화면과 같은 자리·모양의 스켈레톤을 둔다 */
PaywallPane.Loading = function Loading() {
  const isOnline = useIsOnline();

  if (!isOnline) {
    return <SubscriptionResult.Offline target="plans" />;
  }

  return (
    <Box
      className="flex-1"
      accessibilityState={{ busy: true }}
      testID="subscription-paywall-loading"
    >
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8" scrollEnabled={false}>
        <StyledSafeAreaView edges={['left', 'right']}>
          <Spacing size={16} />
          <ScallopedContainer>
            <VStack gap={24} className="p-5">
              <VStack gap={4} align="center">
                <TextSkeleton size="t2" className="w-48" />
                <TextSkeleton size="b3" className="w-56" />
              </VStack>
              {times(BENEFIT_ROW_COUNT, (index) => (
                <HStack key={index} gap={16} align="center">
                  <Skeleton className="size-14 rounded-xl" />
                  <VStack flex={1} gap={4}>
                    <TextSkeleton size="b3" className="w-2/3" />
                    <TextSkeleton size="b4" className="w-full" />
                  </VStack>
                </HStack>
              ))}
              {times(PLAN_ROW_COUNT, (index) => (
                <Skeleton key={index} className="h-16 rounded-2xl" />
              ))}
            </VStack>
          </ScallopedContainer>
        </StyledSafeAreaView>
      </ScrollView>
      <StyledSafeAreaView edges={['left', 'right']} className="px-4 pb-4 pt-2">
        <Skeleton className="h-14 rounded-2xl" />
      </StyledSafeAreaView>
    </Box>
  );
};

/** 스토어에서 요금제를 받지 못해도 빈 화면 대신 다시 시도와 문의를 보여 준다 */
PaywallPane.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  return (
    <SubscriptionResult.Failure
      failure={toSubscriptionLoadFailure('plans', error)}
      onRetry={reset}
    />
  );
};
