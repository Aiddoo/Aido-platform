import { FriendSearchList } from '@src/features/friend/presentations/components/FriendSearchList';
import { useTranslation } from '@src/shared/i18n';
import { Box, Input, QueryErrorBoundary, SearchIcon, VStack } from '@src/shared/ui';
import { useState } from 'react';

export default function SearchFriendScreen() {
  const { t } = useTranslation('friend');
  const [query, setQuery] = useState('');

  return (
    <VStack flex={1} className="bg-background">
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
    </VStack>
  );
}
