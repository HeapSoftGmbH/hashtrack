import { compactNumberFormatter, dollarNumberFormatter } from "lib";

/** The totals without the brand mark, for UIs that draw the favicon themselves. */
export function witnessText(tokens: number, cost: number): string {
	return `${compactNumberFormatter.format(tokens)} · ${dollarNumberFormatter.format(cost)}`;
}
