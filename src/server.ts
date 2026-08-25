import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { WorkspaceController } from "./workspaceController.js";

const port = Number(process.env.PORT || 4174);
const root = process.env.NEXUSS_REPOSITORY_ROOT ? path.resolve(process.env.NEXUSS_REPOSITORY_ROOT) : process.cwd();
const workspace = new WorkspaceController(root);
const publicRoot = path.resolve(process.cwd(), "public");

async function body(request: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
  let raw = ""; for await (const chunk of request) raw += chunk; if (raw.length > 32_000) throw new Error("Request is too large."); return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}
function send(response: import("node:http").ServerResponse, status: number, value: unknown, type = "application/json") { response.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store" }); response.end(type === "application/json" ? JSON.stringify(value) : value); }
async function handle(request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse) {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (request.method === "GET" && url.pathname === "/api/snapshot") return send(response, 200, await workspace.snapshot());
  if (request.method === "GET" && url.pathname === "/api/audit") return send(response, 200, { ok: true, data: await workspace.audit(Number(url.searchParams.get("limit") || 100)) });
  if (request.method === "POST" && url.pathname === "/api/preview") { try { const input = await body(request); return send(response, 200, await workspace.preview(String(input.operation || ""), input)); } catch (error) { return send(response, 400, { ok: false, code: "INVALID_REQUEST", message: error instanceof Error ? error.message : "Invalid preview request." }); } }
  if (request.method === "POST" && url.pathname.startsWith("/api/")) {
    try { const input = await body(request); let result;
      if (url.pathname === "/api/branch/create") result = await workspace.createBranch(String(input.name || ""), input.startPoint ? String(input.startPoint) : undefined);
      else if (url.pathname === "/api/branch/switch") result = await workspace.switchBranch(String(input.name || ""));
      else if (url.pathname === "/api/stage") result = await workspace.stage(Array.isArray(input.paths) ? input.paths.map(String) : []);
      else if (url.pathname === "/api/unstage") result = await workspace.unstage(Array.isArray(input.paths) ? input.paths.map(String) : []);
      else if (url.pathname === "/api/commit") result = await workspace.commit(String(input.message || ""));
      else if (url.pathname === "/api/push") result = await workspace.push({ remote: input.remote ? String(input.remote) : undefined, branch: input.branch ? String(input.branch) : undefined, confirmed: input.confirmed === true });
      else return send(response, 404, { ok: false, code: "NOT_FOUND", message: "Unknown workspace operation." });
      return send(response, 200, result);
    } catch (error) { return send(response, 400, { ok: false, code: "INVALID_REQUEST", message: error instanceof Error ? error.message : "Invalid request." }); }
  }
  if (request.method === "GET") { const file = url.pathname === "/" ? "/index.html" : url.pathname; if (file.includes("..")) return send(response, 400, "Invalid path.", "text/plain"); try { const content = await readFile(path.join(publicRoot, file)); const type = file.endsWith(".css") ? "text/css" : file.endsWith(".js") ? "text/javascript" : "text/html"; return send(response, 200, content.toString(), type); } catch { return send(response, 404, "Not found.", "text/plain"); } }
  return send(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." });
}
createServer((request, response) => { void handle(request, response).catch((error) => send(response, 500, { ok: false, code: "SERVER_ERROR", message: error instanceof Error ? error.message : "Server error." })); }).listen(port, "127.0.0.1", () => console.log(`Nexuss-Git workspace listening on http://127.0.0.1:${port} for ${root}`));
