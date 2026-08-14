import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(apiRoot, "src");
const baselinePath = path.join(
	apiRoot,
	"test/architecture/ddd-architecture-baseline.json",
);
const isBaselineWrite = process.argv.includes("--write-baseline");

const DOMAIN_EXTERNAL_IMPORTS = [
	/^@aido\/errors(?:\/|$)/,
	/^@aido\/validators(?:\/|$)/,
	/^dayjs(?:\/|$)/,
	/^es-hangul$/,
	/^zod(?:\/|$)/,
];

const VENDOR_SDK_IMPORTS = [
	/^@ai-sdk\//,
	/^ai$/,
	/^expo-server-sdk$/,
	/^google-auth-library$/,
	/^resend$/,
];

function walk(directory) {
	return fs
		.readdirSync(directory, { withFileTypes: true })
		.flatMap((entry) => {
			const entryPath = path.join(directory, entry.name);
			return entry.isDirectory() ? walk(entryPath) : [entryPath];
		})
		.filter((filePath) => filePath.endsWith(".ts"));
}

function relative(filePath) {
	return path.relative(apiRoot, filePath).split(path.sep).join("/");
}

function isProduction(filePath) {
	return !/\.(spec|test)\.ts$/.test(filePath);
}

function sourceFileFor(filePath) {
	return ts.createSourceFile(
		filePath,
		fs.readFileSync(filePath, "utf8"),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
}

function position(sourceFile, node) {
	const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
	return `${location.line + 1}:${location.character + 1}`;
}

function normalizedLocalTarget(importerPath, specifier) {
	if (specifier.startsWith("@/")) {
		return `src/${specifier.slice(2)}`;
	}
	if (!specifier.startsWith(".")) {
		return null;
	}
	return relative(path.resolve(path.dirname(importerPath), specifier));
}

function coreLayer(filePath) {
	const file = relative(filePath);
	if (/^src\/[^/]+\/domain\//.test(file) || /^src\/shared\/domain\//.test(file)) {
		return "domain";
	}
	if (
		/^src\/[^/]+\/application\//.test(file) ||
		/^src\/shared\/application\//.test(file)
	) {
		return "application";
	}
	return null;
}

function layerImportViolations(files) {
	const violations = [];
	for (const filePath of files.filter(isProduction)) {
		const layer = coreLayer(filePath);
		if (!layer) continue;
		const sourceFile = sourceFileFor(filePath);
		for (const statement of sourceFile.statements) {
			if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
				continue;
			}
			const specifier = statement.moduleSpecifier.text;
			const localTarget = normalizedLocalTarget(filePath, specifier);
			let reason = null;
			if (localTarget) {
				if (/^src\/generated\//.test(localTarget)) reason = "generated";
				if (/\/infrastructure(?:\/|$)/.test(localTarget)) reason = "infrastructure";
				if (/\/presentation(?:\/|$)/.test(localTarget)) reason = "presentation";
				if (layer === "domain" && /\/application(?:\/|$)/.test(localTarget)) {
					reason = "application";
				}
			} else if (
				layer === "domain" &&
				!DOMAIN_EXTERNAL_IMPORTS.some((allowed) => allowed.test(specifier))
			) {
				reason = "domain-external-runtime";
			} else if (VENDOR_SDK_IMPORTS.some((vendorSdk) => vendorSdk.test(specifier))) {
				reason = "vendor-sdk";
			}
			if (reason) {
				violations.push(
					`${relative(filePath)}:${position(sourceFile, statement.moduleSpecifier)}:${reason}:${specifier}`,
				);
			}
		}
	}
	return violations.toSorted();
}

function heritageName(node) {
	for (const clause of node.heritageClauses ?? []) {
		if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
		for (const type of clause.types) {
			const expression = type.expression;
			if (ts.isIdentifier(expression)) return expression.text;
		}
	}
	return null;
}

function aggregateNamingViolations(files) {
	const violations = [];
	for (const filePath of files.filter(isProduction)) {
		const file = relative(filePath);
		if (!/\/domain\/entities\//.test(file)) continue;
		const sourceFile = sourceFileFor(filePath);
		let hasAggregate = false;
		let hasEntity = false;
		for (const statement of sourceFile.statements) {
			if (!ts.isClassDeclaration(statement)) continue;
			const base = heritageName(statement);
			if (base === "AggregateRoot") hasAggregate = true;
			if (base === "Entity") hasEntity = true;
		}
		if (hasAggregate && !file.endsWith(".aggregate.ts")) {
			violations.push(`${file}:aggregate-root-in-non-aggregate-file`);
		}
		if (file.endsWith(".aggregate.ts") && !hasAggregate) {
			violations.push(`${file}:aggregate-file-without-aggregate-root`);
		}
		if (hasEntity && !file.endsWith(".entity.ts")) {
			violations.push(`${file}:entity-in-non-entity-file`);
		}
		if (file.endsWith(".entity.ts") && hasAggregate) {
			violations.push(`${file}:aggregate-root-in-entity-file`);
		}
	}
	return violations.toSorted();
}

function publicBarrelViolations(files) {
	const violations = [];
	for (const filePath of files.filter(
		(candidate) => isProduction(candidate) && /^src\/[^/]+\/index\.ts$/.test(relative(candidate)),
	)) {
		const file = relative(filePath);
		const sourceFile = sourceFileFor(filePath);
		for (const statement of sourceFile.statements) {
			if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) continue;
			if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
			const specifier = statement.moduleSpecifier.text;
			const isInternalSurface =
				/infrastructure\//.test(specifier) ||
				/application\/(?:facades|queries|services|strategies|use-cases|utils)\//.test(specifier) ||
				/domain\/(?:services|templates|value-objects)\//.test(specifier);
			if (isInternalSurface) {
				violations.push(
					`${file}:${position(sourceFile, statement.moduleSpecifier)}:${specifier}`,
				);
			}
		}
	}
	return violations.toSorted();
}

function collectBaseline() {
	const files = walk(sourceRoot);
	return {
		version: 1,
		layerImports: layerImportViolations(files),
		aggregateNaming: aggregateNamingViolations(files),
		publicBarrelExports: publicBarrelViolations(files),
	};
}

function assertNoNewArrayViolations(name, current, allowed) {
	const allowedSet = new Set(allowed);
	const additions = current.filter((violation) => !allowedSet.has(violation));
	assert.deepEqual(additions, [], `${name} has new violations:\n${additions.join("\n")}`);
}

const current = collectBaseline();

if (isBaselineWrite) {
	fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
	fs.writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
	console.log(`Wrote DDD architecture baseline: ${relative(baselinePath)}`);
	process.exit(0);
}

assert(fs.existsSync(baselinePath), "DDD architecture baseline is missing");
const allowed = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
assert.equal(allowed.version, 1, "unsupported DDD architecture baseline version");

assertNoNewArrayViolations(
	"layer imports",
	current.layerImports,
	allowed.layerImports,
);
assertNoNewArrayViolations(
	"aggregate/entity naming",
	current.aggregateNaming,
	allowed.aggregateNaming,
);
assertNoNewArrayViolations(
	"public barrel exports",
	current.publicBarrelExports,
	allowed.publicBarrelExports,
);

console.log(
	`DDD architecture regression passed: ` +
		`${current.layerImports.length} layer import violations, ` +
		`${current.aggregateNaming.length} aggregate naming violations, ` +
		`${current.publicBarrelExports.length} internal barrel exports (all at or below baseline).`,
);
