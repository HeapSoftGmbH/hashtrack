import { chmodSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { Plugin } from "@opencode/plugin";
import { type CloudConfig, Session, type Tool, type Usage } from "witness";
import { Witness } from "./rpc";
import { repoStats } from "./stats";
import { closeViewer, viewerUrl } from "./web";

function readCloudConfig(): CloudConfig | undefined {
	const file = join(
		process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
		"opencode",
		"witness",
		"config.json",
	);

	let cfg: { token?: unknown; url?: unknown };
	try {
		cfg = JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return undefined;
	}

	if (typeof cfg.token !== "string") return undefined;

	try {
		chmodSync(file, 0o600);
	} catch {
		// best effort: a read-only config file still works, it just stays world-readable
	}

	return {
		token: cfg.token,
		...(typeof cfg.url === "string" ? { url: cfg.url } : {}),
	};
}

function scopeDirectory(input: unknown): string | undefined {
	if (input && typeof input === "object" && "directory" in input) {
		const directory = (input as { directory?: unknown }).directory;
		if (typeof directory === "string" && directory) return directory;
	}
	return undefined;
}

interface Tokens {
	input: number;
	output: number;
	reasoning: number;
	cache: { read: number; write: number };
}

function toUsage(tokens: Tokens | undefined, cost: number | undefined): Usage {
	const t = tokens ?? {
		input: 0,
		output: 0,
		reasoning: 0,
		cache: { read: 0, write: 0 },
	};
	return {
		in: t.input,
		out: t.output,
		cw: t.cache.write,
		cr: t.cache.read,
		tok: t.input + t.output + t.reasoning + t.cache.read + t.cache.write,
		reason: t.reasoning,
		cst: cost ?? 0,
	};
}

interface Run {
	active: boolean;
	turnIndex: number;
}

export default Plugin.define({
	id: "witness",
	async setup(ctx) {
		await ctx.rpc.register(Witness, {
			stats: async (input) =>
				repoStats(scopeDirectory(input) ?? ctx.location.directory),
			web: async (input) => ({
				url: viewerUrl(scopeDirectory(input) ?? ctx.location.directory),
			}),
		});

		const cloud = readCloudConfig();
		const instanceDirectory = normalize(ctx.location.directory);
		let version: string | undefined;

		// A plugin instance is loaded per location and the event stream is server-wide,
		// so events of sessions in other locations belong to another instance: ignore them.
		const sessions = new Map<string, Session>();
		const sessionDirectories = new Map<string, string>();
		const synced = new Set<string>();
		const names = new Map<string, string>();
		const sessionModels = new Map<string, string>();
		const runs = new Map<string, Run>();
		const seenSteps = new Map<string, Set<string>>();
		const seenTools = new Map<string, Set<string>>();
		const seenSkills = new Map<string, Set<string>>();
		const started = new Map<string, number>();
		const models = new Map<string, string>();
		const toolsByMessage = new Map<string, Tool[]>();
		const callNames = new Map<string, string>();

		function normalize(directory: string): string {
			const absolute = resolve(directory);
			return process.platform === "win32" ? absolute.toLowerCase() : absolute;
		}

		function isOurLocation(directory: string | undefined): boolean {
			return !directory || normalize(directory) === instanceDirectory;
		}

		/** The session's directory: the event's location wins, then what `session.created` reported. */
		function eventDirectory(
			sessionID: string,
			location: string | undefined,
		): string | undefined {
			return location ?? sessionDirectories.get(sessionID);
		}

		function messageKey(sessionID: string, messageID: string): string {
			return `${sessionID}:${messageID}`;
		}

		function callKey(
			sessionID: string,
			messageID: string,
			callID: string,
		): string {
			return `${sessionID}:${messageID}:${callID}`;
		}

		function setFor(
			map: Map<string, Set<string>>,
			sessionID: string,
		): Set<string> {
			let set = map.get(sessionID);
			if (!set) {
				set = new Set();
				map.set(sessionID, set);
			}
			return set;
		}

		/** Drop per-message entries that an unfinished step left behind. */
		function pruneMessages(sessionID: string): void {
			const prefix = `${sessionID}:`;
			for (const key of [...started.keys()])
				if (key.startsWith(prefix)) started.delete(key);
			for (const key of [...models.keys()])
				if (key.startsWith(prefix)) models.delete(key);
			for (const key of [...toolsByMessage.keys()])
				if (key.startsWith(prefix)) toolsByMessage.delete(key);
			for (const key of [...callNames.keys()])
				if (key.startsWith(prefix)) callNames.delete(key);
		}

		/** Flush buffered turns, then forget everything about a session. */
		async function forget(
			sessionID: string,
			{ keepDirectory = false } = {},
		): Promise<void> {
			const session = sessions.get(sessionID);
			const directory = sessionDirectories.get(sessionID);
			sessions.delete(sessionID);
			sessionDirectories.delete(sessionID);
			runs.delete(sessionID);
			names.delete(sessionID);
			sessionModels.delete(sessionID);
			seenSteps.delete(sessionID);
			seenTools.delete(sessionID);
			seenSkills.delete(sessionID);
			pruneMessages(sessionID);
			// still classify later events of a session that moved to another location
			if (keepDirectory && directory)
				sessionDirectories.set(sessionID, directory);
			await session?.flush();
		}

		async function ensure(sessionID: string): Promise<Session> {
			const directory =
				sessionDirectories.get(sessionID) ?? ctx.location.directory;
			let session = sessions.get(sessionID);
			if (!session) {
				session = new Session({
					sessionId: sessionID,
					harness: "opencode",
					harnessVersion: version,
					cloud,
					cwd: directory,
				});
				// a session switch drops the object, not the title: remember it per id
				session.sessionName = names.get(sessionID) ?? "";
				sessions.set(sessionID, session);
			}
			// sync once per repository, not once per plugin lifetime
			const key = normalize(directory);
			if (!synced.has(key)) {
				synced.add(key);
				await session.syncPending();
			}
			return session;
		}

		function runFor(sessionID: string): Run {
			let run = runs.get(sessionID);
			if (!run) {
				run = { active: false, turnIndex: 0 };
				runs.set(sessionID, run);
			}
			return run;
		}

		async function onTool(
			sessionID: string,
			location: string | undefined,
			messageID: string,
			callID: string,
			isError: boolean,
		): Promise<void> {
			if (!isOurLocation(eventDirectory(sessionID, location))) return;
			const seen = setFor(seenTools, sessionID);
			const key = `${messageID}:${callID}`;
			// tool results often repeat; one entry per tool call
			if (seen.has(key)) return;
			seen.add(key);

			await ensure(sessionID);
			const keyOfCall = callKey(sessionID, messageID, callID);
			const name = callNames.get(keyOfCall) ?? "unknown";
			callNames.delete(keyOfCall);

			const message = messageKey(sessionID, messageID);
			const tools = toolsByMessage.get(message) ?? [];
			tools.push({ name, isError });
			toolsByMessage.set(message, tools);
		}

		async function onStep(
			sessionID: string,
			location: string | undefined,
			messageID: string,
			tokens: Tokens | undefined,
			cost: number | undefined,
			at: number,
		): Promise<void> {
			if (!isOurLocation(eventDirectory(sessionID, location))) return;
			const seen = setFor(seenSteps, sessionID);
			// a failed step may report before its end event; one turn per assistant message
			if (seen.has(messageID)) return;
			seen.add(messageID);

			const session = await ensure(sessionID);
			const message = messageKey(sessionID, messageID);
			const model =
				models.get(message) ?? sessionModels.get(sessionID) ?? "unknown";
			const run = runFor(sessionID);
			if (!run.active) {
				session.startAgent({
					dateTimeISOString: new Date(at).toISOString(),
					model,
				});
				run.active = true;
				run.turnIndex = 0;
			}

			session.addTurn({
				index: run.turnIndex++,
				tools: toolsByMessage.get(message) ?? [],
				totalUsage: toUsage(tokens, cost),
			});
			toolsByMessage.delete(message);
			models.delete(message);
			started.delete(message);
		}

		const controller = new AbortController();
		void (async () => {
			try {
				for await (const event of ctx.event.subscribe({
					types: [
						"session.created",
						"session.renamed",
						"session.moved",
						"session.deleted",
						"session.execution.started",
						"session.step.started",
						"session.step.ended",
						"session.step.failed",
						"session.tool.input.started",
						"session.tool.success",
						"session.tool.failed",
						"session.skill.activated",
						"session.idle",
						"installation.updated",
					],
					signal: controller.signal,
				})) {
					try {
						switch (event.type) {
							case "installation.updated":
								version = event.data.version;
								break;
							case "session.created": {
								const {
									sessionID,
									title,
									slug,
									version: v,
									model,
									location,
								} = event.data;
								const directory =
									location?.directory ?? event.location?.directory;
								if (directory) sessionDirectories.set(sessionID, directory);
								const name = title ?? slug;
								version = v;
								if (name) names.set(sessionID, name);
								if (model)
									sessionModels.set(
										sessionID,
										`${model.providerID}/${model.id}`,
									);
								// another location's instance records that session
								if (!isOurLocation(directory)) break;
								const session = await ensure(sessionID);
								if (name) session.sessionName = name;
								break;
							}
							case "session.renamed": {
								const { sessionID, title } = event.data;
								// titles are metadata: remember them even for another location,
								// a session can move into this one later
								names.set(sessionID, title);
								const session = sessions.get(sessionID);
								if (session) session.sessionName = title;
								break;
							}
							case "session.moved": {
								const { sessionID, location } = event.data;
								sessionDirectories.set(sessionID, location.directory);
								// it now belongs to another instance: flush what it did here
								if (
									!isOurLocation(location.directory) &&
									sessions.has(sessionID)
								)
									await forget(sessionID, { keepDirectory: true });
								break;
							}
							case "session.deleted":
								await forget(event.data.sessionID);
								break;
							case "session.execution.started": {
								const { sessionID } = event.data;
								if (
									!isOurLocation(
										eventDirectory(sessionID, event.location?.directory),
									)
								)
									break;
								const run = runs.get(sessionID);
								// a new run starts a new record even if the old one never went idle
								if (run?.active) await sessions.get(sessionID)?.flush();
								runs.set(sessionID, { active: false, turnIndex: 0 });
								break;
							}
							case "session.step.started": {
								const {
									sessionID,
									assistantMessageID,
									model,
									started: at,
								} = event.data;
								if (
									!isOurLocation(
										eventDirectory(sessionID, event.location?.directory),
									)
								)
									break;
								const message = messageKey(sessionID, assistantMessageID);
								models.set(message, `${model.providerID}/${model.id}`);
								started.set(message, at);
								break;
							}
							case "session.tool.input.started": {
								const { sessionID, assistantMessageID, id, name } = event.data;
								if (
									!isOurLocation(
										eventDirectory(sessionID, event.location?.directory),
									)
								)
									break;
								callNames.set(callKey(sessionID, assistantMessageID, id), name);
								break;
							}
							case "session.tool.success":
							case "session.tool.failed": {
								const { sessionID, assistantMessageID, id } = event.data;
								await onTool(
									sessionID,
									event.location?.directory,
									assistantMessageID,
									id,
									event.type === "session.tool.failed",
								);
								break;
							}
							case "session.step.ended":
							case "session.step.failed": {
								const { sessionID, assistantMessageID, tokens, cost } =
									event.data;
								await onStep(
									sessionID,
									event.location?.directory,
									assistantMessageID,
									tokens,
									cost,
									started.get(messageKey(sessionID, assistantMessageID)) ??
										event.created,
								);
								break;
							}
							case "session.skill.activated": {
								const { sessionID, name } = event.data;
								if (
									!isOurLocation(
										eventDirectory(sessionID, event.location?.directory),
									)
								)
									break;
								const seen = setFor(seenSkills, sessionID);
								if (seen.has(name)) break;
								seen.add(name);
								const session = await ensure(sessionID);
								session.addSkill(name);
								break;
							}
							case "session.idle": {
								const { sessionID } = event.data;
								// titles live on the Session object while it is active
								names.delete(sessionID);
								sessionModels.delete(sessionID);
								const session = sessions.get(sessionID);
								if (!session) break;
								await session.flush();
								runs.delete(sessionID);
								seenSteps.delete(sessionID);
								seenTools.delete(sessionID);
								pruneMessages(sessionID);
								break;
							}
						}
					} catch (error) {
						console.error(`witness: failed to handle ${event.type}`, error);
					}
				}
			} catch (error) {
				if (!controller.signal.aborted)
					console.error("witness: opencode event stream failed", error);
			}
		})();

		return async () => {
			controller.abort();
			await Promise.all(
				[...sessions.values()].map((session) => session.flush()),
			);
			closeViewer();
		};
	},
});
