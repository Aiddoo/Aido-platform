import { FriendSearchList } from '@src/features/friend/components/friend-search-list';
import { useGetInviteAvailabilityQueryOptions } from '@src/features/invite/queries/get-invite-availability-query-options';
import { useTranslation } from '@src/shared/i18n';
import { Box, Input, QueryErrorBoundary, SearchIcon, StyledSafeAreaView } from '@src/shared/ui';
import { usePrefetchQuery } from '@tanstack/react-query';
import { useState } from 'react';

export default function SearchFriendScreen() {
  const { t } = useTranslation('friend');
  const [query, setQuery] = useState('');
  // 친구 한도 안내에 초대로 자리를 늘리는 길을 보여 줄지 미리 알아 둔다
  usePrefetchQuery(useGetInviteAvailabilityQueryOptions());

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
      <Box px={16} py={12}>
        <Input
          leftContent={<SearchIcon width={20} height={20} colorClassName="text-gray-5" />}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={setQuery}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          renderErrorMessage={false}
        />
      </Box>
      <Box flex={1} px={16}>
        <QueryErrorBoundary resetKeys={[query.trim()]} fallback={FriendSearchList.Error}>
          <FriendSearchList query={query} />
        </QueryErrorBoundary>
      </Box>
    </StyledSafeAreaView>
  );
}
