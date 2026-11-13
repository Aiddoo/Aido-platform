import { FriendSearchList } from '@src/features/social/friend/components/friend-search-list';
import { useFriendLimitInvite } from '@src/features/social/invite/hooks/use-friend-limit-invite';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary } from '@src/shared/ui';
import { debounce } from 'es-toolkit';
import { Stack, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SearchBarCommands } from 'react-native-screens';

const SEARCH_DEBOUNCE_MS = 300;

/** 내비게이션 타입이 네이티브 스택의 transitionEnd를 드러내지 않아 쓰는 이벤트만 적는다 */
interface TransitionNavigation {
  addListener(
    event: 'transitionEnd',
    callback: (event: { data: { closing: boolean } }) => void,
  ): () => void;
}

export default function SearchFriendScreen() {
  const { t } = useTranslation('friend');
  const navigation = useNavigation<TransitionNavigation>();
  const searchBarRef = useRef<SearchBarCommands>(null);
  const [query, setQuery] = useState('');
  const [settledQuery, setSettledQuery] = useState('');
  const settle = useMemo(() => debounce(setSettledQuery, SEARCH_DEBOUNCE_MS), []);
  const onFriendLimitInvite = useFriendLimitInvite();

  useEffect(() => {
    // 네이티브 검색창은 화면 전환이 끝나야 붙어 마운트 직후 ref는 비어 있다. autoFocus는 Android만 받는다
    return navigation.addListener('transitionEnd', (event) => {
      if (!event.data.closing) {
        searchBarRef.current?.focus();
      }
    });
  }, [navigation]);

  useEffect(() => () => settle.cancel(), [settle]);

  // 스크롤 부모가 라우트의 첫 컴포넌트여야 네이티브 헤더 inset이 적용된다
  return (
    <>
      <Stack.Screen options={{ title: t('search.title') }} />

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
        onChangeText={({ nativeEvent }) => {
          setQuery(nativeEvent.text);
          settle(nativeEvent.text);
        }}
      />
      <QueryErrorBoundary resetKeys={[query.trim()]} fallback={FriendSearchList.Error}>
        <FriendSearchList
          query={query}
          settledQuery={settledQuery}
          onFriendLimitInvite={onFriendLimitInvite}
        />
      </QueryErrorBoundary>
    </>
  );
}
