# @aido/typescript-config

workspace가 함께 쓰는 tsconfig 프리셋이다. 값은 JSON 파일이 원본이라 여기에 옮겨 적지 않는다.

| 프리셋                         | 더하는 것                                                               | 쓰는 곳                                              |
| ------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| [`base.json`](./base.json)     | `strict`·`noUncheckedIndexedAccess`, ES2023, `module: ESNext`·`Bundler` | `packages/api`(`../../tooling/typescript/base.json`) |
| [`nestjs.json`](./nestjs.json) | `NodeNext` 모듈, 데코레이터 메타데이터, `incremental`                   | `apps/api`(`@aido/typescript-config/nestjs.json`)    |
| [`expo.json`](./expo.json)     | DOM lib, `jsx: react-jsx`, `noEmit`                                     | `apps/mobile`(`@aido/typescript-config/expo.json`)   |

```json
{
  "extends": "@aido/typescript-config/nestjs.json",
  "compilerOptions": { "outDir": "./dist" }
}
```
