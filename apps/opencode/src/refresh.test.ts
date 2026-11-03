import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { REFRESH_MS, watchTurns } from "./refresh";

const start = () => {
	const handlers = new Map<string, () => void>();
	const stopped: string[] = [];
	const data = {
		on: (
			type: "session.idle" | "session.execution.succeeded",
			handler: () => void,
		) => {
			handlers.set(type, handler);
			return () => stopped.push(type);
		},
	};
	const refreshes = { count: 0 };
	const stop = watchTurns(data, () => refreshes.count++);
	return { handlers, stopped, refreshes, stop };
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("watchTurns", () => {
	test("refreshes when a turn ends and on the fallback timer", () => {
		const { handlers, refreshes, stop } = start();
		expect([...handlers.keys()]).toEqual([
			"session.idle",
			"session.execution.succeeded",
		]);

		handlers.get("session.idle")?.();
		handlers.get("session.execution.succeeded")?.();
		jest.advanceTimersByTime(REFRESH_MS);
		expect(refreshes.count).toBe(3);

		stop();
		jest.advanceTimersByTime(REFRESH_MS * 3);
		expect(refreshes.count).toBe(3);
	});

	test("unregisters both events when stopped", () => {
		const { stopped, stop } = start();
		stop();
		expect(stopped).toEqual(["session.idle", "session.execution.succeeded"]);
	});
});
