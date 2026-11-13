import type { ErrorReportFeature } from '@src/core/observability/telemetry-keys';
import type { MutationMeta, QueryMeta } from '@tanstack/react-query';
import type { DefaultNamespace, FlatNamespace, ParseKeysWithoutVariables } from 'i18next';

/** 전역 `t`가 받는 키 모양(기본 네임스페이스는 접두사 없이, 나머지는 `ns:key`) */
type AppNamespaces = [DefaultNamespace, ...Exclude<FlatNamespace, DefaultNamespace>[]];

// 반드시 type이다. 인덱스 시그니처 없는 interface는 QueryMeta의 등록 조건을 통과하지 못해 Record로 돌아간다
export type AppQueryMeta = {
  /** 기기에 저장해 오프라인으로 앱을 다시 열어도 마지막 데이터를 보여 준다 */
  persist?: boolean;
  /** 프리미엄 여부에 따라 서버가 한도·사용량·접근을 다르게 주는 조회. 프리미엄이 바뀌면 다시 불러온다 */
  refreshOnPremiumChange?: boolean;
  /** 할 일이 바뀌면 보이는 값이 달라지는 조회(콕 상태 등). 할 일을 바꾼 뒤 다시 불러온다 */
  refreshOnTodoChange?: boolean;
  /** 차단·해제에 따라 서버가 가리는 사람이 달라지는 조회(친구, 댓글, 콕). 차단을 바꾼 뒤 다시 불러온다 */
  refreshOnBlockChange?: boolean;
};

export type MutationErrorFeedbackMeta = {
  /** 예측하지 못한 오류를 보고할 때 붙는 기능 */
  feature: ErrorReportFeature;
  /** 사용자 문구가 없는 오류(파싱·SDK 실패)에 보일 토스트 문구. 없으면 `errors:fallback` */
  fallbackKey?: ParseKeysWithoutVariables<AppNamespaces>;
  /**
   * 기능이 직접 보이는 오류면 true. 옵션 `onError`의 코드별 안내·이동·한도 시트, 호출부 `onError`의 `form.setError`가 그 예다.
   * 캐시 단계 전역 처리가 기능 콜백보다 먼저 돌아 미리 알아야 한다. 이 오류에는 햅틱·토스트·보고를 하지 않는다
   */
  isHandledByFeature?: (error: unknown) => boolean;
  /** 토스트 둘째 줄에 붙일 기능만의 설명(AI가 차감하지 않았다는 안내 등). 붙일 것이 없으면 undefined */
  describe?: (error: unknown) => string | undefined;
};

export type AppMutationMeta = {
  /** 실패를 전역 햅틱·토스트·보고 한 번으로 알린다. `false`는 기능이 실패를 직접 보이거나 화면 뒤 작업이라 알리지 않는다 */
  errorFeedback?: MutationErrorFeedbackMeta | false;
};

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: AppQueryMeta;
    mutationMeta: AppMutationMeta;
  }
}

type AssertClosedQueryMeta<Key extends keyof AppQueryMeta> = Key;
/** QueryMeta가 Record<string, unknown>으로 돌아가면 컴파일 오류가 난다 */
export type AppQueryMetaGuard = AssertClosedQueryMeta<keyof QueryMeta>;

type AssertClosedMutationMeta<Key extends keyof AppMutationMeta> = Key;
/** MutationMeta가 Record<string, unknown>으로 돌아가면 컴파일 오류가 난다 */
export type AppMutationMetaGuard = AssertClosedMutationMeta<keyof MutationMeta>;
