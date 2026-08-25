import { GitWorkspace, type GitBranch, type GitDiff, type GitFileStatus, type GitResult } from "./gitWorkspace.js";
import { AuditJournal, type AuditEvent } from "./auditJournal.js";

export type WorkspaceSnapshot = { branch: string; status: GitFileStatus[]; branches: GitBranch[]; unstagedDiff: GitDiff; stagedDiff: GitDiff };
export type WorkspaceResponse<T> = { ok: true; data: T } | { ok: false; code: string; message: string };
export type SafetyPreview = { operation: string; title: string; summary: string; impact: string[]; requiresConfirmation: boolean; allowed: boolean; reason?: string };


export class WorkspaceController {
  private readonly git: GitWorkspace;
  private readonly journal: AuditJournal;
  private mutation: Promise<unknown> = Promise.resolve();
  constructor(repositoryRoot: string) { this.git = new GitWorkspace(repositoryRoot); this.journal = new AuditJournal(repositoryRoot); }

  async snapshot(): Promise<WorkspaceResponse<WorkspaceSnapshot>> {
    return this.safe(async () => {
      const [status, branches, unstagedDiff, stagedDiff] = await Promise.all([this.git.status(), this.git.branches(), this.git.diff(false), this.git.diff(true)]);
      return { branch: branches.find((branch) => branch.current)?.name || "", status, branches, unstagedDiff, stagedDiff };
    });
  }

  async audit(limit = 100): Promise<AuditEvent[]> { return this.journal.list(limit); }
  async preview(operation: string, input: Record<string, unknown> = {}): Promise<WorkspaceResponse<SafetyPreview>> { return this.safe(async () => { const snapshot = await this.snapshot(); if (!snapshot.ok) throw new Error(snapshot.message); const branch = snapshot.data.branch; const protectedBranch = ["main", "master", "production", "release"].includes(branch.toLowerCase()); const paths = Array.isArray(input.paths) ? input.paths.map(String) : []; const message = typeof input.message === "string" ? input.message.trim() : ""; const impact = operation === "push" ? [`Publish branch ${branch || "current"} to ${typeof input.remote === "string" ? input.remote : "origin"}`] : operation === "commit" ? [`Create one local commit from ${snapshot.data.stagedDiff.files.length} staged path(s)`] : operation === "stage" ? [`Stage ${paths.length} selected path(s)`] : operation === "unstage" ? [`Remove ${paths.length} path(s) from the staged set`] : operation === "branch.create" ? [`Create and switch to ${String(input.name || "new branch")}`] : [`Switch the workspace to ${String(input.name || "selected branch")}`]; const requiresConfirmation = operation === "commit" || operation === "push"; const allowed = operation === "push" ? !protectedBranch && Boolean(snapshot.data.branch) : operation === "commit" ? Boolean(message) && snapshot.data.stagedDiff.files.length > 0 : true; const reason = protectedBranch && operation === "push" ? `Direct pushes to ${branch} are blocked.` : operation === "commit" && !message ? "A commit message is required." : operation === "commit" && snapshot.data.stagedDiff.files.length === 0 ? "Stage at least one change first." : undefined; await this.journal.record(`${operation}.preview`, allowed ? "started" : "denied", { requiresConfirmation, allowed }); return { operation, title: requiresConfirmation ? "Review before publishing" : "Review workspace change", summary: impact[0] || "Inspect the proposed workspace change.", impact, requiresConfirmation, allowed, ...(reason ? { reason } : {}) }; }); }
  async createBranch(name: string, startPoint?: string): Promise<WorkspaceResponse<GitResult>> { return this.serial("branch.create", () => this.git.createBranch(name, startPoint), { branch: name }); }
  async switchBranch(name: string): Promise<WorkspaceResponse<GitResult>> { return this.serial("branch.switch", () => this.git.switchBranch(name), { branch: name }); }
  async stage(paths: string[]): Promise<WorkspaceResponse<GitResult>> { return this.serial("stage", () => this.git.stage(paths), { pathCount: paths.length }); }
  async unstage(paths: string[]): Promise<WorkspaceResponse<GitResult>> { return this.serial("unstage", () => this.git.unstage(paths), { pathCount: paths.length }); }
  async commit(message: string): Promise<WorkspaceResponse<GitResult>> { return this.serial("commit", () => this.git.commit(message), { messageLength: message.trim().length }); }
  async push(options: { remote?: string; branch?: string; confirmed: boolean }): Promise<WorkspaceResponse<GitResult>> { return this.serial("push", () => this.git.push(options), { remote: options.remote || "origin", branch: options.branch || null, confirmed: options.confirmed }); }

  private async serial<T>(operationName: string, operation: () => Promise<T>, metadata: Record<string, unknown> = {}): Promise<WorkspaceResponse<T>> {
    void this.journal.record(operationName, "started", metadata);
    const next = this.mutation.then(operation, operation);
    this.mutation = next.then(() => undefined, () => undefined);
    return this.safe(async () => { try { const result = await next; await this.journal.record(operationName, "succeeded", metadata); return result; } catch (error) { const value = error as { code?: string; message?: string }; await this.journal.record(operationName, value.code === "CONFIRMATION_REQUIRED" || value.code === "PROTECTED_BRANCH" ? "denied" : "failed", { ...metadata, code: value.code || "GIT_FAILED" }); throw error; } });
  }

  private async safe<T>(operation: () => Promise<T>): Promise<WorkspaceResponse<T>> {
    try { return { ok: true, data: await operation() }; } catch (error) { const value = error as { code?: string; message?: string }; return { ok: false, code: value.code || "GIT_FAILED", message: value.message || "The Git operation failed." }; }
  }
}
