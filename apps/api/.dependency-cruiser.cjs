/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "aido-api-subpath-only",
      comment:
        "@aido/api는 subpath(contracts/<기능>/v<n>·vocabulary·common·errors)로만 import한다. 루트 진입 파일은 없다.",
      severity: "error",
      from: {},
      to: { path: "^@aido/api$" },
    },
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
      name: "presentation-not-to-infrastructure",
      comment:
        "presentation은 application의 UseCase·포트·Read Model만 부른다. infrastructure 구현과 상수는 import하지 않는다.",
      severity: "error",
      from: { path: "^src/modules/[^/]+/[^/]+/presentation/" },
      to: { path: "^src/modules/[^/]+/[^/]+/infrastructure/" },
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
      name: "http-adapter-only-in-platform-http",
      comment:
        "HTTP 어댑터(@nestjs/platform-node) API는 platform/http에만 둔다. 요청·응답 타입은 platform/http/http-request.ts를 쓴다.",
      severity: "error",
      from: { path: "^src/", pathNot: "^src/platform/http/" },
      to: { path: "node_modules/@nestjs/platform-node/" },
    },
    {
      name: "react-only-in-email-templates",
      comment:
        "React(React Email)는 메일 템플릿 폴더에만 둔다. 다른 곳은 템플릿이 돌려준 문자열(제목·HTML·텍스트)만 쓴다.",
      severity: "error",
      from: {
        path: "^src/",
        pathNot: "^src/modules/notification/email-messages/infrastructure/templates/",
      },
      to: { path: "node_modules/(?:react|react-dom|react-email|@react-email/[^/]+)/" },
    },
    {
      name: "email-templates-loaded-on-first-render",
      comment:
        "React Email은 부팅 때 불러오지 않는다. 템플릿 폴더 밖과 메일 클래스는 .tsx 템플릿을 import()로만 부른다.",
      severity: "error",
      from: {
        path: "^src/",
        pathNot:
          "^src/modules/notification/email-messages/infrastructure/templates/(?!email-template\\.mail\\.ts$)",
      },
      to: {
        path: "^src/modules/notification/email-messages/infrastructure/templates/[^/]+\\.tsx$",
        dependencyTypesNot: ["dynamic-import", "type-only"],
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
      extensions: [".ts", ".tsx", ".js", ".json"],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
