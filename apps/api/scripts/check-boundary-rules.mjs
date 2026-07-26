import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cruise } from "dependency-cruiser";

const require = createRequire(import.meta.url);
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(apiRoot, "test/architecture/fixtures");
const dependencyConfig = require(path.join(apiRoot, ".dependency-cruiser.cjs"));

const DOMAIN_PRESENTATION_RULE = "domain-no-presentation";
const CROSS_CONTEXT_RULE = "module-barrel-only";
const SHARED_LOCALE_TARGET =
	"src/shared/presentation/decorators/index.ts";

const LEGACY_LOCALE_DOMAIN_IMPORTERS = [
	"src/ai-report/domain/entities/ai-report.entity.ts",
	"src/ai-report/domain/services/prompts/report-fallback.ts",
	"src/ai-report/domain/services/prompts/report-insights.ts",
	"src/ai-report/domain/services/prompts/report.prompt.ts",
	"src/ai-report/domain/services/report-period.ts",
	"src/ai-report/domain/types.ts",
	"src/ai-suggestion/domain/services/prompts/detect-patterns.prompt.ts",
	"src/notification/domain/services/templates/notification-templates.ts",
	"src/user-settings/domain/services/preference-view.ts",
];

function resultOutput(result) {
	assert.equal(
		typeof result.output,
		"object",
		"dependency-cruiser must return its structured result",
	);
	return result.output;
}

function violationIdentity(violation) {
	return {
		rule: violation.rule.name,
		from: violation.from,
		to: violation.to,
	};
}

function sortIdentities(identities) {
	return identities.toSorted((left, right) =>
		`${left.rule}:${left.from}:${left.to}`.localeCompare(
			`${right.rule}:${right.from}:${right.to}`,
		),
	);
}

function assertResolvedDependency(output, from, to) {
	const source = output.modules.find((module) => module.source === from);
	assert(source, `fixture source was not cruised: ${from}`);
	const dependency = source.dependencies.find((candidate) => candidate.resolved === to);
	assert(dependency, `fixture dependency was not resolved: ${from} -> ${to}`);
	assert.equal(
		dependency.couldNotResolve,
		false,
		`fixture dependency could not resolve: ${from} -> ${to}`,
	);
	return dependency;
}

function assertRuleDidNotReject(dependency, ruleName, edge) {
	assert(
		!dependency.rules?.some((rule) => rule.name === ruleName),
		`${ruleName} unexpectedly rejected allowed edge ${edge}`,
	);
}

const domainPresentationRule = dependencyConfig.forbidden.find(
	(rule) => rule.name === DOMAIN_PRESENTATION_RULE,
);
assert(
	domainPresentationRule,
	`missing required dependency rule: ${DOMAIN_PRESENTATION_RULE}`,
);

const fixtureResult = await cruise(["src"], {
	baseDir: fixtureRoot,
	doNotFollow: { path: "node_modules" },
	ruleSet: { forbidden: dependencyConfig.forbidden },
	tsPreCompilationDeps: true,
	validate: true,
});
const fixtureOutput = resultOutput(fixtureResult);

const expectedFixtureViolations = sortIdentities([
	{
		rule: DOMAIN_PRESENTATION_RULE,
		from: "src/todo/domain/domain-imports.ts",
		to: "src/todo/presentation/todo.controller.ts",
	},
	{
		rule: DOMAIN_PRESENTATION_RULE,
		from: "src/todo/domain/domain-imports.ts",
		to: SHARED_LOCALE_TARGET,
	},
	{
		rule: DOMAIN_PRESENTATION_RULE,
		from: "src/ai-report/domain/entities/not-legacy.ts",
		to: SHARED_LOCALE_TARGET,
	},
	{
		rule: CROSS_CONTEXT_RULE,
		from: "src/todo/application/imports.ts",
		to: "src/follow/application/facades/follow.facade.ts",
	},
]);
assert.deepEqual(
	sortIdentities(fixtureOutput.summary.violations.map(violationIdentity)),
	expectedFixtureViolations,
	"architecture fixture must reject only the forbidden dependency edges",
);

const allowedBarrel = assertResolvedDependency(
	fixtureOutput,
	"src/todo/application/imports.ts",
	"src/follow/index.ts",
);
assertRuleDidNotReject(
	allowedBarrel,
	CROSS_CONTEXT_RULE,
	"todo application -> follow barrel",
);

const allowedPublicSubentry = assertResolvedDependency(
	fixtureOutput,
	"src/todo/application/imports.ts",
	"src/scheduler/queue.ts",
);
assertRuleDidNotReject(
	allowedPublicSubentry,
	CROSS_CONTEXT_RULE,
	"todo application -> scheduler public subentry",
);

const legacyCruiseOptions = {
	baseDir: apiRoot,
	doNotFollow: { path: "^src/" },
	includeOnly: "^src/",
	tsConfig: { fileName: "tsconfig.json" },
	tsPreCompilationDeps: true,
	validate: true,
};
const currentLegacyResult = await cruise(LEGACY_LOCALE_DOMAIN_IMPORTERS, {
	...legacyCruiseOptions,
	ruleSet: { forbidden: [domainPresentationRule] },
});
assert.deepEqual(
	resultOutput(currentLegacyResult).summary.violations,
	[],
	"the production rule must quarantine the nine documented legacy locale edges",
);

const strictDomainPresentationRule = {
	...domainPresentationRule,
	from: {
		...domainPresentationRule.from,
		pathNot: "\\.(spec|test)\\.ts$",
	},
};
const strictLegacyResult = await cruise(LEGACY_LOCALE_DOMAIN_IMPORTERS, {
	...legacyCruiseOptions,
	ruleSet: { forbidden: [strictDomainPresentationRule] },
});
const expectedLegacyViolations = sortIdentities(
	LEGACY_LOCALE_DOMAIN_IMPORTERS.map((from) => ({
		rule: DOMAIN_PRESENTATION_RULE,
		from,
		to: SHARED_LOCALE_TARGET,
	})),
);
assert.deepEqual(
	sortIdentities(
		resultOutput(strictLegacyResult).summary.violations.map(violationIdentity),
	),
	expectedLegacyViolations,
	"removing the legacy quarantine must expose exactly the nine current locale edges",
);

console.log(
	`Architecture boundary regression passed: ` +
		`${expectedFixtureViolations.length} forbidden fixture edges, ` +
		`${expectedLegacyViolations.length} exact legacy edges, ` +
		`2 public edges.`,
);
