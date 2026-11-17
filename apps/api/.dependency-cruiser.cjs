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
    {
      name: "ai-generations-knows-no-consumer",
      comment:
        "ai-generations는 그것을 쓰는 ai-assistance slice를 모른다. 작업 출력 타입은 ai-assistance/shared/domain에 둔다.",
      severity: "error",
      from: { path: "^src/modules/ai-assistance/ai-generations/" },
      to: {
        path: "^src/modules/ai-assistance/",
        pathNot: "^src/modules/ai-assistance/(ai-generations|shared)/",
      },
    },
    {
      name: "express-only-in-platform-http",
      comment:
        "Express 전용 API는 platform/http에만 둔다. 요청·응답 타입은 platform/http/http-request.ts를 쓴다.",
      severity: "error",
      from: { path: "^src/", pathNot: "^src/platform/http/" },
      to: { path: "node_modules/(?:@types/express|express|@nestjs/platform-express)/" },
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
