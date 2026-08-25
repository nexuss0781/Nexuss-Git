import { GitWorkspace, type GitBranch, type GitDiff, type GitFileStatus, type GitResult } from "./gitWorkspace.js";

export type WorkspaceSnapshot = { branch: string; status: GitFileStatus[]; branches: GitBranch[]; unstagedDiff: GitDiff; stagedDiff: GitDiff };
export type WorkspaceResponse<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export class WorkspaceController {
  private readonly git: GitWorkspace;
  private mutation: Promise<unknown> = Promise.resolve();
  constructor(repositoryRoot: string) { this.git = new GitWorkspace(repositoryRoot); }

  async snapshot(): Promise<WorkspaceResponse<WorkspaceSnapshot>> {
    return this.safe(async () => {
      const [status, branches, unstagedDiff, stagedDiff] = await Promise.all([this.git.status(), this.git.branches(), this.git.diff(false), this.git.diff(true)]);
      return { branch: branches.find((branch) => branch.current)?.name || "", status, branches, unstagedDiff, stagedDiff };
    });
  }

  async createBranch(name: string, startPoint?: string): Promise<WorkspaceResponse<GitResult>> { return this.serial(() => this.git.createBranch(name, startPoint)); }
  async switchBranch(name: string): Promise<WorkspaceResponse<GitResult>> { return this.serial(() => this.git.switchBranch(name)); }
  async stage(paths: string[]): Promise<WorkspaceResponse<GitResult>> { return this.serial(() => this.git.stage(paths)); }
  async unstage(paths: string[]): Promise<WorkspaceResponse<GitResult>> { return this.serial(() => this.git.unstage(paths)); }
  async commit(message: string): Promise<WorkspaceResponse<GitResult>> { return this.serial(() => this.git.commit(message)); }
  async push(options: { remote?: string; branch?: string; confirmed: boolean }): Promise<WorkspaceResponse<GitResult>> { return this.serial(() => this.git.push(options)); }

  private async serial<T>(operation: () => Promise<T>): Promise<WorkspaceResponse<T>> {
    const next = this.mutation.then(operation, operation);
    this.mutation = next.then(() => undefined, () => undefined);
    return this.safe(() => next);
  }

  private async safe<T>(operation: () => Promise<T>): Promise<WorkspaceResponse<T>> {
    try { return { ok: true, data: await operation() }; } catch (error) { const value = error as { code?: string; message?: string }; return { ok: false, code: value.code || "GIT_FAILED", message: value.message || "The Git operation failed." }; }
  }
}
