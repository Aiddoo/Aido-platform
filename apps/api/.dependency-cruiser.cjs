/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "파일 import 순환은 ESM에서 부팅 실패로 이어진다. 포트나 이벤트로 끊는다.",
      severity: "error",
      from: { path: "^src/" },
      to: { circular: true, dependencyTypesNot: ["type-only"] },
    },
    {
      name: "cross-context-only-via-public",
      comment: "다른 Context는 <context>-<slice>.public.ts로만 import한다.",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/" },
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
