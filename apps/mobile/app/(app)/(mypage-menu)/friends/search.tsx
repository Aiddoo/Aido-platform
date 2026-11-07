import { FriendSearchList } from '@src/features/social/friend/components/friend-search-list';
import { useFriendLimitInvite } from '@src/features/social/invite/hooks/use-friend-limit-invite';
import { useTranslation } from '@src/shared/i18n';
import { Box, Input, QueryErrorBoundary, SearchIcon, StyledSafeAreaView } from '@src/shared/ui';
import { useState } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

export default function SearchFriendScreen() {
  const { t } = useTranslation('friend');
  const [query, setQuery] = useState('');
  const onFriendLimitReached = useFriendLimitInvite();

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
      <Box px={16} py={12}>
        <Input
          testID="friend-search-input"
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
      {/* 검색 중에는 키보드가 떠 있으므로 결과 영역을 키보드 위로 줄여 가운데 안내가 가려지지 않게 한다 */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset>
        <Box flex={1} px={16}>
          <QueryErrorBoundary resetKeys={[query.trim()]} fallback={FriendSearchList.Error}>
            <FriendSearchList query={query} onFriendLimitReached={onFriendLimitReached} />
          </QueryErrorBoundary>
        </Box>
      </KeyboardAvoidingView>
    </StyledSafeAreaView>
  );
}
