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

const AMBIGUOUS_IDENTIFIERS = new Set([
	"repo",
	"svc",
	"ctx",
	"tx",
	"res",
	"req",
	"impl",
	"idem",
	"data",
	"result",
	"repository",
	"effects",
	"service",
]);

const PURE_CORE_EXTERNAL_IMPORTS = [
	/^@aido\/errors(?:\/|$)/,
	/^@aido\/domain-rules(?:\/|$)/,
	/^dayjs(?:\/|$)/,
	/^es-hangul$/,
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

function strictCoreImportViolations(files) {
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
			} else if (!PURE_CORE_EXTERNAL_IMPORTS.some((allowed) => allowed.test(specifier))) {
				reason = "external-runtime";
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

function hasModifier(node, kind) {
	return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function useCaseSignatureViolations(files) {
	const violations = [];
	for (const filePath of files.filter(
		(candidate) => isProduction(candidate) && candidate.endsWith(".use-case.ts"),
	)) {
		const file = relative(filePath);
		const sourceFile = sourceFileFor(filePath);
		const classes = sourceFile.statements.filter(ts.isClassDeclaration);
		const exportedClasses = classes.filter((node) =>
			hasModifier(node, ts.SyntaxKind.ExportKeyword),
		);
		if (exportedClasses.length !== 1) {
			violations.push(`${file}:exported-class-count:${exportedClasses.length}`);
			continue;
		}
		const useCaseClass = exportedClasses[0];
		const className = useCaseClass.name?.text ?? "<anonymous>";
		if (!className.endsWith("UseCase")) {
			violations.push(`${file}:class-name:${className}`);
		}
		const executeMethods = useCaseClass.members.filter(
			(member) =>
				ts.isMethodDeclaration(member) &&
				ts.isIdentifier(member.name) &&
				member.name.text === "execute",
		);
		if (executeMethods.length !== 1) {
			violations.push(`${file}:execute-count:${executeMethods.length}`);
			continue;
		}
		const execute = executeMethods[0];
		if (execute.parameters.length > 1) {
			violations.push(`${file}:execute-parameter-count:${execute.parameters.length}`);
		}
		if (execute.parameters.length === 1) {
			const input = execute.parameters[0];
			const inputName = ts.isIdentifier(input.name) ? input.name.text : "<binding>";
			const inputType = input.type?.getText(sourceFile) ?? "<implicit>";
			if (inputName !== "input") violations.push(`${file}:input-name:${inputName}`);
			if (!/(?:Input|Params)$/.test(inputType)) {
				violations.push(`${file}:input-type:${inputType}`);
			}
		}
		if (!execute.type || !/^Promise(?:<|$)/.test(execute.type.getText(sourceFile))) {
			violations.push(`${file}:explicit-promise-return`);
		}
	}
	return violations.toSorted();
}

function ambiguousIdentifierCounts(files) {
	const counts = {};
	for (const filePath of files.filter(isProduction)) {
		if (!coreLayer(filePath)) continue;
		const file = relative(filePath);
		const sourceFile = sourceFileFor(filePath);
		const fileCounts = {};
		function visit(node) {
			if (ts.isIdentifier(node) && AMBIGUOUS_IDENTIFIERS.has(node.text)) {
				fileCounts[node.text] = (fileCounts[node.text] ?? 0) + 1;
			}
			ts.forEachChild(node, visit);
		}
		visit(sourceFile);
		if (Object.keys(fileCounts).length > 0) counts[file] = fileCounts;
	}
	return Object.fromEntries(Object.entries(counts).toSorted(([left], [right]) => left.localeCompare(right)));
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
		strictCoreImports: strictCoreImportViolations(files),
		aggregateNaming: aggregateNamingViolations(files),
		useCaseSignatures: useCaseSignatureViolations(files),
		ambiguousIdentifiers: ambiguousIdentifierCounts(files),
		publicBarrelExports: publicBarrelViolations(files),
	};
}

function assertNoNewArrayViolations(name, current, allowed) {
	const allowedSet = new Set(allowed);
	const additions = current.filter((violation) => !allowedSet.has(violation));
	assert.deepEqual(additions, [], `${name} has new violations:\n${additions.join("\n")}`);
}

function assertNoNewAmbiguousIdentifiers(current, allowed) {
	const additions = [];
	for (const [file, counts] of Object.entries(current)) {
		for (const [identifier, count] of Object.entries(counts)) {
			const allowedCount = allowed[file]?.[identifier] ?? 0;
			if (count > allowedCount) {
				additions.push(`${file}:${identifier}:${allowedCount}->${count}`);
			}
		}
	}
	assert.deepEqual(
		additions,
		[],
		`ambiguous identifiers increased:\n${additions.join("\n")}`,
	);
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
	"strict-core imports",
	current.strictCoreImports,
	allowed.strictCoreImports,
);
assertNoNewArrayViolations(
	"aggregate/entity naming",
	current.aggregateNaming,
	allowed.aggregateNaming,
);
assertNoNewArrayViolations(
	"use-case signatures",
	current.useCaseSignatures,
	allowed.useCaseSignatures,
);
assertNoNewAmbiguousIdentifiers(
	current.ambiguousIdentifiers,
	allowed.ambiguousIdentifiers,
);
assertNoNewArrayViolations(
	"public barrel exports",
	current.publicBarrelExports,
	allowed.publicBarrelExports,
);

console.log(
	`DDD architecture regression passed: ` +
		`${current.strictCoreImports.length} strict-core imports, ` +
		`${current.aggregateNaming.length} aggregate naming violations, ` +
		`${current.useCaseSignatures.length} use-case signature violations, ` +
		`${Object.keys(current.ambiguousIdentifiers).length} files with ambiguous identifiers, ` +
		`${current.publicBarrelExports.length} internal barrel exports (all at or below baseline).`,
);
