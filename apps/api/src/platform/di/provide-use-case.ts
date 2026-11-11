import { type FactoryProvider, Logger } from "@nestjs/common";

export interface LoggerToken {
  readonly kind: "logger";
  readonly context: string;
}

type ClassToken<T> = abstract new (...args: never[]) => T;

// logger 토큰은 Nest Logger가 그 자리 타입을 만족할 때만 받는다(시계 자리에 logger를 넣지 못하게)
type DependencyToken<T> = ClassToken<T> | (Logger extends T ? LoggerToken : never);

type DependencyTokens<TDependencies extends object> = {
  readonly [K in keyof TDependencies]: DependencyToken<TDependencies[K]>;
};

type AnyDependencyToken = ClassToken<unknown> | LoggerToken;

export function loggerFor(owner: { readonly name: string }): LoggerToken {
  return { kind: "logger", context: owner.name };
}

function isLoggerToken(token: AnyDependencyToken): token is LoggerToken {
  return typeof token !== "function";
}

export function provideUseCase<TUseCase, TDependencies extends object>(
  useCase: new (dependencies: TDependencies) => TUseCase,
  dependencies: NoInfer<DependencyTokens<TDependencies>>,
): FactoryProvider<TUseCase> {
  const entries: ReadonlyArray<readonly [string, AnyDependencyToken]> =
    Object.entries<AnyDependencyToken>(dependencies);
  const injected = entries.flatMap(([name, token]) =>
    isLoggerToken(token) ? [] : [{ name, token }],
  );

  return {
    provide: useCase,
    inject: injected.map(({ token }) => token),
    useFactory: (...resolved: unknown[]): TUseCase => {
      const resolvedByName = new Map(injected.map(({ name }, index) => [name, resolved[index]]));
      const built = Object.fromEntries(
        entries.map(([name, token]) => [
          name,
          isLoggerToken(token) ? new Logger(token.context) : resolvedByName.get(name),
        ]),
      );
      // 키·토큰 타입은 시그니처가 검사했고 Object.fromEntries는 키별 타입을 잃어 이 한 곳만 단언한다
      // oxlint-disable-next-line typescript/consistent-type-assertions -- 위 이유로 provideUseCase 안 1곳만 허용
      return new useCase(built as TDependencies);
    },
  };
}
