import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AuditJournal } from "./auditJournal.js";

test("audit journal persists redacted events and returns newest records first", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "nexuss-audit-"));
  try {
    const journal = new AuditJournal(root, "operator\nname");
    await Promise.all([journal.record("stage", "started", { path: "src/app.ts\nsecret", token: "do-not-store" }), journal.record("stage", "succeeded", { pathCount: 1 })]);
    const events = await journal.list(10); assert.equal(events.length, 2); assert.equal(events[0]?.operation, "stage"); assert.equal(events[0]?.actor, "operator name"); assert.equal(events[1]?.metadata.path, "src/app.ts secret");
    const raw = await readFile(path.join(root, ".nexuss-git", "audit.ndjson"), "utf8"); assert.equal(raw.includes("do-not-store"), false); assert.equal(raw.includes("token"), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
