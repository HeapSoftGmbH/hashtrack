// Brand constants and number formats for the UI module. It runs in Claude
// Code's UI engine and cannot import the workspace packages, so these copy
// packages/lib (and the local-web favicon); src/brand.spec.ts fails when a
// copy drifts. No imports here: the module and the Node side both load it.

/** packages/lib `hashtrackMark`. */
export const MARK = "⣏";

/** packages/lib `hashtrackColor`. */
export const MARK_COLOR = "#bb4d00";

/** packages/local-web/public/favicon.svg, for the pane on graphical surfaces. */
export const FAVICON =
	'<svg width="145" height="145" viewBox="0 0 145 145" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M64.3743 20.675H69.5431V41.3499H72.8323V62.0249H78.001V82.6999H72.8323V103.375H69.5431V124.05H64.3743V144.725H0V0H64.3743V20.675ZM93.5072 103.375H88.3385V124.05H85.0493V144.725H70.4828V124.05H78.9408V103.375H87.3987V82.6999H93.5072V103.375ZM109.013 124.05H103.845V144.725H94.447V124.05H102.905V103.375H109.013V124.05ZM124.52 144.725H118.411V124.05H124.52V144.725ZM144.725 144.725H142.375V124.05H144.725V144.725ZM129.688 124.05H126.869V103.375H129.688V124.05ZM33.3619 62.0249H38.5306V82.6999H33.3619V103.375H39.4704V82.6999H47.9283V62.0249H39.4704V41.3499H33.3619V62.0249ZM113.712 103.375H111.363V82.6999H113.712V103.375ZM17.8557 82.6999H23.9642V62.0249H17.8557V82.6999ZM98.2061 82.6999H95.8566V62.0249H98.2061V82.6999ZM48.8681 41.3499H54.0368V62.0249H57.326V82.6999H54.0368V103.375H48.8681V124.05H54.9766V103.375H63.4345V82.6999H71.8925V62.0249H63.4345V41.3499H54.9766V20.675H48.8681V41.3499ZM85.0493 20.675H88.3385V41.3499H93.5072V62.0249H87.3987V41.3499H78.9408V20.675H70.4828V0H85.0493V20.675ZM113.712 62.0249H111.363V41.3499H113.712V62.0249ZM103.845 20.675H109.013V41.3499H102.905V20.675H94.447V0H103.845V20.675ZM129.688 41.3499H126.869V20.675H129.688V41.3499ZM124.52 20.675H118.411V0H124.52V20.675ZM144.725 20.675H142.375V0H144.725V20.675Z" fill="#bb4d00"/></svg>';

/** packages/lib `compactNumberFormatter`. */
export const compact = new Intl.NumberFormat("en", { notation: "compact" });

/** packages/lib `dollarNumberFormatter`. */
export const dollars = new Intl.NumberFormat("en", {
	style: "currency",
	currency: "USD",
});

/** "1.2M tokens · $3.40 in this repo", the repo total wherever it is shown. */
export function repoLabel(tokens: number, cost: number): string {
	return `${compact.format(tokens)} tokens · ${dollars.format(cost)} in this repo`;
}
