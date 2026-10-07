import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

const dependencyMapSchema = z.record(z.string(), z.string()).optional();
const workspaceManifestSchema = z.object({
  name: z.string(),
  dependencies: dependencyMapSchema,
  devDependencies: dependencyMapSchema,
  peerDependencies: dependencyMapSchema,
  optionalDependencies: dependencyMapSchema,
});
type WorkspaceManifest = z.infer<typeof workspaceManifestSchema>;

const workspaceRoot = resolve(import.meta.dirname, "../../../..");

function readWorkspaceManifests(): WorkspaceManifest[] {
  return ["apps", "packages", "tooling"].flatMap((directory) =>
    readdirSync(resolve(workspaceRoot, directory), { withFileTypes: true }).flatMap((entry) => {
      const manifestPath = resolve(workspaceRoot, directory, entry.name, "package.json");
      if (!entry.isDirectory() || !existsSync(manifestPath)) return [];
      return [workspaceManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")))];
    }),
  );
}

describe("Workspace 의존성 경계", () => {
  it("공유 REST 계약에 서버·네이티브 런타임 의존성이 없어야 한다", () => {
    // Given
    const sourceRoot = resolve(workspaceRoot, "packages/api/src");
    const sources = readdirSync(sourceRoot, { recursive: true, encoding: "utf8" }).filter((file) =>
      file.endsWith(".ts"),
    );
    const serverImport =
      /(?:from|import)\s*(?:[\w\s{},*]+\s*from\s*)?["'](?:@nestjs\/|@prisma\/|@aido\/(?:server|mobile)|node:|pg["']|react-native)/;
    // When & Then
    for (const file of sources) {
      const code = readFileSync(resolve(sourceRoot, file), "utf8");
      expect(code, file).not.toMatch(serverImport);
      if (file.startsWith("vocabulary/")) expect(code, file).not.toMatch(/from\s*["']zod["']/);
    }
  });

  it("서버와 공유 계약을 포함한 모든 패키지 이름이 고유해야 한다", () => {
    // Given
    const names = readWorkspaceManifests().map((manifest) => manifest.name);
    // When
    const uniqueNames = new Set(names);
    // Then
    expect(uniqueNames.size).toBe(names.length);
  });

  it("모든 workspace 의존성이 존재하고 순환하지 않아야 한다", () => {
    // Given
    const manifests = readWorkspaceManifests();
    const graph = new Map(
      manifests.map((manifest) => [
        manifest.name,
        Object.entries({
          ...manifest.dependencies,
          ...manifest.devDependencies,
          ...manifest.peerDependencies,
          ...manifest.optionalDependencies,
        })
          .filter(([, version]) => version.startsWith("workspace:"))
          .map(([name]) => name),
      ]),
    );
    const visited = new Set<string>();
    const visit = (name: string, ancestors: readonly string[]): void => {
      expect(ancestors, `순환 의존: ${[...ancestors, name].join(" → ")}`).not.toContain(name);
      expect(graph.has(name), `존재하지 않는 workspace: ${name}`).toBe(true);
      if (visited.has(name)) return;
      for (const dependency of graph.get(name) ?? []) visit(dependency, [...ancestors, name]);
      visited.add(name);
    };
    // When & Then
    for (const name of graph.keys()) visit(name, []);
  });
});
