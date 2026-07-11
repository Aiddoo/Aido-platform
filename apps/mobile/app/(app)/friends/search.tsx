import { FriendPolicy } from '@src/features/friend/models/friend.model';
import { FriendSearchList } from '@src/features/friend/presentations/components/FriendSearchList';
import { useDebouncedValue } from '@src/shared/hooks/useDebouncedValue';
import { useTranslation } from '@src/shared/i18n';
import { Box, Flex, Input, QueryErrorBoundary, Result, SearchIcon } from '@src/shared/ui';
import { useRouter } from 'expo-router';
import { Suspense, useState } from 'react';
import { View } from 'react-native';

/**
 * 친구 찾기 화면.
 * 이름 또는 태그로 사용자를 검색해 바로 친구 추가/요청 취소한다.
 * 상단 검색창 + (유효 검색어면 결과 리스트, 아니면 입력 안내).
 */
const SearchFriendScreen = () => {
  const { t } = useTranslation('friend');
  const router = useRouter();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const isValidQuery = FriendPolicy.isValidSearchQuery(debouncedQuery);

  return (
    <View className="flex-1 bg-white">
      <Box px={16} py={12}>
        <Input
          leftContent={<SearchIcon width={20} height={20} colorClassName="text-gray-5" />}
          placeholder={t('search.placeholder')}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          renderErrorMessage={false}
        />
      </Box>

      {isValidQuery ? (
        <QueryErrorBoundary>
          <Suspense fallback={<FriendSearchList.Loading />}>
            <FriendSearchList query={debouncedQuery.trim()} />
          </Suspense>
        </QueryErrorBoundary>
      ) : (
        <Flex flex={1} justify="center" align="center">
          <Result
            icon={<SearchIcon width={64} height={64} colorClassName="text-gray-4" />}
            title={t('search.empty.prompt')}
            description={t('search.empty.tagHint')}
            button={
              <Result.Button onPress={() => router.push('/friends/add')}>
                {t('search.empty.addByTag')}
              </Result.Button>
            }
          />
        </Flex>
      )}
    </View>
  );
};

export default SearchFriendScreen;
