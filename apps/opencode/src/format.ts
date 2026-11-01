import { compactNumberFormatter, dollarNumberFormatter } from "@hashtrack/lib";

/** The totals without the brand mark, for UIs that draw the favicon themselves. */
export function hashtrackText(tokens: number, cost: number): string {
	return `${compactNumberFormatter.format(tokens)} · ${dollarNumberFormatter.format(cost)}`;
}
