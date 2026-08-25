import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { GitWorkspace, GitWorkspaceError } from "./gitWorkspace.js";

function git(root: string, ...args: string[]) { return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }); }

test("workspace exposes safe branch, staging, diff, and commit operations", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "nexuss-git-"));
  try {
    git(root, "init", "-b", "main"); git(root, "config", "user.email", "test@nexuss.local"); git(root, "config", "user.name", "Nexuss Test");
    await writeFile(path.join(root, "README.md"), "initial\n"); git(root, "add", "README.md"); git(root, "commit", "-m", "initial");
    const workspace = new GitWorkspace(root); await workspace.verify();
    await writeFile(path.join(root, "README.md"), "updated\n"); await writeFile(path.join(root, "new.txt"), "new\n");
    const status = await workspace.status(); assert.equal(status.length, 2); assert.ok(status.some((file) => file.path === "new.txt" && file.untracked));
    await workspace.stage(["README.md", "new.txt"]); const staged = await workspace.diff(true); assert.equal(staged.files.length, 2); assert.equal(staged.additions, 2);
    const branch = await workspace.createBranch("feature/test"); assert.match(branch.output, /feature\/test/); const commit = await workspace.commit("Add test changes"); assert.match(commit.output, /feature\/test|commit/);
    const branches = await workspace.branches(); assert.ok(branches.some((item) => item.name === "feature/test" && item.current));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("workspace blocks unsafe paths, unconfirmed pushes, and protected branches", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "nexuss-git-"));
  try {
    git(root, "init", "-b", "main"); git(root, "config", "user.email", "test@nexuss.local"); git(root, "config", "user.name", "Nexuss Test");
    await writeFile(path.join(root, "README.md"), "initial\n"); git(root, "add", "README.md"); git(root, "commit", "-m", "initial");
    const workspace = new GitWorkspace(root); await assert.rejects(() => workspace.stage(["../outside.txt"]), (error: unknown) => error instanceof GitWorkspaceError && error.code === "INVALID_PATH");
    await assert.rejects(() => workspace.push({ confirmed: false }), (error: unknown) => error instanceof GitWorkspaceError && error.code === "CONFIRMATION_REQUIRED");
    await assert.rejects(() => workspace.push({ confirmed: true }), (error: unknown) => error instanceof GitWorkspaceError && error.code === "PROTECTED_BRANCH");
  } finally { await rm(root, { recursive: true, force: true }); }
});
