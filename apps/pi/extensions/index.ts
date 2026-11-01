import { execSync, spawn } from "node:child_process";
import { chmodSync, existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { homedir } from "node:os";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type ExtensionAPI,
	type ExtensionContext,
	VERSION,
} from "@earendil-works/pi-coding-agent";
import {
	type CloudConfig,
	resolveRepoRecords,
	Session,
	type Tool,
	type Usage,
} from "@hashtrack/core";
import {
	compactNumberFormatter,
	dollarNumberFormatter,
	hashtrackColorRgb,
	hashtrackMark,
} from "@hashtrack/lib";

const PORT = 4444;

function readCloudConfig(): CloudConfig | undefined {
	const agentDir =
		process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
	// `witness` is the pre-rename config directory, kept as a fallback
	const file = ["hashtrack", "witness"]
		.map((dir) => join(dirname(agentDir), dir, "config.json"))
		.find((candidate) => existsSync(candidate));
	if (!file) return undefined;

	let cfg: { token?: unknown; url?: unknown };
	try {
		cfg = JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return undefined;
	}

	if (typeof cfg.token !== "string") return undefined;

	try {
		chmodSync(file, 0o600);
	} catch {}

	return {
		token: cfg.token,
		...(typeof cfg.url === "string" ? { url: cfg.url } : {}),
	};
}

