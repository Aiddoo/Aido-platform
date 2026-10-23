import { useLocalSearchParams, type UnknownOutputParams } from 'expo-router';
import { createContext, type PropsWithChildren, use } from 'react';

const RouteSearchParamsContext = createContext<UnknownOutputParams | null>(null);

type RouteSearchParamsProviderProps = PropsWithChildren<{ params: UnknownOutputParams }>;

/** 레이아웃이 그리는 pane처럼 자기 route가 아닌 자식 route의 params를 읽어야 하는 영역에 둔다. */
export function RouteSearchParamsProvider({ params, children }: RouteSearchParamsProviderProps) {
  return <RouteSearchParamsContext value={params}>{children}</RouteSearchParamsContext>;
}

export function useRouteSearchParams(): UnknownOutputParams {
  const localParams = useLocalSearchParams();
  return use(RouteSearchParamsContext) ?? localParams;
}
