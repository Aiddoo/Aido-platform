import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import ts from "typescript";

const modulesRoot = resolve(import.meta.dirname, "../../src/modules");
const SPEC_FILE = /\.(?:spec|integration-spec)\.ts$/;
const ENTRY_FILE = /\.(?:module|providers|public)\.ts$/;

const SLICE_SHAPE_RULES = [
  "slice마다 Aggregate Root가 하나다",
  "slice 폴더는 Aggregate 이름의 kebab 복수형이다",
  "slice의 Module·providers·public은 slice 루트의 <context>-<slice> 이름 셋뿐이다",
  "Context 루트에는 <context>.module.ts만 둔다",
  "<context>/shared에 Aggregate가 없다",
  "-queries Module은 아무것도 import하지 않고 포트만 내보낸다",
  "-queries Module에는 controller가 없다",
  "-queries.public은 -queries Module·포트·Read Model·조회 조각·id VO·발행 이벤트 계약만 다시 내보낸다",
] as const;
type SliceShapeRule = (typeof SLICE_SHAPE_RULES)[number];

interface SliceShapeViolation {
  readonly rule: SliceShapeRule;
  readonly path: string;
}

// 이유를 적은 예외. 순환을 푸는 층에서 남길지 정하고, 이유가 사라지면 지운다
const DOCUMENTED_EXCEPTIONS: readonly (SliceShapeViolation & { readonly reason: string })[] = [
  {
    rule: "slice마다 Aggregate Root가 하나다",
    path: "notification/reminders",
    reason:
      "일정 정책 slice다. 이미 보냈는지는 알림 행으로 판단해 가진 상태가 없다(domain-modeling.md)",
  },
  {
    rule: "slice의 Module·providers·public은 slice 루트의 <context>-<slice> 이름 셋뿐이다",
    path: "notification/notifications/notification-notifications-jobs.public.ts",
    reason:
      "네 Context가 쓰는 구체 큐 어댑터를 열고, 기능 Module을 열면 identity 설정과 파일이 순환한다",
  },
  {
    rule: "slice의 Module·providers·public은 slice 루트의 <context>-<slice> 이름 셋뿐이다",
    path: "notification/notifications/infrastructure/jobs/notification-queue.module.ts",
    reason:
      "jobs public이 여는 큐 Module이다. 포트가 아닌 큐 어댑터를 내보내고 PushReceiptScheduler를 둔다",
  },
  {
    rule: "slice의 Module·providers·public은 slice 루트의 <context>-<slice> 이름 셋뿐이다",
    path: "planning/todos/planning-todo-ports.module.ts",
    reason:
      "todos 기능 Module이 todo-series 기능 Module을 import하고 todo-series가 할 일 저장·리마인더 포트를 써서, 두 Module이 함께 쓰는 포트 바인딩을 한 곳에 둔다(없애면 Module 순환이거나 9개 바인딩 중복)",
  },
];

// 아직 고치지 않은 위반. 고치면 여기서 지운다. 새 위반은 목록에 더하지 않고 코드를 고친다
const REMAINING_VIOLATIONS: readonly SliceShapeViolation[] = [];

interface SourceFile {
  readonly path: string;
  readonly source: ts.SourceFile;
}

interface Slice {
  readonly context: string;
  readonly name: string;
  readonly files: readonly SourceFile[];
}

interface ContextFolder {
  readonly name: string;
  readonly rootFiles: readonly string[];
  readonly sharedFiles: readonly SourceFile[];
  readonly slices: readonly Slice[];
}

function listDirectory(directory: string) {
  return readdirSync(directory, { withFileTypes: true });
}

function readSourceFiles(directory: string): SourceFile[] {
  return listDirectory(directory).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return readSourceFiles(path);
    }
    if (!entry.name.endsWith(".ts") || SPEC_FILE.test(entry.name)) {
      return [];
    }
    const text = readFileSync(path, "utf8");
    return [
      {
        path: relative(modulesRoot, path),
        source: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true),
      },
    ];
  });
}

function readContextFolders(): ContextFolder[] {
  return listDirectory(modulesRoot)
    .filter((entry) => entry.isDirectory())
    .map((contextEntry) => {
      const directory = join(modulesRoot, contextEntry.name);
      const entries = listDirectory(directory);
      const sliceNames = entries
        .filter((entry) => entry.isDirectory() && entry.name !== "shared")
        .map((entry) => entry.name);
      const hasShared = entries.some((entry) => entry.isDirectory() && entry.name === "shared");
      return {
        name: contextEntry.name,
        rootFiles: entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
        sharedFiles: hasShared ? readSourceFiles(join(directory, "shared")) : [],
        slices: sliceNames.map((name) => ({
          context: contextEntry.name,
          name,
          files: readSourceFiles(join(directory, name)),
        })),
      };
    });
}

function findAggregateRootNames(file: SourceFile): string[] {
  return file.source.statements.flatMap((statement) => {
    const extendsAggregateRoot =
      ts.isClassDeclaration(statement) &&
      (statement.heritageClauses ?? []).some((clause) =>
        clause.types.some((type) => type.expression.getText(file.source) === "AggregateRoot"),
      );
    return extendsAggregateRoot && statement.name != null ? [statement.name.text] : [];
  });
}

