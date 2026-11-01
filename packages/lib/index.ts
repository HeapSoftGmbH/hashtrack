/**
 * The hashtrack favicon as a braille cell: the solid left side with the stepped,
 * dashed right edge. Terminal status lines cannot show the SVG; Desktop UIs
 * draw the favicon itself.
 */
export const hashtrackMark = "⣏";

/** The favicon orange, for the mark in UIs that can color it. */
export const hashtrackColor = "#bb4d00";

/** The same orange as {@link hashtrackColor}, for APIs that take RGB channels (e.g. pi-tui). */
export const hashtrackColorRgb = {
	r: Number.parseInt(hashtrackColor.slice(1, 3), 16),
	g: Number.parseInt(hashtrackColor.slice(3, 5), 16),
	b: Number.parseInt(hashtrackColor.slice(5, 7), 16),
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
