import { spawn } from "node:child_process";
import { join } from "node:path";
import { repoRoot, repoTally } from "@hashtrack/core";
import { type Action, type HookInput, runHook, stateDir } from "./hook";
import { usageSummary } from "./summary";

const ACTIONS: Action[] = ["start", "stop", "subagent-stop", "end", "sync"];

async function readStdin(): Promise<string> {
	if (process.stdin.isTTY) return "";
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
	// Not a hook: the UI module (hooks/register.tsx) runs
	// `node dist/hook.js totals [session-id]` in the session's directory and
	// draws the JSON it prints.
	if (process.argv[2] === "totals") {
		const summary = usageSummary(
			repoTally(repoRoot(process.cwd()), join(stateDir(), "totals")),
			process.argv[3],
		);
		process.stdout.write(JSON.stringify(summary));
		return;
	}

	const action = process.argv[2] as Action;
	if (!ACTIONS.includes(action)) return;

	let input: HookInput = {};
	if (action === "sync") {
		input = { cwd: process.argv[3] };
	} else {
		try {
			input = JSON.parse(await readStdin());
		} catch {
			return;
		}
	}

	const result = await runHook(action, input);
	if (result.output) process.stdout.write(JSON.stringify(result.output));

	if (result.upload && process.argv[1]) {
		// upload outside the hook: detached, so neither the prompt nor a `claude -p`
		// teardown waits for (or kills) the network request
		spawn(
			process.execPath,
			[process.argv[1], "sync", input.cwd ?? process.cwd()],
			{ detached: true, stdio: "ignore" },
		).unref();
	}
}

// tracking must never break the user's session: swallow everything, exit 0
main().catch(() => {});
