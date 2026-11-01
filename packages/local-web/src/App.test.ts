import { mount } from 'svelte';
import { describe, expect, test, vi } from 'vitest';

import App from './App.svelte';

vi.stubGlobal(
	'fetch',
	vi.fn(async () => ({ json: async () => [] }))
);

describe('App', () => {
	test('renders header, tabs and dashboard records view', async () => {
		const target = document.createElement('div');
		mount(App, { target });
		await new Promise((r) => setTimeout(r, 0));
		const text = target.textContent ?? '';
		expect(target.querySelector('h1')?.textContent).toBe('Hashtrack');
		expect(text).toContain('Dashboard');
		expect(text).toContain('Sessions');
		expect(text).toContain('Cost');
		expect(text).toContain('local repository');
		expect(text).toContain('Unknown');
	});
});
