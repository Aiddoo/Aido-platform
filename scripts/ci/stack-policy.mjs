const TIP_LABEL = 'ci:stack-tip';
const STACK_LABEL_PATTERN = /^stack:[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const STACK_BRANCH_PATTERN = /^(?:[^/]+\/\d+\.\d+(?:\.\d+)?-|refactor\/server-)/;

const hasLabel = (pull, name) => pull.labels.some((label) => label.name === name);

export function planPullRequestCI(current, openPulls, repository) {
  const stackLabels = current.labels.filter((label) => STACK_LABEL_PATTERN.test(label.name));
  if (stackLabels.length > 1) throw new Error('A pull request must belong to only one stack.');
  const stackLabel = stackLabels[0]?.name;
  const isStack = STACK_BRANCH_PATTERN.test(current.head.ref) || stackLabel !== undefined;
  if (!isStack) {
    return {
      run: current.head.ref !== 'develop',
      base: current.base.ref,
      ancestors: [],
      reason: 'regular',
    };
  }
  if (!stackLabel) {
    return { run: false, base: 'develop', ancestors: [], reason: 'awaiting-stack-metadata' };
  }
  const members = openPulls.filter((pull) => hasLabel(pull, stackLabel));
  const tips = members.filter((pull) => hasLabel(pull, TIP_LABEL));
  if (tips.length > 1) throw new Error('A stack must have exactly one CI tip.');
  if (!hasLabel(current, TIP_LABEL) || current.draft) {
    return { run: false, base: 'develop', ancestors: [], reason: 'intermediate-or-draft' };
  }
  if (tips.length !== 1 || tips[0].number !== current.number) {
    throw new Error('The current pull request must be the live stack tip.');
  }
  const byHead = new Map(members.map((pull) => [pull.head.ref, pull]));
  if (byHead.size !== members.length) throw new Error('Duplicate stack branches.');
  const ancestors = [];
  const visited = new Set();
  let pull = current;
  while (true) {
    if (visited.has(pull.number)) throw new Error('Circular stack dependency.');
    if (pull.head.repo?.full_name !== repository)
      throw new Error('Stack branches must belong to this repository.');
    visited.add(pull.number);
    if (pull.number !== current.number) ancestors.push(pull.head.sha);
    if (pull.base.ref === 'develop') break;
    pull = byHead.get(pull.base.ref);
    if (!pull) throw new Error('The stack must connect to develop without missing pull requests.');
  }
  if (visited.size !== members.length) throw new Error('Disconnected stack branches.');
  return { run: true, base: 'develop', ancestors, reason: 'cumulative-stack-tip' };
}

export function validationProofName(runId, attempt) {
  return `ci-tree-proof-${runId}-${attempt}`;
}

/** jobsAttempt comes from the attempt-specific API route; job responses need not include it. */
export function validateTreeProof({
  proof,
  run,
  artifact,
  pull,
  jobs,
  jobsAttempt,
  repository,
  workflowId,
  currentTree,
  requiredScope,
  testedCommitTree,
  headCommitTree,
  headIncluded,
}) {
  const sha = (value) => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
  const sameRepo = (value) =>
    typeof value === 'string' && value.toLowerCase() === repository.toLowerCase();
  const scopeKeys = ['api', 'mobile', 'shared'];
  if (
    proof?.version !== 1 ||
    proof.reason !== 'cumulative-stack-tip' ||
    !Number.isSafeInteger(proof.runId) ||
    !Number.isSafeInteger(proof.attempt) ||
    proof.attempt < 1 ||
    !Number.isSafeInteger(proof.pullNumber) ||
    !sameRepo(proof.repository) ||
    !sha(proof.headSha) ||
    !sha(proof.testedCommit) ||
    !sha(proof.tree) ||
    !sha(proof.baseSha) ||
    !Array.isArray(proof.ancestors) ||
    !proof.ancestors.every(sha) ||
    !scopeKeys.every((key) => typeof proof.scopes?.[key] === 'boolean') ||
    !scopeKeys.some((key) => proof.scopes[key])
  )
    return { reusable: false, reason: 'invalid-proof' };
  if (
    run?.id !== proof.runId ||
    run.run_attempt !== proof.attempt ||
    run.workflow_id !== workflowId ||
    run.path !== '.github/workflows/ci.yml' ||
    run.event !== 'pull_request' ||
    run.status !== 'completed' ||
    run.conclusion !== 'success' ||
    run.head_sha !== proof.headSha ||
    !sameRepo(run.repository?.full_name) ||
    !sameRepo(run.head_repository?.full_name)
  )
    return { reusable: false, reason: 'untrusted-run' };
  if (
    artifact?.name !== validationProofName(proof.runId, proof.attempt) ||
    artifact.expired !== false ||
    artifact.workflow_run?.id !== run.id ||
    artifact.workflow_run?.head_sha !== proof.headSha
  )
    return { reusable: false, reason: 'untrusted-artifact' };
  const labels = Array.isArray(pull?.labels) ? pull.labels : [];
  const stackLabels = labels.filter((label) => STACK_LABEL_PATTERN.test(label.name));
  if (
    pull?.number !== proof.pullNumber ||
    pull.draft !== false ||
    !sameRepo(pull.head?.repo?.full_name) ||
    !sameRepo(pull.base?.repo?.full_name) ||
    pull.head.sha !== proof.headSha ||
    pull.head.ref !== run.head_branch ||
    stackLabels.length !== 1 ||
    stackLabels[0].name !== proof.stackLabel ||
    !labels.some((label) => label.name === TIP_LABEL)
  )
    return { reusable: false, reason: 'untrusted-tip' };
  if (
    !sha(currentTree) ||
    proof.tree !== currentTree ||
    testedCommitTree !== currentTree ||
    headCommitTree !== currentTree ||
    headIncluded !== true
  )
    return { reusable: false, reason: 'tree-or-ancestry-mismatch' };
  if (
    !scopeKeys.every(
      (key) =>
        typeof requiredScope?.[key] === 'boolean' && (!requiredScope[key] || proof.scopes[key]),
    )
  ) {
    return { reusable: false, reason: 'insufficient-scope' };
  }
  const requiredJobs = ['Lint & Type Check'];
  if (proof.scopes.api) requiredJobs.push('Verify API');
  if (proof.scopes.mobile || proof.scopes.shared) requiredJobs.push('Test - Mobile & Contracts');
  if (
    jobsAttempt !== proof.attempt ||
    !Array.isArray(jobs) ||
    !requiredJobs.every((name) => {
      const matches = jobs.filter((job) => job.name === name);
      return (
        matches.length === 1 &&
        matches[0].run_id === run.id &&
        matches[0].status === 'completed' &&
        matches[0].conclusion === 'success'
      );
    })
  )
    return { reusable: false, reason: 'required-job-not-successful' };
  return { reusable: true, reason: 'successful-stack-tip-tree' };
}
