import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTurnRecord } from "@hashtrack/core";
import { closeViewer, ensureViewer, findWebDir, viewerUrl } from "./web";

const dirs: string[] = [];

const tempDir = (): string => {
	const dir = mkdtempSync(join(tmpdir(), "hashtrack-web-"));
	dirs.push(dir);
	return dir;
};

const repo = (): string => {
	const dir = tempDir();
	mkdirSync(join(dir, ".hashtrack"), { recursive: true });
	const record: AgentTurnRecord = {
		t: "2026-01-01T00:00:00.000Z",
		sid: "ses-1",
		sn: "demo",
		h: "test",
		rep: "",
		mod: "test/model",
		turns: [
			{
				ti: 0,
				tools: [],
				totalUsage: {
					in: 1,
					out: 2,
					cw: 3,
					cr: 4,
					tok: 10,
					reason: 0,
					cst: 0.5,
				},
			},
		],
	};
	writeFileSync(join(dir, ".hashtrack", "usage.jsonl"), JSON.stringify(record));
	return dir;
};

/** A minimal dashboard build, so viewer tests never depend on a real `bun run build`. */
const dashboard = (): string => {
	const dir = tempDir();
	writeFileSync(
		join(dir, "index.html"),
		"<!doctype html><html><body></body></html>",
	);
	return dir;
};

afterEach(() => {
	closeViewer();
	for (const dir of dirs.splice(0))
		rmSync(dir, { recursive: true, force: true });
});

describe("findWebDir", () => {
	test("finds the dashboard next to the server bundle", () => {
		const app = tempDir();
		const here = join(app, "src");
		mkdirSync(here, { recursive: true });
		mkdirSync(join(app, "web"), { recursive: true });
		writeFileSync(join(app, "web", "index.html"), "<html></html>");

		expect(findWebDir(here)).toBe(join(app, "web"));
	});

	test("returns undefined when no dashboard exists", () => {
		const app = tempDir();
		const here = join(app, "nested", "src");
		mkdirSync(here, { recursive: true });

		expect(findWebDir(here)).toBeUndefined();
	});
});

describe("viewer", () => {
	test("serves records scoped by ?dir=", async () => {
		const dir = repo();
		const { url } = ensureViewer(dir, { webDir: dashboard() });

		const response = await fetch(
			`${url}/api/records?dir=${encodeURIComponent(dir)}`,
		);
		expect(response.status).toBe(200);
		const records = (await response.json()) as AgentTurnRecord[];
		expect(records).toHaveLength(1);
		expect(records[0]?.sid).toBe("ses-1");
	});

	test("serves the dashboard shell", async () => {
		const { url } = ensureViewer(repo(), { webDir: dashboard() });
		const response = await fetch(`${url}/`);
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("<html");
	});

	test("accepts a localhost Host", async () => {
		const { url } = ensureViewer(repo(), { webDir: dashboard() });
		const response = await fetch(`${url}/`, {
			headers: { host: `localhost:${new URL(url).port}` },
		});
		expect(response.status).toBe(200);
	});

	test("rejects a non-loopback Host", async () => {
		const dir = repo();
		const { url } = ensureViewer(dir, { webDir: dashboard() });
		// Bun.serve rebuilds request.url from the Host header, so this is a DNS-rebinding request
		const response = await fetch(
			`${url}/api/records?dir=${encodeURIComponent(dir)}`,
			{ headers: { host: "attacker.tld:4447" } },
		);
		expect(response.status).toBe(403);
		expect(await response.text()).not.toContain("ses-1");
	});

	test("malformed percent-encoding is not found", async () => {
		const { url } = ensureViewer(repo(), { webDir: dashboard() });
		const response = await fetch(`${url}/%`);
		expect(response.status).toBe(404);
	});

	test("rejects directory traversal", async () => {
		const { url } = ensureViewer(repo(), { webDir: dashboard() });
		const response = await fetch(`${url}/%2e%2e/package.json`);
		expect(response.status).toBe(404);
	});

	test("viewerUrl points at the repo", () => {
		const dir = repo();
		const webDir = dashboard();
		expect(viewerUrl(dir, { webDir })).toBe(
			`${ensureViewer(dir, { webDir }).url}/?dir=${encodeURIComponent(dir)}`,
		);
	});

	test("uses cloud records when a token is configured", async () => {
		const dir = repo();
		const remote: AgentTurnRecord = {
			t: "2026-02-01T00:00:00.000Z",
			sid: "remote",
			sn: "remote",
			h: "test",
			rep: dir,
			mod: "test/model",
			turns: [],
		};
		const originalFetch = globalThis.fetch;
		const calls: string[] = [];
		globalThis.fetch = (async (
			input: string | URL | Request,
			init?: RequestInit,
		) => {
			const url = String(input);
			if (url.startsWith("https://api.example.com/")) {
				calls.push(url);
				const headers = (init?.headers ?? {}) as Record<string, string>;
				expect(headers.authorization).toBe("Bearer tok");
				return Response.json({ records: [remote] });
			}
			return originalFetch(input, init);
		}) as typeof fetch;

		try {
			const { url } = ensureViewer(dir, {
				webDir: dashboard(),
				cloud: { url: "https://api.example.com", token: "tok" },
			});
			const response = await fetch(
				`${url}/api/records?dir=${encodeURIComponent(dir)}`,
			);
			expect(response.headers.get("x-hashtrack-source")).toBe("cloud");
			expect((await response.json()) as AgentTurnRecord[]).toEqual([remote]);
			expect(calls).toHaveLength(1);
			expect(calls[0] ?? "").toContain(`rep=${encodeURIComponent(dir)}`);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("falls back to local records when the cloud request fails", async () => {
		const dir = repo();
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (
			input: string | URL | Request,
			init?: RequestInit,
		) => {
			if (String(input).startsWith("https://api.example.com/"))
				return new Response("nope", { status: 500 });
			return originalFetch(input, init);
		}) as typeof fetch;

		try {
			const { url } = ensureViewer(dir, {
				webDir: dashboard(),
				cloud: { url: "https://api.example.com", token: "tok" },
			});
			const response = await fetch(
				`${url}/api/records?dir=${encodeURIComponent(dir)}`,
			);
			expect(response.headers.get("x-hashtrack-source")).toBe("local");
			expect((await response.json()) as AgentTurnRecord[]).toHaveLength(1);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
