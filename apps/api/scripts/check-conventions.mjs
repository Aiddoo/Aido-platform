// 서버 관례 검사. 새 slice·옮긴 Context(architecture.ratchet.json)만 실패시키고 옛 경로는 경고로 둔다.
//   node scripts/check-conventions.mjs [--file <path>] [--strict-enums]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(apiRoot, "../..");
const SOURCE_ROOTS = ["apps/api/src", "packages/api/src"];
const JUNK_FILE = /(?:^|\/)(?:\.DS_Store|\.gitkeep)$/;
const LEGACY_LAYERS = new Set(["domain", "application", "infrastructure", "presentation"]);
// 접근 제어자는 static·readonly·override·abstract·declare 같은 한정자와 어떤 순서로 와도 잡는다.
const MEMBER_KEYWORD =
  /^\s+(?:(?:static|readonly|override|abstract|declare|async)\s+)*(private|public|protected)\s/;
const NON_CODE_LINE = /^\s*(?:\/\/|\/\*|\*)/;
const FORWARD_REF = /\bforwardRef\(/;
const PG_ENUM_LITERAL = /pgEnum\(\s*["'`][^"'`]+["'`]\s*,\s*\[/g;

const args = process.argv.slice(2);
const strictEnums = args.includes("--strict-enums");
const fileFlagIndex = args.indexOf("--file");
const singleFile = fileFlagIndex === -1 ? null : args[fileFlagIndex + 1];

const { migratedContexts } = JSON.parse(
  readFileSync(join(apiRoot, "architecture.ratchet.json"), "utf8"),
);

function toApiRelative(filePath) {
  const absolute = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
  return relative(apiRoot, absolute).split(sep).join("/");
}

function isStrictPath(rel) {
  const segments = rel.split("/");
  if (segments[0] !== "src" || segments[1] !== "modules" || segments.length < 4) {
    return false;
  }
  if (migratedContexts.includes(segments[2])) {
    return true;
  }
  return segments.length >= 5 && !LEGACY_LAYERS.has(segments[3]);
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

function checkFile(rel, violations, warnings) {
  const text = readFileSync(join(apiRoot, rel), "utf8");
  const strict = isStrictPath(rel);
  const lines = text.split("\n");
  const templateLines = findTemplateLiteralLines(lines);

  lines.forEach((line, index) => {
    if (strict && !templateLines.has(index) && !NON_CODE_LINE.test(line)) {
      const match = MEMBER_KEYWORD.exec(line);
      // shared/domain 기반 클래스의 하위 클래스 확장점은 'override protected'로 쓴다.
      if (match && !(match[1] === "protected" && /\boverride\s/.test(line))) {
        violations.push(
          `${rel}:${index + 1}: '${match[1]}' 멤버 키워드는 쓰지 않는다. 비공개는 '#' 필드·메서드로 둔다.`,
        );
      }
    }
    if (FORWARD_REF.test(line)) {
      const entry = `${rel}:${index + 1}: forwardRef 순환 의존. 좁은 Port를 public으로 열고 반대 방향은 이벤트로 바꾼다.`;
      (strict ? violations : warnings).push(entry);
    }
  });

  if (isEnumSchemaPath(rel)) {
    const enumLines = [...text.matchAll(PG_ENUM_LITERAL)].map((match) => lineOf(text, match.index));
    const reason = "pgEnum 값을 리터럴 배열로 적었다. @aido/api/vocabulary 상수 튜플에서 유도한다.";
    if (strictEnums) {
      violations.push(...enumLines.map((line) => `${rel}:${line}: ${reason}`));
    } else if (enumLines.length > 0) {
      warnings.push(`${rel}: ${reason} (${enumLines.length}건: 줄 ${enumLines.join(", ")})`);
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

function listSourceFiles(repoFiles) {
  return repoFiles
    .filter((path) => path.startsWith("apps/api/src/") && path.endsWith(".ts"))
    .map((path) => path.slice("apps/api/".length));
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
const warnings = [];
const repoFiles = singleFile == null ? listRepoFiles() : null;
if (singleFile == null && repoFiles == null) {
  console.error("git ls-files를 실행하지 못해 관례 검사를 할 수 없다.");
  process.exit(1);
}
const files = singleFile == null ? listSourceFiles(repoFiles) : [toApiRelative(singleFile)];

for (const rel of files) {
  if (!rel.startsWith("src/") || !rel.endsWith(".ts")) {
    continue;
  }
  checkFile(rel, violations, warnings);
}

if (singleFile == null) {
  findEmptyDirectories(repoFiles, violations);
  findTrackedJunkFiles(violations);
}

if (singleFile == null && warnings.length > 0) {
  console.log(`경고 ${warnings.length}건(옛 경로이거나 --strict-enums 전에는 실패하지 않는 검사):`);
  for (const warning of warnings) {
    console.log(`  ${warning}`);
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }
  process.exit(1);
}
