# @aido/typescript-config

Aido 모노레포 공유 TypeScript 설정

## 설정 파일

### base.json

모든 패키지의 기본 TypeScript 설정

```json
{
  "extends": "../../tooling/typescript/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 주요 설정

| 옵션             | 값       | 설명                                       |
| ---------------- | -------- | ------------------------------------------ |
| target           | ES2022   | 최신 JavaScript 기능 지원                  |
| module           | NodeNext | Node.js ESM 지원                           |
| moduleResolution | NodeNext | ESM import 해석                            |
| strict           | true     | 엄격한 타입 체크                           |
| skipLibCheck     | true     | 라이브러리 타입 체크 스킵 (빌드 속도 향상) |
| declaration      | true     | .d.ts 파일 생성                            |
| declarationMap   | true     | 소스맵 생성                                |

## 사용 방법

각 패키지의 `tsconfig.json`에서 상대 경로로 확장:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tooling/typescript/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 라이선스

MIT
