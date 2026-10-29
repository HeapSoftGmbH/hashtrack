/**
 * The witness favicon as a braille cell: the solid left side with the stepped,
 * dashed right edge. Terminal status lines cannot show the SVG; Desktop UIs
 * draw the favicon itself.
 */
export const witnessMark = "⣏";

/** The favicon orange, for the mark in UIs that can color it. */
export const witnessColor = "#bb4d00";

/** The same orange as {@link witnessColor}, for APIs that take RGB channels (e.g. pi-tui). */
export const witnessColorRgb = {
	r: Number.parseInt(witnessColor.slice(1, 3), 16),
	g: Number.parseInt(witnessColor.slice(3, 5), 16),
	b: Number.parseInt(witnessColor.slice(5, 7), 16),
} as const;

/**
 * Formatter for Numbers, compact format. E.g. 400, 4K, 4M etc.
 */
export const compactNumberFormatter = new Intl.NumberFormat("en", {
	notation: "compact",
});

/**
 * Formatter for Numbers as Dollar with two fraction digits. E.g. $400, $4 etc.
 */
export const dollarNumberFormatter = new Intl.NumberFormat("en", {
	style: "currency",
	currency: "USD",
});

/**
 * Formatter for Numbers as Dollar with four fraction digits. E.g. $400, $4 etc.
 */
export const dollarNumberFormatterWith4Fracts = new Intl.NumberFormat("en", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 4,
});
