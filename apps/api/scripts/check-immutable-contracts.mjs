import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const immutableFiles = new Map([
	[
		"test/e2e/__snapshots__/openapi-contract.e2e-spec.ts.snap",
		"2079f14a03b72a55b0ddb6b61e89025d247a78e01f4e4eaed6ad1fc90771c2be",
	],
	[
		"test/e2e/fixtures/released-v1-openapi-contract.ts",
		"b3b55a4b8ac5181f461fd5a2b3784e8c82ee2437290626619a500ebb1c76971b",
	],
	[
		"prisma/schema.prisma",
		"1174854c83a96a1256cd57a58735a2152e75bb4a53d261f1349e387dbf0782a3",
	],
]);

function sha256(content) {
	return crypto.createHash("sha256").update(content).digest("hex");
}

for (const [file, expectedDigest] of immutableFiles) {
	const filePath = path.join(apiRoot, file);
	assert(fs.existsSync(filePath), `immutable contract file is missing: ${file}`);
	assert.equal(
		sha256(fs.readFileSync(filePath)),
		expectedDigest,
		`immutable contract changed: ${file}`,
	);
}

const migrationsRoot = path.join(apiRoot, "prisma/migrations");
const migrationFiles = fs
	.readdirSync(migrationsRoot, { recursive: true, withFileTypes: true })
	.filter((entry) => entry.isFile())
	.map((entry) => path.join(entry.parentPath, entry.name))
	.toSorted();
const migrationManifest = migrationFiles
	.map((filePath) => {
		const relativePath = path.relative(migrationsRoot, filePath).split(path.sep).join("/");
		return `${relativePath}:${sha256(fs.readFileSync(filePath))}`;
	})
	.join("\n");
assert.equal(
	sha256(migrationManifest),
	"02abc07605d7b19df51d59bdd2bd8be12660dc0191a4c24fce915332c10df3f5",
	"Prisma migrations changed during the no-migration refactor",
);

console.log(
	`Immutable contracts passed: ${immutableFiles.size} files and ` +
		`${migrationFiles.length} Prisma migration files unchanged.`,
);
