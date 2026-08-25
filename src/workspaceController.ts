import { GitWorkspace, type GitBranch, type GitDiff, type GitFileStatus, type GitResult } from "./gitWorkspace.js";
import { AuditJournal, type AuditEvent } from "./auditJournal.js";

export type WorkspaceSnapshot = { branch: string; status: GitFileStatus[]; branches: GitBranch[]; unstagedDiff: GitDiff; stagedDiff: GitDiff };
export type WorkspaceResponse<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

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
