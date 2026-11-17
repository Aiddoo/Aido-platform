import { FriendSearchList } from '@src/features/social/friend/components/friend-search-list';
import { useFriendLimitInvite } from '@src/features/social/invite/hooks/use-friend-limit-invite';
import { useTranslation } from '@src/shared/i18n';
import { IS_IOS_APP_ON_MAC, IS_IPAD } from '@src/shared/infra/device/device-info';
import { Box, Input, QueryErrorBoundary, Spacing, StyledSafeAreaView } from '@src/shared/ui';
import { debounce } from 'es-toolkit';
import { Stack, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SearchBarCommands } from 'react-native-screens';
import { match } from 'ts-pattern';

const SEARCH_DEBOUNCE_MS = 300;

// iPad(iPadOS 26.6에서 확인)·Mac은 UISearchController가 뜰 때 UIKit이 막힌 화면 단위 포커스 API를 불러 앱이 죽는다(Apple 포럼 841090). 네이티브 빌드 없이 피하려 JS 입력칸을 쓴다
const SEARCH_INPUT = IS_IPAD || IS_IOS_APP_ON_MAC ? 'field' : 'header-bar';

/** 내비게이션 타입이 네이티브 스택의 transitionEnd를 드러내지 않아 쓰는 이벤트만 적는다 */
interface TransitionNavigation {
  addListener(
    event: 'transitionEnd',
    callback: (event: { data: { closing: boolean } }) => void,
  ): () => void;
}

export default function SearchFriendScreen() {
  const { t } = useTranslation('friend');
  const [query, setQuery] = useState('');
  const [settledQuery, setSettledQuery] = useState('');
  const settle = useMemo(() => debounce(setSettledQuery, SEARCH_DEBOUNCE_MS), []);
  const onFriendLimitInvite = useFriendLimitInvite();

  useEffect(() => () => settle.cancel(), [settle]);

  const changeQuery = (text: string) => {
    setQuery(text);
    settle(text);
  };

  return (
    <>
      <Stack.Screen options={{ title: t('search.title') }} />

      {match(SEARCH_INPUT)
        .with('header-bar', () => (
          <>
            {/* 스크롤 부모가 라우트의 첫 컴포넌트여야 네이티브 헤더 inset이 적용된다 */}
            <FriendSearchBar onChangeText={changeQuery} />
            <QueryErrorBoundary resetKeys={[query.trim()]} fallback={FriendSearchList.Error}>
              <FriendSearchList
                query={query}
                settledQuery={settledQuery}
                onFriendLimitInvite={onFriendLimitInvite}
              />
            </QueryErrorBoundary>
          </>
        ))
        .with('field', () => (
          <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
            <Spacing size={8} />

            <Box px={16}>
              <FriendSearchField value={query} onChange={changeQuery} />
            </Box>

            <Spacing size={8} />

            <QueryErrorBoundary resetKeys={[query.trim()]} fallback={FriendSearchList.Error}>
              <FriendSearchList
                query={query}
                settledQuery={settledQuery}
                onFriendLimitInvite={onFriendLimitInvite}
              />
            </QueryErrorBoundary>
          </StyledSafeAreaView>
        ))
        .exhaustive()}
    </>
  );
}

function FriendSearchBar({ onChangeText }: { onChangeText: (text: string) => void }) {
  const { t } = useTranslation('friend');
  const navigation = useNavigation<TransitionNavigation>();
  const searchBarRef = useRef<SearchBarCommands>(null);

  useEffect(() => {
    // 네이티브 검색창은 화면 전환이 끝나야 붙어 마운트 직후 ref는 비어 있다. autoFocus는 Android만 받는다
    return navigation.addListener('transitionEnd', (event) => {
      if (!event.data.closing) {
        searchBarRef.current?.focus();
      }
    });
  }, [navigation]);

  return (
    <Stack.SearchBar
      ref={searchBarRef}
      placeholder={t('search.placeholder')}
      // 헤더 밑에 입력칸이 늘 보이게 한다. automatic은 iOS 26에서 툴바·버튼으로 접힐 수 있다
      placement="stacked"
      autoFocus
      autoCapitalize="none"
      hideWhenScrolling={false}
      obscureBackground={false}
      // iOS 26 미만은 포커스하면 제목·뒤로 가기를 숨겨 자동 포커스된 화면에서 나갈 길이 사라진다
      hideNavigationBar={false}
      // Android 뒤로 가기가 검색창만 접지 않고 화면을 떠난다
      disableBackButtonOverride
      onChangeText={({ nativeEvent }) => onChangeText(nativeEvent.text)}
    />
  );
}

function FriendSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string) => void;
}) {
  const { t } = useTranslation('friend');

  return (
    <Input
      value={value}
      onChange={onChange}
      placeholder={t('search.placeholder')}
      size="medium"
      renderErrorMessage={false}
      autoFocus
      autoCapitalize="none"
      returnKeyType="search"
      // 헤더 검색창처럼 글자를 한 번에 지우는 버튼을 둔다
      clearButtonMode="while-editing"
      accessibilityRole="search"
    />
  );
}
