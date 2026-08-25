import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);
const PROTECTED_BRANCHES = new Set(["main", "master", "production", "release"]);

export type GitFileStatus = { path: string; index: string; worktree: string; staged: boolean; unstaged: boolean; untracked: boolean };
export type GitBranch = { name: string; current: boolean; remote: string | null; ahead: number; behind: number };
export type GitDiff = { staged: boolean; text: string; files: string[]; additions: number; deletions: number };
export type GitResult = { ok: true; output: string };

export class GitWorkspaceError extends Error {
  readonly code: "INVALID_ROOT" | "NOT_REPOSITORY" | "INVALID_PATH" | "INVALID_BRANCH" | "PROTECTED_BRANCH" | "CONFIRMATION_REQUIRED" | "GIT_FAILED";
  constructor(message: string, code: GitWorkspaceError["code"] = "GIT_FAILED") { super(message); this.name = "GitWorkspaceError"; this.code = code; }
}

function safeRelative(root: string, value: string): string {
  const candidate = value.trim();
  if (!candidate || path.isAbsolute(candidate) || candidate.includes("\0")) throw new GitWorkspaceError("Choose a repository-relative path.", "INVALID_PATH");
  const resolved = path.resolve(root, candidate);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new GitWorkspaceError("The path is outside the repository.", "INVALID_PATH");
  return path.relative(root, resolved);
}

function parseStatus(output: string): GitFileStatus[] {
  return output.split("\0").filter(Boolean).map((entry) => {
    const index = entry[0] || " "; const worktree = entry[1] || " "; const file = entry.slice(3);
    return { path: file, index, worktree, staged: index !== " " && index !== "?", unstaged: worktree !== " ", untracked: index === "?" && worktree === "?" };
  });
}

async function run(root: string, args: string[], options: { allowFailure?: boolean } = {}): Promise<string> {
  try { const result = await execFileAsync("git", ["-C", root, ...args], { maxBuffer: 4 * 1024 * 1024, windowsHide: true }); return result.stdout; }
  catch (error) { if (options.allowFailure) return ""; const detail = error instanceof Error ? error.message : "Git command failed."; throw new GitWorkspaceError(detail, "GIT_FAILED"); }
}

export class GitWorkspace {
  readonly root: string;
  constructor(repositoryRoot: string) {
    this.root = path.resolve(repositoryRoot);
    if (this.root === path.parse(this.root).root) throw new GitWorkspaceError("The filesystem root cannot be a repository workspace.", "INVALID_ROOT");
  }

  async verify(): Promise<void> {
    try { await access(path.join(this.root, ".git")); } catch { throw new GitWorkspaceError("The selected folder is not a Git repository.", "NOT_REPOSITORY"); }
    await run(this.root, ["rev-parse", "--show-toplevel"]);
  }

  async status(): Promise<GitFileStatus[]> { await this.verify(); return parseStatus(await run(this.root, ["status", "--porcelain=v1", "-z"])); }

  async branches(): Promise<GitBranch[]> {
    await this.verify();
    const output = await run(this.root, ["for-each-ref", "--format=%(HEAD)\t%(refname:short)\t%(upstream:short)", "refs/heads"]);
    return output.split("\n").filter(Boolean).map((line) => { const [head, name, remote] = line.split("\t"); return { name, current: head === "*", remote: remote || null, ahead: 0, behind: 0 }; });
  }

  async createBranch(name: string, startPoint = "HEAD"): Promise<GitResult> {
    await this.verify(); this.validateBranch(name); await run(this.root, ["switch", "-c", name, startPoint]); return { ok: true, output: `Created and switched to ${name}.` };
  }

  async switchBranch(name: string): Promise<GitResult> {
    await this.verify(); this.validateBranch(name); await run(this.root, ["switch", name]); return { ok: true, output: `Switched to ${name}.` };
  }

  async stage(paths: string[]): Promise<GitResult> { await this.verify(); const safe = paths.map((value) => safeRelative(this.root, value)); if (!safe.length) throw new GitWorkspaceError("Choose at least one file to stage.", "INVALID_PATH"); await run(this.root, ["add", "--", ...safe]); return { ok: true, output: `Staged ${safe.length} path${safe.length === 1 ? "" : "s"}.` }; }
  async unstage(paths: string[]): Promise<GitResult> { await this.verify(); const safe = paths.map((value) => safeRelative(this.root, value)); if (!safe.length) throw new GitWorkspaceError("Choose at least one file to unstage.", "INVALID_PATH"); await run(this.root, ["restore", "--staged", "--", ...safe]); return { ok: true, output: `Unstaged ${safe.length} path${safe.length === 1 ? "" : "s"}.` }; }

  async diff(staged = false): Promise<GitDiff> {
    await this.verify(); const diffArgs = staged ? ["diff", "--cached", "--no-ext-diff"] : ["diff", "--no-ext-diff"]; const text = await run(this.root, diffArgs); const files = (await run(this.root, [...diffArgs, "--name-only", "-z"])).split("\0").filter(Boolean); const plain = text.replace(/\u001b\[[0-9;]*m/g, ""); const lines = plain.split(/\r?\n/); const additions = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++ ")).length; const deletions = lines.filter((line) => line.startsWith("-") && !line.startsWith("--- ")).length; return { staged, text, files, additions, deletions };
  }

  async commit(message: string): Promise<GitResult> { await this.verify(); const value = message.trim(); if (!value || value.length > 200) throw new GitWorkspaceError("Commit messages must be 1–200 characters.", "GIT_FAILED"); const staged = (await this.status()).some((file) => file.staged); if (!staged) throw new GitWorkspaceError("Stage at least one change before committing.", "GIT_FAILED"); const output = await run(this.root, ["commit", "-m", value]); return { ok: true, output: output.trim() }; }

  async push(options: { remote?: string; branch?: string; confirmed: boolean }): Promise<GitResult> {
    await this.verify(); if (!options.confirmed) throw new GitWorkspaceError("Push requires explicit confirmation.", "CONFIRMATION_REQUIRED"); const branch = options.branch?.trim() || (await run(this.root, ["branch", "--show-current"])).trim(); this.validateBranch(branch); if (PROTECTED_BRANCHES.has(branch.toLowerCase())) throw new GitWorkspaceError(`Direct pushes to ${branch} are blocked. Use a pull request.`, "PROTECTED_BRANCH"); const remote = options.remote?.trim() || "origin"; if (!/^[A-Za-z0-9_.-]{1,80}$/.test(remote)) throw new GitWorkspaceError("Invalid Git remote.", "GIT_FAILED"); return { ok: true, output: (await run(this.root, ["push", remote, branch])).trim() };
  }

  private validateBranch(name: string): void { if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,190}$/.test(name) || name.includes("..") || name.endsWith("/") || name.endsWith(".")) throw new GitWorkspaceError("Invalid branch name.", "INVALID_BRANCH"); }
}
