/** 기기 안에서만 읽어 연결 상태와 무관하고, 설정 앱에서 바꾸고 돌아올 수 있어 열 때마다 다시 읽는다 */
export const OS_PERMISSION_QUERY_OPTIONS = {
  networkMode: 'always',
  staleTime: 0,
} as const;
