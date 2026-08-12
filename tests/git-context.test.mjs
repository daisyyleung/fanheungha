import assert from "node:assert/strict";
import test from "node:test";

import { classifyGitContext } from "../scripts/validate-public-repo.mjs";

const sha = "a".repeat(40);
const valid = {
  branch: "HEAD",
  headSha: sha,
  packageVersion: "0.1.0",
  refExists: true,
  tagType: "tag",
  tagObjectSha: sha,
  tagTargetSha: sha,
  mainContainsHead: true,
  env: {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "push",
    GITHUB_REF_TYPE: "tag",
    GITHUB_REF_NAME: "v0.1.0",
    GITHUB_REF: "refs/tags/v0.1.0",
    GITHUB_SHA: sha,
    VERIFIED_TAG_OBJECT_SHA: sha,
    VERIFIED_MAIN_ANCESTRY: "true",
  },
};

test("attached main and verified release tag contexts are accepted", () => {
  assert.equal(classifyGitContext({ ...valid, branch: "main" }).accepted, true);
  assert.equal(classifyGitContext(valid).accepted, true);
});

test("detached contexts require every release binding", () => {
  const cases = [
    ["ordinary detached", { env: { ...valid.env, GITHUB_ACTIONS: "false" } }],
    ["pull request", { env: { ...valid.env, GITHUB_EVENT_NAME: "pull_request" } }],
    ["wrong tag version", { env: { ...valid.env, GITHUB_REF_NAME: "v0.2.0", GITHUB_REF: "refs/tags/v0.2.0" } }],
    ["wrong ref", { env: { ...valid.env, GITHUB_REF: "refs/tags/other" } }],
    ["wrong commit", { env: { ...valid.env, GITHUB_SHA: "b".repeat(40) } }],
    ["lightweight tag", { tagType: "commit" }],
    ["missing local tag", { refExists: false }],
    ["wrong target", { tagTargetSha: "b".repeat(40) }],
    ["wrong verified object", { env: { ...valid.env, VERIFIED_TAG_OBJECT_SHA: "b".repeat(40) } }],
    ["not on main ancestry", { mainContainsHead: false }],
    ["missing main ancestry marker", { env: { ...valid.env, VERIFIED_MAIN_ANCESTRY: "false" } }],
  ];
  for (const [label, variant] of cases) {
    assert.equal(classifyGitContext({ ...valid, ...variant }).accepted, false, `${label} must fail`);
  }
});