function toPlural(word: string): string {
  if (word.endsWith("series")) {
    return word;
  }
  if (/[^aeiou]y$/.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }
  if (/(?:s|x|z|ch|sh)$/.test(word)) {
    return `${word}es`;
  }
  return `${word}s`;
}

function findModuleMetadata(file: SourceFile): ts.ObjectLiteralExpression | null {
  for (const statement of file.source.statements) {
    if (!ts.isClassDeclaration(statement)) {
      continue;
    }
    for (const decorator of ts.getDecorators(statement) ?? []) {
      const call = decorator.expression;
      if (
        ts.isCallExpression(call) &&
        call.expression.getText(file.source) === "Module" &&
        call.arguments[0] != null &&
        ts.isObjectLiteralExpression(call.arguments[0])
      ) {
        return call.arguments[0];
      }
    }
  }
  return null;
}

function readMetadataList(
  metadata: ts.ObjectLiteralExpression,
  key: string,
  source: ts.SourceFile,
) {
  const property = metadata.properties.find(
    (candidate) => ts.isPropertyAssignment(candidate) && candidate.name.getText(source) === key,
  );
  if (property == null || !ts.isPropertyAssignment(property)) {
    return [];
  }
  const { initializer } = property;
  return ts.isArrayLiteralExpression(initializer)
    ? initializer.elements.map((element) => element.getText(source))
    : [initializer.getText(source)];
}

function checkAggregateRootCount(slice: Slice): string[] {
  const roots = slice.files.flatMap(findAggregateRootNames);
  return roots.length === 1 ? [] : [`${slice.context}/${slice.name}`];
}

// 약어는 파일 이름에서 붙여 쓰고(oauth-state.aggregate.ts) 이미 복수형인 이름(LinkedAccounts)은 그대로 쓴다
function checkSliceFolder(slice: Slice): string[] {
  const [rootFile, ...others] = slice.files.filter(
    (file) => findAggregateRootNames(file).length > 0,
  );
  if (rootFile == null || others.length > 0) {
    return [];
  }
  const aggregateName = basename(rootFile.path, ".aggregate.ts");
  const plurals = aggregateName.endsWith("s")
    ? [toPlural(aggregateName), aggregateName]
    : [toPlural(aggregateName)];
  return plurals.includes(slice.name) ? [] : [`${slice.context}/${slice.name}`];
}

function checkEntryFiles(slice: Slice): string[] {
  const prefix = `${slice.context}/${slice.name}/${slice.context}-${slice.name}`;
  const allowed = new Set(
    [
      ".module.ts",
      "-queries.module.ts",
      "-admin.module.ts",
      ".providers.ts",
      ".public.ts",
      "-queries.public.ts",
    ].map((suffix) => `${prefix}${suffix}`),
  );
  const paths = new Set(slice.files.map((file) => file.path));
  const missing = [`${prefix}.module.ts`, `${prefix}.providers.ts`].filter(
    (path) => !paths.has(path),
  );
  const misplaced = [...paths].filter((path) => ENTRY_FILE.test(path) && !allowed.has(path));
  return [...missing, ...misplaced];
}

function checkQueriesModule(slice: Slice): string[] {
  const queriesModulePath = `${slice.context}/${slice.name}/${slice.context}-${slice.name}-queries.module.ts`;
  const file = slice.files.find((candidate) => candidate.path === queriesModulePath);
  const metadata = file == null ? null : findModuleMetadata(file);
  if (file == null || metadata == null) {
    return [];
  }
  const imports = readMetadataList(metadata, "imports", file.source);
  const nonPortExports = readMetadataList(metadata, "exports", file.source).filter(
    (name) => !name.endsWith("Port"),
  );
  return [
    ...(imports.length > 0 ? [`${file.path}#imports`] : []),
    ...nonPortExports.map((name) => `${file.path}#${name}`),
  ];
}

function checkQueriesModuleControllers(slice: Slice): string[] {
  const queriesModulePath = `${slice.context}/${slice.name}/${slice.context}-${slice.name}-queries.module.ts`;
  const file = slice.files.find((candidate) => candidate.path === queriesModulePath);
  const metadata = file == null ? null : findModuleMetadata(file);
  if (file == null || metadata == null) {
    return [];
  }
  return readMetadataList(metadata, "controllers", file.source).map(
    (name) => `${file.path}#${name}`,
  );
}

// 순환을 끊는 두 번째 공개 면이라 기능 Module·조립·구현을 끌고 오면 다시 순환한다. 포트가 id VO를 받으므로 id VO는 연다
const QUERIES_PUBLIC_SOURCES = [
  /^\.\/[a-z-]+-queries\.module\.js$/,
  /^\.\/application\/ports\/[a-z.-]+\.port\.js$/,
  /^\.\/application\/read-models\/[a-z-]+\.read-model\.js$/,
  /^\.\/infrastructure\/persistence\/[a-z-]+\.query-fragment\.js$/,
  /^\.\/domain\/[a-z-]+-id\.vo\.js$/,
];

