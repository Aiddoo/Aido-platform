import { useLocalSearchParams, useNavigation } from 'expo-router';
import type { NavigationProp, ParamListBase } from 'expo-router/react-navigation';
import type { z } from 'zod';

/**
 * 탭·보기처럼 URL 값 하나를 `[view, setView]`로 읽고 쓴다. 없거나 잘못된 값은 스키마의 `.catch` 기본값이다.
 * `schema`는 모듈 상수로 넘긴다. 여러 값을 함께 바꾸면 `useRouteParams`를 쓴다.
 * 쓰기는 이 훅을 부른 화면의 params다. 비동기 뒤에 불러도 그 사이 focus된 다른 화면에 쓰지 않는다.
 */
export function useView<TSchema extends z.ZodType<string>>(
  key: string,
  schema: z.ZodCatch<TSchema>,
) {
  const view = schema.parse(useLocalSearchParams()[key]);
  // 기본 타입은 route 목록이 없어 setParams가 값을 받지 않는다. 화면 navigation의 기본 모양으로 받는다
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const setView = (next: z.output<TSchema>) => navigation.setParams({ [key]: next });

  return [view, setView] as const;
}
