import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTurnRecord } from "witness";
import { closeViewer, ensureViewer, findWebDir, viewerUrl } from "./web";

const dirs: string[] = [];

const tempDir = (): string => {
	const dir = mkdtempSync(join(tmpdir(), "witness-web-"));
	dirs.push(dir);
	return dir;
};

const repo = (): string => {
	const dir = tempDir();
	mkdirSync(join(dir, ".witness"), { recursive: true });
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
	writeFileSync(join(dir, ".witness", "usage.jsonl"), JSON.stringify(record));
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
		const { url } = ensureViewer(dir, dashboard());

		const response = await fetch(
			`${url}/api/records?dir=${encodeURIComponent(dir)}`,
		);
		expect(response.status).toBe(200);
		const records = (await response.json()) as AgentTurnRecord[];
		expect(records).toHaveLength(1);
		expect(records[0]?.sid).toBe("ses-1");
	});

	test("serves the dashboard shell", async () => {
		const { url } = ensureViewer(repo(), dashboard());
		const response = await fetch(`${url}/`);
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("<html");
	});

	test("accepts a localhost Host", async () => {
		const { url } = ensureViewer(repo(), dashboard());
		const response = await fetch(`${url}/`, {
			headers: { host: `localhost:${new URL(url).port}` },
		});
		expect(response.status).toBe(200);
	});

	test("rejects a non-loopback Host", async () => {
		const dir = repo();
		const { url } = ensureViewer(dir, dashboard());
		// Bun.serve rebuilds request.url from the Host header, so this is a DNS-rebinding request
		const response = await fetch(
			`${url}/api/records?dir=${encodeURIComponent(dir)}`,
			{ headers: { host: "attacker.tld:4447" } },
		);
		expect(response.status).toBe(403);
		expect(await response.text()).not.toContain("ses-1");
	});

	test("malformed percent-encoding is not found", async () => {
		const { url } = ensureViewer(repo(), dashboard());
		const response = await fetch(`${url}/%`);
		expect(response.status).toBe(404);
	});

	test("rejects directory traversal", async () => {
		const { url } = ensureViewer(repo(), dashboard());
		const response = await fetch(`${url}/%2e%2e/package.json`);
		expect(response.status).toBe(404);
	});

	test("viewerUrl points at the repo", () => {
		const dir = repo();
		const webDir = dashboard();
		expect(viewerUrl(dir, webDir)).toBe(
			`${ensureViewer(dir, webDir).url}/?dir=${encodeURIComponent(dir)}`,
		);
	});
});
