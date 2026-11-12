// What `node dist/hook.js totals` prints, kept in `$.state` for the footer and
// the details pane to draw. One declaration for both sides: src/summary.ts
// builds it, hooks/register.tsx reads it.
export type UsageSummary = {
	repo: { tokens: number; cost: number };
	/** This session's share. */
	session: { tokens: number; cost: number; turns: number };
	/** Most expensive models first, at most five. */
	models: Array<{ name: string; cost: number }>;
	/** Most called tools first, at most five. Raw names. */
	tools: Array<{ name: string; calls: number; errors: number }>;
};

/**
 * Whether the recorder can run: it is `node dist/hook.js`, so it needs Node.js
 * on the PATH. `unchecked` until the check at session start finishes.
 */
export type NodeStatus =
	| { state: "unchecked" }
	| { state: "ok" }
	| { state: "missing" }
	| { state: "outdated"; version: string };

declare module "claude-code" {
	interface PluginState {
		hashtrack: {
			// The latest totals; null until the first read finishes or when it failed
			summary: UsageSummary | null;
			// Whether Node.js is there to run the recorder
			node: NodeStatus;
		};
	}
}
