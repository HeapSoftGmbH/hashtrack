/**
 * Claude Code transcripts carry token counts but no cost, so the adapter prices
 * each message itself. Prices are USD per million tokens, Anthropic first-party
 * API rates. Bedrock/Vertex pricing differs; subscription plans are not billed
 * per token at all — the figure is the API-equivalent cost either way.
 */
interface Price {
	in: number;
	out: number;
	cr: number; // cache read
}

// Longest prefix wins, so `claude-opus-4-1` beats `claude-opus-4`.
const PRICES: Record<string, Price> = {
	"claude-fable-5-2": { in: 8, out: 40, cr: 0.2 },
	"claude-mythos-5-2": { in: 8, out: 40, cr: 0.2 },
	"claude-fable-5-1": { in: 10, out: 50, cr: 0.25 },
	"claude-mythos-5-1": { in: 10, out: 50, cr: 0.25 },
	"claude-fable-5": { in: 10, out: 50, cr: 1 },
	"claude-mythos-5": { in: 10, out: 50, cr: 1 },
	"claude-opus-5-5": { in: 4, out: 20, cr: 0.2 },
	"claude-opus-5": { in: 5, out: 25, cr: 0.5 },
	"claude-opus-4-8": { in: 5, out: 25, cr: 0.5 },
	"claude-opus-4-7": { in: 5, out: 25, cr: 0.5 },
	"claude-opus-4-6": { in: 5, out: 25, cr: 0.5 },
	"claude-opus-4-5": { in: 5, out: 25, cr: 0.5 },
	"claude-opus-4-1": { in: 15, out: 75, cr: 1.5 },
	"claude-opus-4": { in: 15, out: 75, cr: 1.5 },
	"claude-sonnet-5-5": { in: 2, out: 10, cr: 0.1 },
	"claude-sonnet-5": { in: 2, out: 10, cr: 0.2 },
	"claude-sonnet-4": { in: 3, out: 15, cr: 0.3 },
	"claude-haiku-5-5": { in: 0.1, out: 0.5, cr: 0.01 },
	"claude-haiku-4-5": { in: 1, out: 5, cr: 0.1 },
	"claude-3-7-sonnet": { in: 3, out: 15, cr: 0.3 },
	"claude-3-5-sonnet": { in: 3, out: 15, cr: 0.3 },
	"claude-3-5-haiku": { in: 0.8, out: 4, cr: 0.08 },
	"claude-3-opus": { in: 15, out: 75, cr: 1.5 },
	"claude-3-sonnet": { in: 3, out: 15, cr: 0.3 },
	"claude-3-haiku": { in: 0.25, out: 1.25, cr: 0.03 },
};

const PREFIXES = Object.keys(PRICES).sort((a, b) => b.length - a.length);

export interface MessageUsage {
	input_tokens?: number;
	output_tokens?: number;
	cache_creation_input_tokens?: number;
	cache_read_input_tokens?: number;
	cache_creation?: {
		ephemeral_5m_input_tokens?: number;
		ephemeral_1h_input_tokens?: number;
	};
	output_tokens_details?: { thinking_tokens?: number };
	speed?: string;
}

/** Strip provider prefixes and suffixes Claude Code may add, e.g. `us.anthropic.` or `[1m]`. */
function normalize(model: string): string {
	const bare = model.replace(/\[.*\]$/, "").toLowerCase();
	const i = bare.indexOf("claude-");
	return i >= 0 ? bare.slice(i) : bare;
}

function priceFor(model: string): Price | undefined {
	const id = normalize(model);
	const prefix = PREFIXES.find((p) => id.startsWith(p));
	return prefix ? PRICES[prefix] : undefined;
}

/** Cost in USD for one assistant message, or 0 for an unknown model. */
export function messageCost(model: string, usage: MessageUsage): number {
	const price = priceFor(model);
	if (!price) return 0;

	const write = usage.cache_creation_input_tokens || 0;
	const write1h = Math.min(
		usage.cache_creation?.ephemeral_1h_input_tokens || 0,
		write,
	);
	const write5m = write - write1h;

	const perMillion =
		(usage.input_tokens || 0) * price.in +
		(usage.output_tokens || 0) * price.out +
		(usage.cache_read_input_tokens || 0) * price.cr +
		write5m * price.in * 1.25 +
		write1h * price.in * 2;

	// fast mode bills at a premium (2x on the models that offer it)
	const speed = usage.speed === "fast" ? 2 : 1;
	return (perMillion / 1_000_000) * speed;
}