export default function main(pi: ExtensionAPI) {
	let session: Session;
	let ctx: ExtensionContext;
	let server: Server | undefined;
	let piVersion: string | undefined;
	let cloud: CloudConfig | undefined;

	function harnessVersion(): string {
		if (!piVersion) {
			try {
				piVersion =
					execSync("pi --version", {
						encoding: "utf8",
						stdio: ["ignore", "pipe", "ignore"],
					}).trim() || undefined;
			} catch {
				piVersion = undefined;
			}
		}
		return piVersion ?? VERSION;
	}

	function toUsage(u?: {
		input?: number;
		output?: number;
		cacheWrite?: number;
		cacheRead?: number;
		totalTokens?: number;
		reasoning?: number;
		cost?: { total?: number };
	}): Usage {
		return {
			in: u?.input || 0,
			out: u?.output || 0,
			cw: u?.cacheWrite || 0,
			cr: u?.cacheRead || 0,
			tok: u?.totalTokens || 0,
			reason: u?.reasoning || 0,
			cst: u?.cost?.total || 0,
		};
	}

	function renderStatus(): void {
		const { theme } = ctx.ui;
		const mark = theme.style(hashtrackMark, {
			// the favicon orange, as a pi-tui rgb Color
			fg: { kind: "rgb", ...hashtrackColorRgb },
		});
		const totals = theme.fg(
			"dim",
			`${compactNumberFormatter.format(session.totalTokens)} · ${dollarNumberFormatter.format(session.totalCost)}`,
		);
		ctx.ui.setStatus("hashtrack", `${mark} ${totals}`);
	}

	pi.on("session_start", async (event, c) => {
		ctx = c;
		cloud = readCloudConfig();
		session = new Session({
			sessionId: ctx.sessionManager.getSessionId(),
			harness: "pi",
			harnessVersion: piVersion ?? harnessVersion(),
			cloud,
		});
		session.addMetadata({ start_reason: event.reason });
		renderStatus();
		await session.syncPending();
	});

	pi.on("input", (event) => {
		if (!event.text.startsWith("/skill:")) return;
		const name = event.text.slice(7).trim().split(/\s+/)[0];
		if (name) session.addSkill(name);
	});

	pi.on("tool_call", (event) => {
		if (event.toolName !== "read") return;
		const path: unknown = event.input.path;
		if (typeof path !== "string") return;
		if (path !== "SKILL.md" && !path.endsWith("/SKILL.md")) return;
		const dir = path === "SKILL.md" ? "" : path.slice(0, -"/SKILL.md".length);
		session.addSkill(dir.split("/").pop() || "skill:unknown");
	});

	pi.on("session_info_changed", async (event) => {
		session.sessionName = event.name ?? "";
	});

	pi.on("agent_start", async (_, c) => {
		let model: string = "";

		const mdl = c.model || ctx.model;
		if (mdl) {
			model = `${mdl.provider}/${mdl.name}`;
		}

		session.startAgent({ dateTimeISOString: new Date().toISOString(), model });
	});

	pi.on("turn_end", async (event) => {
		const tools: (Tool & { usage: Usage })[] = (event.toolResults ?? []).map(
			(t) => ({
				name: t.toolName,
				isError: t.isError,
				usage: toUsage(t.usage),
			}),
		);

		const assistantMsg =
			event.message && event.message.role === "assistant"
				? event.message
				: undefined;

		const usages = [toUsage(assistantMsg?.usage), ...tools.map((t) => t.usage)];

		session.addTurn({
			index: event.turnIndex,
			tools,
			totalUsage: usages.reduce(
				(acc, u) => ({
					in: acc.in + u.in,
					out: acc.out + u.out,
					cw: acc.cw + u.cw,
					cr: acc.cr + u.cr,
					tok: acc.tok + u.tok,
					reason: acc.reason + u.reason,
					cst: acc.cst + u.cst,
				}),
				{
					in: 0,
					out: 0,
					cw: 0,
					cr: 0,
					tok: 0,
					reason: 0,
					cst: 0,
				} satisfies Usage,
			),
		});

		renderStatus();
	});

	pi.on("agent_settled", async () => {
		await session.flush();
		renderStatus();
	});

	pi.registerCommand("hashtrack:show", {
		description: "Show detailed usage data for this project",
		handler: async (_args, c) => {
			const base = dirname(fileURLToPath(import.meta.url));
			const candidates = [
				join(base, "local-web"),
				join(base, "../../packages/local-web/dist"),
				join(base, "../..", "local-web"),
			];
			const dist = candidates.find((p) => existsSync(join(p, "index.html")));

			if (!dist) {
				c.ui.notify(
					`hashtrack: viewer not found (tried: ${candidates.join(", ")})`,
					"error",
				);
				return;
			}

			if (!server) {
				try {
					const MIME: Record<string, string> = {
						".html": "text/html; charset=utf-8",
						".js": "text/javascript",
						".css": "text/css",
						".json": "application/json",
						".svg": "image/svg+xml",
						".png": "image/png",
						".ico": "image/x-icon",
					};

					server = createServer(async (req, res) => {
						const { pathname } = new URL(req.url ?? "/", "http://localhost");
						if (pathname === "/api/records") {
							try {
								const { records, source } = await resolveRepoRecords({ cloud });
								res.writeHead(200, {
									"content-type": MIME[".json"],
									"x-hashtrack-source": source,
								});
								res.end(JSON.stringify(records));
							} catch {
								res.writeHead(500, { "content-type": MIME[".json"] });
								res.end(JSON.stringify({ error: "records unavailable" }));
							}
							return;
						}

						const rel = pathname === "/" ? "index.html" : pathname.slice(1);
						const file = join(dist, rel);

						if (!file.startsWith(`${dist}/`)) {
							res.writeHead(404).end("not found");
							return;
						}

						try {
							const body = readFileSync(file);
							res.writeHead(200, {
								"content-type":
									MIME[extname(file)] ?? "application/octet-stream",
							});
							res.end(body);
						} catch {
							res.writeHead(404).end("not found");
						}
					});

					await new Promise<void>((resolve, reject) => {
						server?.once("error", reject);
						server?.listen(PORT, "127.0.0.1", resolve);
					});
				} catch (e) {
					c.ui.notify(`hashtrack: server failed — ${e}`, "error");
					return;
				}
			}

			if (process.platform === "darwin") {
				spawn("open", [`http://localhost:${PORT}`], { stdio: "ignore" });
			} else {
				c.ui.notify(`hashtrack: http://localhost:${PORT}`, "info");
			}
		},
	});

	pi.on("session_shutdown", async () => {
		server?.closeAllConnections?.();
		server?.close();
		await session.flush();
	});
}
