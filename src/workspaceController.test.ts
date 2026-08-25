import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { WorkspaceController } from "./workspaceController.js";

function git(root: string, ...args: string[]) { return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }); }

test("controller returns a structured repository snapshot and stable failures", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "nexuss-controller-"));
  try {
    git(root, "init", "-b", "main"); git(root, "config", "user.email", "test@nexuss.local"); git(root, "config", "user.name", "Nexuss Test");
    await writeFile(path.join(root, "README.md"), "hello\n"); git(root, "add", "README.md"); git(root, "commit", "-m", "initial");
    const controller = new WorkspaceController(root); const snapshot = await controller.snapshot();
    assert.equal(snapshot.ok, true); if (snapshot.ok) { assert.equal(snapshot.data.branch, "main"); assert.equal(snapshot.data.status.length, 0); assert.ok(snapshot.data.branches.some((branch) => branch.name === "main" && branch.current)); }
    const failed = await controller.stage(["../outside.txt"]); assert.equal(failed.ok, false); if (!failed.ok) assert.equal(failed.code, "INVALID_PATH");
  } finally { await rm(root, { recursive: true, force: true }); }
});
