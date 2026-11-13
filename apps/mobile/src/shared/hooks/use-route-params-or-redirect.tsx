import { type Href, Redirect, useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';
import type { z } from 'zod';

type RouteParamsOrRedirect<TParams> =
  | { params: TParams; redirect: null }
  | { params: null; redirect: ReactElement };

/**
 * route 파일의 params 검증. 틀리면 `fallbackHref`로 바꾸는 `<Redirect>`를 돌려주고 route는 그것만 그린다.
 * 안쪽 화면은 같은 스키마의 튜플 훅으로 좁혀진 값을 읽는다
 */
export function useRouteParamsOrRedirect<TSchema extends z.ZodObject>(
  schema: TSchema,
  { fallbackHref }: { fallbackHref: Href },
): RouteParamsOrRedirect<z.output<TSchema>> {
  const parsed = schema.safeParse(useLocalSearchParams());

  if (!parsed.success) {
    return { params: null, redirect: <Redirect href={fallbackHref} /> };
  }

  return { params: parsed.data, redirect: null };
}
