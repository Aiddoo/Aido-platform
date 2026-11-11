import { globSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { type AlertDefinition, isAlertDefinition } from "./define-alerts.js";

const SOURCE_ROOT = join(import.meta.dirname, "../../..");
const CATALOG_DOC = join(SOURCE_ROOT, "../docs/alerts.md");
const TABLE_START = "<!-- alert-catalog:start -->";
const TABLE_END = "<!-- alert-catalog:end -->";

interface CatalogFile {
  readonly path: string;
  readonly definitions: readonly AlertDefinition[];
}

async function loadCatalogs(): Promise<CatalogFile[]> {
  const paths = globSync("**/*.alerts.ts", { cwd: SOURCE_ROOT }).toSorted();
  return Promise.all(
    paths.map(async (path) => {
      const exported: Record<string, unknown> = await import(join(SOURCE_ROOT, path));
      const definitions = Object.values(exported).flatMap((catalog) =>
        typeof catalog === "object" && catalog != null
          ? Object.values(catalog).filter(isAlertDefinition)
          : [],
      );
      return { path, definitions };
    }),
  );
}

/** 문서 표의 행을 칸 배열로 읽는다. 머리글·구분선은 건너뛴다. */
function readDocRows(): string[][] {
  const doc = readFileSync(CATALOG_DOC, "utf8");
  const table = doc.slice(doc.indexOf(TABLE_START) + TABLE_START.length, doc.indexOf(TABLE_END));
  return table
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .slice(2)
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim().replaceAll("`", "")),
    );
}

describe("경보 카탈로그 — slice *.alerts.ts 전체", () => {
  it("모든 *.alerts.ts가 defineAlerts 정의를 하나 이상 내보낸다", async () => {
    // When
    const catalogs = await loadCatalogs();

    // Then
    expect(catalogs.filter((catalog) => catalog.definitions.length === 0)).toEqual([]);
  });

  it("key는 전체에서 하나뿐이고 context로 시작하며 summary·runbook이 비어 있지 않다", async () => {
    // Given
    const definitions = (await loadCatalogs()).flatMap((catalog) => catalog.definitions);

    // When
    const keys = definitions.map((definition) => definition.key);
    const incomplete = definitions.filter(
      (definition) =>
        !definition.key.startsWith(`${definition.context}.`) ||
        definition.summary.trim() === "" ||
        definition.runbook.trim() === "",
    );

    // Then
    expect(new Set(keys).size).toBe(keys.length);
    expect(incomplete).toEqual([]);
  });

  it("운영 문서(docs/alerts.md)의 경보 표가 카탈로그와 같다", async () => {
    // Given
    const definitions = (await loadCatalogs()).flatMap((catalog) => catalog.definitions);
    const expected = definitions
      .map((definition) => [
        definition.key,
        definition.severity,
        definition.summary,
        definition.runbook,
      ])
      .toSorted(([left = ""], [right = ""]) => left.localeCompare(right));

    // When
    const documented = readDocRows();

    // Then
    expect(documented, `${relative(SOURCE_ROOT, CATALOG_DOC)} 표를 카탈로그에 맞춘다`).toEqual(
      expected,
    );
  });
});
