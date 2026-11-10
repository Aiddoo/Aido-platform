// 서버 관례 검사. 인자로 파일을 주면 그 파일만, 없으면 저장소가 보는 서버 파일 전체를 본다.
//   node scripts/check-conventions.mjs [--file <path>...]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(apiRoot, "../..");
const SOURCE_ROOTS = ["apps/api/src", "packages/api/src"];
const JUNK_FILE = /(?:^|\/)(?:\.DS_Store|\.gitkeep)$/;
// 이름 사전의 역할 접미사. .ls-lint.yml의 확장자 목록과 같아야 하며 checkLsLintSync가 어긋나면 실패시킨다.
// ls-lint는 모르는 다중 점 접미사(`memo.record.ts`)를 조용히 통과시키므로 여기서 허용 목록으로 막는다.
const ROLE_SUFFIXES = [
  "aggregate",
  "entity",
  "vo",
  "event",
  "domain-service",
  "constants",
  "use-case",
  "port",
  "read-model",
  "lock-keys",
  "log-events",
  "alerts",
  "errors",
  "messages",
  "repository",
  "reader",
  "mapper",
  "adapter",
  "wire",
  "policy",
  "queue",
  "processor",
  "scheduler",
  "cache",
  "keyspace",
  "event-handler",
  "controller",
  "dto",
  "guard",
  "interceptor",
  "decorator",
  "module",
  "providers",
  "public",
  "config",
];
const TEST_SUFFIXES = ["spec", "integration-spec"];
const KEBAB = "[a-z0-9]+(?:-[a-z0-9]+)*";
const STEM_PATTERNS = {
  // memo.repository.port.ts처럼 Port는 대상 역할을 한 번 더 적는다.
  port: new RegExp(`^${KEBAB}(?:\\.(?:repository|reader))?$`),
  policy: new RegExp(`^${KEBAB}-outbound$`),
};
const DEFAULT_STEM = new RegExp(`^${KEBAB}$`);
// 접근 제어자는 static·readonly·override·abstract·declare 같은 한정자와 어떤 순서로 와도 잡는다.
const MEMBER_KEYWORD =
  /^\s+(?:(?:static|readonly|override|abstract|declare|async)\s+)*(private|public|protected)\s/;
