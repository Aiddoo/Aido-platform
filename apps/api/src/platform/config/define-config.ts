import { type ConfigFactoryKeyHost, registerAs } from "@nestjs/config";
import type { z } from "zod";

import { processEnv } from "./env.js";

type EnvSource = Readonly<Record<string, unknown>>;

export type NamespaceConfig<TSchema extends z.ZodType<Record<string, unknown>>> =
  (() => z.output<TSchema>) &
    ConfigFactoryKeyHost<z.output<TSchema>> & {
      readonly namespace: string;
      parse(env: EnvSource): z.output<TSchema>;
    };

/**
 * `registerAs` + Zod namespace 설정을 만든다. `read`는 schema가 읽는 env 키를 모두 고른다.
 * env 원문은 검증 전이라 값 타입을 좁히지 않고 키 목록만 schema 입력과 맞춘다.
 */
export function defineConfig<TSchema extends z.ZodType<Record<string, unknown>>>(
  namespace: string,
  schema: TSchema,
  read: (env: EnvSource) => { readonly [K in keyof z.input<TSchema>]: unknown },
): NamespaceConfig<TSchema> {
  const parse = (env: EnvSource): z.output<TSchema> => schema.parse(read(env));
  return Object.assign(
    registerAs(namespace, () => parse(processEnv)),
    { namespace, parse },
  );
}
