import { mount } from 'svelte';
import '@/assets/app.css';
import App from './App.svelte';
import { getAdapter } from '@/lib/adapters';

const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
const hostname = tab.url ? new URL(tab.url).hostname : '';

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