const NON_CODE_LINE = /^\s*(?:\/\/|\/\*|\*)/;
const FORWARD_REF = /\bforwardRef\(/;
const PG_ENUM_LITERAL = /pgEnum\(\s*["'`]([^"'`]+)["'`]\s*,\s*\[/g;
// notification slice가 아직 튜플을 export하지 않아 리터럴 배열로 남은 enum. 그 slice가 domain/*.constants.ts 튜플로 옮기면 지운다
const PENDING_LITERAL_ENUMS = new Set([
  "NotificationType",
  "PushDeliveryMode",
  "PushDispatchOutboxStatus",
  "PushRateLimitPhase",
  "RetentionExperimentStageStatus",
]);

const args = process.argv.slice(2);
// lefthook은 staged 파일 여러 개를 `--file a b c`로 넘긴다
const selectedFiles = args.filter((arg) => !arg.startsWith("--"));

function toApiRelative(filePath) {
  const absolute = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
  return relative(apiRoot, absolute).split(sep).join("/");
}

// Context 폴더 안의 파일(modules/<context>/…)은 모두 역할 접미사를 단다
function isContextPath(rel) {
  const segments = rel.split("/");
  return segments[0] === "src" && segments[1] === "modules" && segments.length >= 4;
}

// 하위 클래스 확장점(props·raise)인 shared/domain 기반 클래스와 프레임워크 메서드 재정의만 protected를 쓴다
function allowsProtected(rel, line) {
  return rel.startsWith("src/shared/domain/") || /\boverride\s/.test(line);
}

function checkRoleSuffix(rel, violations) {
  const allowed = ROLE_SUFFIXES.map((suffix) => `.${suffix}`).join(" ");
  const base = rel.slice(rel.lastIndexOf("/") + 1).replace(/\.ts$/, "");
  const testSuffix = TEST_SUFFIXES.find((suffix) => base.endsWith(`.${suffix}`));
  const withoutTest = testSuffix == null ? base : base.slice(0, -(testSuffix.length + 1));
  const roleStart = withoutTest.lastIndexOf(".");
  const role = roleStart === -1 ? null : withoutTest.slice(roleStart + 1);
  if (role == null || !ROLE_SUFFIXES.includes(role)) {
    violations.push(
      `${rel}: 역할 접미사가 사전에 없다(.spec.ts·.integration-spec.ts는 역할 접미사 뒤에만). 허용: ${allowed}`,
    );
    return;
  }
  const stem = withoutTest.slice(0, roleStart);
  if (!(STEM_PATTERNS[role] ?? DEFAULT_STEM).test(stem)) {
    violations.push(
      `${rel}: '${stem}'는 .${role}.ts 앞 이름으로 맞지 않는다. kebab-case 이름 하나 뒤에 역할 접미사 하나만 붙인다.`,
    );
  }
}

// .ls-lint.yml과 ROLE_SUFFIXES가 같은 목록인지 본다. 한쪽만 고치면 가드가 갈라진다.
function checkLsLintSync(violations) {
  const yml = readFileSync(join(repoRoot, ".ls-lint.yml"), "utf8");
  const declared = new Set(
    [...yml.matchAll(/^ {4}\.([a-z][a-z.-]*)\.ts:/gm)].map((match) => match[1]),
  );
  const expected = new Set([...ROLE_SUFFIXES, ...TEST_SUFFIXES]);
  for (const suffix of expected) {
    if (!declared.has(suffix)) {
      violations.push(
        `.ls-lint.yml: '.${suffix}.ts' 규칙이 없다. check-conventions.mjs 목록과 맞춘다.`,
      );
    }
  }
  for (const suffix of declared) {
    if (!expected.has(suffix)) {
      violations.push(`.ls-lint.yml: '.${suffix}.ts'가 check-conventions.mjs 목록에 없다.`);
    }
  }
}

function isEnumSchemaPath(rel) {
  return /^src\/platform\/database\/schema\/[^/]+\.ts$/.test(rel);
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

// 템플릿 리터럴 안쪽 줄(시작 줄 제외)의 번호. 백틱 개수 홀짝으로 열림을 추적한다.
function findTemplateLiteralLines(lines) {
  const inside = new Set();
  let open = false;
  lines.forEach((line, index) => {
    if (open) {
      inside.add(index);
    }
    const ticks = (line.match(/(?<!\\)`/g) ?? []).length;
    if (ticks % 2 === 1) {
      open = !open;
    }
  });
  return inside;
}

function checkFile(rel, violations, literalEnums) {
  const text = readFileSync(join(apiRoot, rel), "utf8");
  if (isContextPath(rel) && !rel.endsWith(".d.ts")) {
    checkRoleSuffix(rel, violations);
  }
  const lines = text.split("\n");
  const templateLines = findTemplateLiteralLines(lines);

  lines.forEach((line, index) => {
    if (!templateLines.has(index) && !NON_CODE_LINE.test(line)) {
      const match = MEMBER_KEYWORD.exec(line);
      if (match && !(match[1] === "protected" && allowsProtected(rel, line))) {
        violations.push(
          `${rel}:${index + 1}: '${match[1]}' 멤버 키워드는 쓰지 않는다. 비공개는 '#' 필드·메서드로 둔다.`,
        );
      }
    }
    if (FORWARD_REF.test(line)) {
      violations.push(
        `${rel}:${index + 1}: forwardRef 순환 의존. 좁은 Port를 public으로 열고 반대 방향은 이벤트로 바꾼다.`,
      );
    }
  });

  if (isEnumSchemaPath(rel)) {
    for (const match of text.matchAll(PG_ENUM_LITERAL)) {
      literalEnums.add(match[1]);
      if (!PENDING_LITERAL_ENUMS.has(match[1])) {
        violations.push(
          `${rel}:${lineOf(text, match.index)}: pgEnum("${match[1]}") 값을 리터럴 배열로 적었다. @aido/api/vocabulary 또는 소유 slice domain/*.constants.ts의 튜플에서 유도한다.`,
        );
      }
    }
  }
}

