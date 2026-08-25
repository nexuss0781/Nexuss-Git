import { createHmac, timingSafeEqual } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export type PipelineEvent = { deliveryId: string; event: string; action: string | null; repository: string | null; ref: string | null; commit: string | null; receivedAt: string; accepted: true };
export type TriggerRequest = { id: string; workflow: string; ref: string; reason: string; confirmed: true; createdAt: string; status: "requested" };
export class CicdIntegration {
  private readonly file: string;
  private readonly triggersFile: string;
  private queue: Promise<void> = Promise.resolve();
  constructor(root: string) { const dir = path.join(root, ".nexuss-git"); this.file = path.join(dir, "webhook-events.ndjson"); this.triggersFile = path.join(dir, "pipeline-triggers.ndjson"); }
  verifySignature(raw: string, signature: string | undefined, secret: string | undefined): boolean { if (!secret || !signature?.startsWith("sha256=")) return false; const expected = createHmac("sha256", secret).update(raw).digest("hex"); const provided = signature.slice(7); try { return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex")); } catch { return false; } }
  async receive(raw: string, deliveryId: string, eventName: string): Promise<{ duplicate: boolean; event: PipelineEvent }> { const previous = await this.listEvents(5000); if (previous.some((item) => item.deliveryId === deliveryId)) return { duplicate: true, event: previous.find((item) => item.deliveryId === deliveryId)! }; const payload = JSON.parse(raw) as Record<string, any>; const event: PipelineEvent = { deliveryId: deliveryId.slice(0, 120), event: eventName.slice(0, 80), action: typeof payload.action === "string" ? payload.action.slice(0, 80) : null, repository: typeof payload.repository?.full_name === "string" ? payload.repository.full_name.slice(0, 200) : null, ref: typeof payload.ref === "string" ? payload.ref.slice(0, 300) : null, commit: typeof payload.after === "string" ? payload.after.slice(0, 80) : null, receivedAt: new Date().toISOString(), accepted: true }; await this.append(this.file, event); return { duplicate: false, event }; }
  async trigger(workflow: string, ref: string, reason: string, confirmed: boolean): Promise<TriggerRequest> { if (!confirmed) throw new Error("Workflow triggers require explicit confirmation."); const request: TriggerRequest = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, workflow: workflow.replace(/[\r\n]/g, " ").slice(0, 160), ref: ref.replace(/[\r\n]/g, " ").slice(0, 300), reason: reason.replace(/[\r\n]/g, " ").slice(0, 300), confirmed: true, createdAt: new Date().toISOString(), status: "requested" }; await this.append(this.triggersFile, request); return request; }
  async listEvents(limit = 100): Promise<PipelineEvent[]> { return this.listFile(this.file, limit); }
  async listTriggers(limit = 100): Promise<TriggerRequest[]> { return this.listFile(this.triggersFile, limit); }
  private async listFile<T>(file: string, limit: number): Promise<T[]> { try { const text = await readFile(file, "utf8"); return text.split("\n").filter(Boolean).slice(-Math.min(Math.max(limit, 1), 5000)).flatMap((line) => { try { return [JSON.parse(line) as T]; } catch { return []; } }).reverse(); } catch { return []; } }
  private async append(file: string, value: unknown): Promise<void> { this.queue = this.queue.then(async () => { await mkdir(path.dirname(file), { recursive: true }); await appendFile(file, `${JSON.stringify(value)}\n`, "utf8"); }); return this.queue; }
}
