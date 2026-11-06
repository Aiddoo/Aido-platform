import type { FetchNextPageOptions } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { useEffect, useRef } from 'react';

interface UseFetchNextPageParams {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: (options?: FetchNextPageOptions) => Promise<unknown>;
}

/**
 * 목록 끝에서 다음 페이지를 한 번만 부른다.
 * isFetchingNextPage는 렌더 뒤에야 바뀌므로 같은 프레임의 연속 호출은 ref로 막고,
 * 실패한 뒤에는 자동으로 다시 부르지 않아 사용자가 재시도를 눌러야 한다.
 * 다만 당겨서 새로고침으로 오류가 풀리면 FlashList는 끝 근처에 머문 채라 onEndReached를 다시 부르지 않으므로 한 번 부른다.
 */
export function useFetchNextPage({
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
}: UseFetchNextPageParams) {
  const isRequesting = useRef(false);
  const previous = useRef({ isFetchingNextPage, isFetchNextPageError });

  const request = () => {
    if (isRequesting.current) {
      return;
    }
    isRequesting.current = true;
    fetchNextPage({ cancelRefetch: false })
      .catch(noop)
      .finally(() => {
        isRequesting.current = false;
      });
  };

  useEffect(() => {
    const { isFetchingNextPage: wasFetching, isFetchNextPageError: wasError } = previous.current;
    previous.current = { isFetchingNextPage, isFetchNextPageError };

    // 재시도가 끝나며 풀린 오류는 화면이 이미 끝에 있어 FlashList가 다음 페이지를 이어서 부른다
    const isRecoveredByRefresh = wasError && !isFetchNextPageError && !wasFetching;
    if (isRecoveredByRefresh && hasNextPage && !isFetchingNextPage) {
      request();
    }
  });

  const fetchOnEndReached = () => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
      request();
    }
  };

  const retry = () => {
    if (hasNextPage && !isFetchingNextPage) {
      request();
    }
  };

  return { fetchOnEndReached, retry };
}
