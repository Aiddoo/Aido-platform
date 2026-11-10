const { migratedContexts } = require("./architecture.ratchet.json");

// 옮기지 않은 Context는 warn, 옮긴 Context는 error. Context PR이 ratchet 목록에 자기 이름을 더한다.
const migratedFrom =
  migratedContexts.length === 0 ? "^(?!)" : `^src/modules/(${migratedContexts.join("|")})/`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular-migrated",
      comment:
        "옮긴 Context의 파일 import 순환은 ESM에서 부팅 실패로 이어진다. 포트나 이벤트로 끊는다.",
      severity: "error",
      from: { path: migratedFrom },
      to: { circular: true, dependencyTypesNot: ["type-only"] },
    },
    {
      name: "no-circular",
      comment: "아직 옮기지 않은 경로의 순환. Context를 옮길 때 같이 없앤다.",
      severity: "warn",
      from: { path: "^src/", pathNot: migratedFrom },
      to: { circular: true, dependencyTypesNot: ["type-only"] },
    },
    {
      name: "cross-context-only-via-public",
      comment: "다른 Context는 <context>-<slice>.public.ts로만 import한다.",
      severity: "error",
      from: { path: migratedFrom },
      to: {
        path: "^src/modules/",
        pathNot: ["^src/modules/$1/", "\\.public\\.ts$"],
      },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    doNotFollow: { path: "node_modules" },
    exclude: { path: "\\.spec\\.ts$" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["types", "import", "require", "node", "default"],
      extensions: [".ts", ".js", ".json"],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
