/**
 * OS 권한 쿼리가 함께 쓰는 캐시 정책. 기기 안에서만 읽어 연결 상태와 무관하고, 설정 앱에서 바꾸고 돌아올 수 있어
 * 화면을 열거나 앱으로 돌아올 때마다 다시 읽는다
 */
export const OS_PERMISSION_QUERY_OPTIONS = {
  networkMode: 'always',
  staleTime: 0,
} as const;