// 로컬에만 있는 무시 파일이 CI와 결과를 갈라놓지 않도록 저장소가 보는 파일만 대상으로 삼는다.
function listRepoFiles() {
  try {
    const output = execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    return output.split("\0").filter((path) => path !== "" && existsSync(join(repoRoot, path)));
  } catch {
    return null;
  }
}

// 멤버 키워드 규칙은 tsconfig(erasableSyntaxOnly)와 같은 범위인 src·test·scripts 전체에 건다
const CHECKED_DIRS = ["src/", "test/", "scripts/"];

function isCheckedFile(rel) {
  return CHECKED_DIRS.some((dir) => rel.startsWith(dir)) && rel.endsWith(".ts");
}

function listSourceFiles(repoFiles) {
  return repoFiles
    .filter((path) => path.startsWith("apps/api/"))
    .map((path) => path.slice("apps/api/".length))
    .filter(isCheckedFile);
}

// 저장소가 보는 파일이 .DS_Store·.gitkeep뿐인 폴더는 남기지 않는다. 빈 폴더는 git에 없어 CI에서 보이지 않으므로 대상이 아니다.
function findEmptyDirectories(repoFiles, violations) {
  const contentDirs = new Set();
  const junkDirs = new Set();
  for (const path of repoFiles) {
    if (!SOURCE_ROOTS.some((root) => path.startsWith(`${root}/`))) {
      continue;
    }
    const target = JUNK_FILE.test(path) ? junkDirs : contentDirs;
    for (let dir = dirname(path); dir !== "."; dir = dirname(dir)) {
      target.add(dir);
    }
  }
  for (const dir of junkDirs) {
    if (!contentDirs.has(dir) && SOURCE_ROOTS.every((root) => dir !== root)) {
      violations.push(`${dir}: 파일 없는 빈 폴더. 폴더를 지운다.`);
    }
  }
}

function findTrackedJunkFiles(violations) {
  let tracked;
  try {
    tracked = execFileSync("git", ["ls-files", "-z"], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return;
  }
  for (const path of tracked.split("\0")) {
    if (JUNK_FILE.test(path)) {
      violations.push(`${path}: 추적하면 안 되는 파일(.DS_Store·.gitkeep). 지운다.`);
    }
  }
}

const violations = [];
const literalEnums = new Set();
const checksTree = selectedFiles.length === 0;
const repoFiles = checksTree ? listRepoFiles() : null;
if (checksTree && repoFiles == null) {
  console.error("git ls-files를 실행하지 못해 관례 검사를 할 수 없다.");
  process.exit(1);
}
const files = checksTree
  ? listSourceFiles(repoFiles)
  : selectedFiles.map(toApiRelative).filter((rel) => existsSync(join(apiRoot, rel)));

for (const rel of files) {
  if (!isCheckedFile(rel)) {
    continue;
  }
  checkFile(rel, violations, literalEnums);
}

if (checksTree) {
  checkLsLintSync(violations);
  findEmptyDirectories(repoFiles, violations);
  findTrackedJunkFiles(violations);
  for (const name of PENDING_LITERAL_ENUMS) {
    if (!literalEnums.has(name)) {
      violations.push(
        `scripts/check-conventions.mjs: ${name}은 튜플로 옮겨졌다. PENDING_LITERAL_ENUMS에서 지운다.`,
      );
    }
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }
  process.exit(1);
}