// 구독 Context가 쓰는 이벤트 이름 튜플과 payload schema다. zod 밖을 import하면 계약 파일이 아니다
const PUBLISHED_EVENT_CONTRACT_SOURCE = /^\.\/domain\/[a-z-]+-published-events\.constants\.js$/;
const PUBLISHED_EVENT_CONTRACT_IMPORTS = new Set(["zod"]);

function isImportFreeEventContract(slice: Slice, source: string): boolean {
  if (!PUBLISHED_EVENT_CONTRACT_SOURCE.test(source)) {
    return false;
  }
  const contractPath = join(slice.context, slice.name, source.replace(/\.js$/, ".ts"));
  const contract = slice.files.find((candidate) => candidate.path === contractPath);
  return (
    contract != null &&
    contract.source.statements.every(
      (statement) =>
        !ts.isImportDeclaration(statement) ||
        (ts.isStringLiteral(statement.moduleSpecifier) &&
          PUBLISHED_EVENT_CONTRACT_IMPORTS.has(statement.moduleSpecifier.text)),
    )
  );
}

function checkQueriesPublic(slice: Slice): string[] {
  const queriesPublicPath = `${slice.context}/${slice.name}/${slice.context}-${slice.name}-queries.public.ts`;
  const file = slice.files.find((candidate) => candidate.path === queriesPublicPath);
  if (file == null) {
    return [];
  }
  const sources = file.source.statements.flatMap((statement) =>
    ts.isExportDeclaration(statement) &&
    statement.moduleSpecifier != null &&
    ts.isStringLiteral(statement.moduleSpecifier)
      ? [statement.moduleSpecifier.text]
      : [],
  );
  return [...new Set(sources)]
    .filter(
      (source) =>
        !QUERIES_PUBLIC_SOURCES.some((pattern) => pattern.test(source)) &&
        !isImportFreeEventContract(slice, source),
    )
    .map((source) => `${file.path}#${source}`);
}

function collectViolations(contexts: readonly ContextFolder[]): SliceShapeViolation[] {
  const sliceChecks: readonly [SliceShapeRule, (slice: Slice) => string[]][] = [
    ["slice마다 Aggregate Root가 하나다", checkAggregateRootCount],
    ["slice 폴더는 Aggregate 이름의 kebab 복수형이다", checkSliceFolder],
    [
      "slice의 Module·providers·public은 slice 루트의 <context>-<slice> 이름 셋뿐이다",
      checkEntryFiles,
    ],
    ["-queries Module은 아무것도 import하지 않고 포트만 내보낸다", checkQueriesModule],
    ["-queries Module에는 controller가 없다", checkQueriesModuleControllers],
    [
      "-queries.public은 -queries Module·포트·Read Model·조회 조각·id VO·발행 이벤트 계약만 다시 내보낸다",
      checkQueriesPublic,
    ],
  ];
  const slices = contexts.flatMap((context) => context.slices);
  const sliceViolations = sliceChecks.flatMap(([rule, check]) =>
    slices.flatMap((slice) => check(slice).map((path) => ({ rule, path }))),
  );
  const contextRootViolations = contexts.flatMap((context) =>
    context.rootFiles
      .filter((name) => name !== `${context.name}.module.ts`)
      .map((name) => ({
        rule: "Context 루트에는 <context>.module.ts만 둔다" as const,
        path: `${context.name}/${name}`,
      })),
  );
  const sharedAggregateViolations = contexts.flatMap((context) =>
    context.sharedFiles
      .filter((file) => findAggregateRootNames(file).length > 0)
      .map((file) => ({ rule: "<context>/shared에 Aggregate가 없다" as const, path: file.path })),
  );
  return [...sliceViolations, ...contextRootViolations, ...sharedAggregateViolations];
}

function pathsOf(violations: readonly SliceShapeViolation[], rule: SliceShapeRule): string[] {
  return violations
    .filter((violation) => violation.rule === rule)
    .map((violation) => violation.path)
    .sort();
}

describe("slice 모양", () => {
  const violations = collectViolations(readContextFolders());

  it.each(SLICE_SHAPE_RULES)("%s: 위반은 이유가 정해진 예외와 남은 위반 목록뿐이다", (rule) => {
    // Given
    const expected = pathsOf([...DOCUMENTED_EXCEPTIONS, ...REMAINING_VIOLATIONS], rule);

    // When
    const actual = pathsOf(violations, rule);

    // Then
    expect(actual).toEqual(expected);
  });

  it("예외와 남은 위반 목록은 같은 위반을 두 번 적지 않는다", () => {
    // Given
    const entries = [...DOCUMENTED_EXCEPTIONS, ...REMAINING_VIOLATIONS].map(
      (violation) => `${violation.rule} ${violation.path}`,
    );

    // When
    const uniqueEntries = new Set(entries);

    // Then
    expect(uniqueEntries.size).toBe(entries.length);
  });
});
