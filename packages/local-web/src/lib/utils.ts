export { cn } from 'cn';

export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, 'child'> : T;
export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
	ref?: U | null;
};

/**
 * ISO day (UTC, "YYYY-MM-DD") `n` days before today; `n = 0` → today.
 */
export function isoDateNDaysAgo(n: number): string {
	return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Extract model from the <provider>/<model> string
 * @param providerModel String provided by the hashtrack tracking, format is <provider>/<model>
 * @returns returns the model from the string
 */
export function getModelFromSourceString(providerModel: string): string {
	return providerModel.split('/').pop() ?? providerModel;
}

/**
 * Extract provider from the <provider>/<model> string
 * @param providerModel String provided by the hashtrack tracking, format is <provider>/<model>
 * @returns returns the provdier from the string
 */
export function getProviderFromSourceString(providerModel: string): string {
	return providerModel.split('/')[0] ?? '';
}

/**
 * Repo name from a git remote URL (https or git@ssh form).
 * Falls back to the raw string, or a placeholder when there is no remote.
 */
export function getRepoName(remote: string | undefined | null): string {
	const clean = (remote ?? '')
		.replace(/^[^/]+@[^:]+:/, '') // git@github.com:owner/repo
		.replace(/^https?:\/\/[^/]+\//, '') // https://github.com/owner/repo
		.replace(/\.git$/, '');
	return clean || 'local repository';
}

/**
 * Web URL for a git remote (https or git@ssh form), or null when there is no remote.
 * Normalizes to https and drops .git / auth suffix.
 */
export function getRepoUrl(remote: string | undefined | null): string | null {
	const s = (remote ?? '').trim();
	let m = s.match(/^[^@/\s]+@([^:]+):(.+)$/); // git@github.com:owner/repo
	if (!m) m = s.match(/^(?:https?|ssh|git):\/\/(?:[^@/]+@)?([^/]+)\/(.+)$/); // https://github.com/owner/repo
	if (!m) return null; // local path (no remote)
	return `https://${m[1]}/${m[2].replace(/\.git$/, '')}`;
}
