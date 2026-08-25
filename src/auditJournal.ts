import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export type AuditOutcome = "started" | "succeeded" | "failed" | "denied";
export type AuditEvent = { id: string; at: string; operation: string; outcome: AuditOutcome; repository: string; actor: string; metadata: Record<string, string | number | boolean | null> };
const MAX_EVENTS = 2_000;
const MAX_METADATA = 20;
function clean(value: unknown): string | number | boolean | null { if (typeof value === "string") return value.replace(/[\r\n]/g, " ").slice(0, 300); if (typeof value === "number" || typeof value === "boolean") return value; return null; }
export class AuditJournal {
  readonly file: string;
  private writeQueue: Promise<void> = Promise.resolve();
  constructor(repositoryRoot: string, actor = "local-user") { this.file = path.join(repositoryRoot, ".nexuss-git", "audit.ndjson"); this.actor = actor.replace(/[\r\n]/g, " ").slice(0, 120); }
  private readonly actor: string;
  record(operation: string, outcome: AuditOutcome, metadata: Record<string, unknown> = {}): Promise<void> { const safeMetadata = Object.fromEntries(Object.entries(metadata).filter(([key]) => !/(token|secret|password|credential|authorization|access.?key)/i.test(key)).slice(0, MAX_METADATA).map(([key, value]) => [key.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 80), clean(value)])); const event: AuditEvent = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, at: new Date().toISOString(), operation: operation.slice(0, 100), outcome, repository: path.dirname(path.dirname(this.file)), actor: this.actor, metadata: safeMetadata }; this.writeQueue = this.writeQueue.then(async () => { await mkdir(path.dirname(this.file), { recursive: true }); await appendFile(this.file, `${JSON.stringify(event)}\n`, { encoding: "utf8" }); }); return this.writeQueue; }
  async list(limit = 100): Promise<AuditEvent[]> { try { const text = await readFile(this.file, "utf8"); return text.split("\n").filter(Boolean).slice(-Math.min(Math.max(limit, 1), MAX_EVENTS)).flatMap((line) => { try { return [JSON.parse(line) as AuditEvent]; } catch { return []; } }).reverse(); } catch { return []; } }
}
