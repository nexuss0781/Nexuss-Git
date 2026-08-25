import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CicdIntegration } from "./cicdIntegration.js";

test("CI/CD integration verifies signatures and deduplicates deliveries", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "nexuss-cicd-"));
  try { const service = new CicdIntegration(root); const payload = JSON.stringify({ action: "completed", ref: "refs/heads/main", after: "abc123", repository: { full_name: "nexuss0781/Nexuss-Git" } }); const signature = `sha256=${createHmac("sha256", "secret").update(payload).digest("hex")}`; assert.equal(service.verifySignature(payload, signature, "secret"), true); assert.equal(service.verifySignature(payload, signature, "wrong"), false); const first = await service.receive(payload, "delivery-1", "workflow_run"); const second = await service.receive(payload, "delivery-1", "workflow_run"); assert.equal(first.duplicate, false); assert.equal(second.duplicate, true); assert.equal((await service.listEvents()).length, 1); } finally { await rm(root, { recursive: true, force: true }); }
});

test("workflow triggers require explicit confirmation", async () => { const root = await mkdtemp(path.join(tmpdir(), "nexuss-trigger-")); try { const service = new CicdIntegration(root); await assert.rejects(() => service.trigger("ci.yml", "main", "verify change", false), /explicit confirmation/); const request = await service.trigger("ci.yml", "feature/test", "verify change", true); assert.equal(request.status, "requested"); assert.equal((await service.listTriggers()).length, 1); } finally { await rm(root, { recursive: true, force: true }); } });
