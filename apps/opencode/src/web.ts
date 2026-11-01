import { existsSync } from "node:fs";
import { join, sep } from "node:path";
import { type CloudConfig, resolveRepoRecords } from "@hashtrack/core";
import type { Server } from "bun";

const PORT = 4447;

/** Only a loopback page may reach the viewer; anything else is a DNS-rebinding attempt. */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

export interface ViewerOptions {
	/** Dashboard build to serve; tests and bundles can resolve it themselves. */
	webDir?: string;
	/** Cloud config from the adapter; when set, records come from the server. */
	cloud?: CloudConfig;
}

interface Viewer {
	server: Server<undefined>;
	url: string;
	directory: string;
	webDir: string;
	cloud?: CloudConfig;
}

let viewer: Viewer | undefined;

/** Locate the built dashboard: bundled `web/` first, then the local-web build in the repo. */
export function findWebDir(here = import.meta.dir): string | undefined {
	const candidates = [
		join(here, "..", "web"),
		join(here, "local-web"),
		join(here, "..", "..", "..", "packages", "local-web", "dist"),
		join(here, "..", "..", "..", "..", "packages", "local-web", "dist"),
	];
	return candidates.find((dir) => existsSync(join(dir, "index.html")));
}

function handler(webDir: string) {
	return async (request: Request): Promise<Response> => {
		const url = new URL(request.url);
		if (!LOOPBACK_HOSTS.has(url.hostname)) {
			return new Response("forbidden", { status: 403 });
		}

		if (url.pathname === "/api/records") {
			const directory = url.searchParams.get("dir") ?? viewer?.directory;
			try {
				const { records, source } = await resolveRepoRecords({
					cwd: directory ?? undefined,
					cloud: viewer?.cloud,
				});
				return Response.json(records, {
					headers: { "x-hashtrack-source": source },
				});
			} catch {
				return Response.json([]);
			}
		}

		let file: string;
		try {
			const relative =
				url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname);
			file = join(webDir, relative);
		} catch {
			return new Response("not found", { status: 404 }); // malformed percent-encoding
		}
		if (!file.startsWith(`${webDir}${sep}`) || !existsSync(file)) {
			return new Response("not found", { status: 404 });
		}

		return new Response(Bun.file(file));
	};
}

/**
 * Serve the dashboard for a repository, starting the viewer on first use.
 * One local server is shared by every repository; `/api/records?dir=` picks the repo.
 * `options.webDir` is for tests and bundles that resolve the build themselves;
 * `options.cloud` makes `/api/records` read from the hashtrack server.
 */
export function ensureViewer(
	directory: string,
	options: ViewerOptions = {},
): Viewer {
	const cloud = options.cloud;
	if (viewer) {
		viewer.directory = directory;
		viewer.cloud = cloud ?? viewer.cloud;
		return viewer;
	}

	const resolvedWebDir = options.webDir ?? findWebDir();
	if (!resolvedWebDir) {
		throw new Error(
			"hashtrack: dashboard build not found (run `bun run build:web` in apps/opencode)",
		);
	}

	let server: Server<undefined>;
	try {
		server = Bun.serve({
			hostname: "127.0.0.1",
			port: PORT,
			fetch: handler(resolvedWebDir),
		});
	} catch {
		// another instance already owns the fixed port
		server = Bun.serve({
			hostname: "127.0.0.1",
			port: 0,
			fetch: handler(resolvedWebDir),
		});
	}

	viewer = {
		server,
		url: server.url.origin,
		directory,
		webDir: resolvedWebDir,
		cloud,
	};
	return viewer;
}

export function viewerUrl(
	directory: string,
	options: ViewerOptions = {},
): string {
	const { url } = ensureViewer(directory, options);
	return `${url}/?dir=${encodeURIComponent(directory)}`;
}

export function closeViewer(): void {
	viewer?.server.stop(true);
	viewer = undefined;
}

/** Open a URL in the platform's default browser (TUI side; the GUI uses ctx.system.openExternal). */
export function openInBrowser(url: string): void {
	const command =
		process.platform === "darwin"
			? ["open", url]
			: process.platform === "win32"
				? ["cmd", "/c", "start", "", url]
				: ["xdg-open", url];

	Bun.spawn(command, { stdio: ["ignore", "ignore", "ignore"] });
}
