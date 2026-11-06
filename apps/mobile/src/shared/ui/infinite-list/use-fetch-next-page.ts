import type { FetchNextPageOptions } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { useRef } from 'react';

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
 */
export function useFetchNextPage({
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
}: UseFetchNextPageParams) {
  const isRequesting = useRef(false);

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
