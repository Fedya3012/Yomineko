import '@fontsource/be-vietnam-pro/vietnamese-500.css';
import '@fontsource/be-vietnam-pro/vietnamese-800.css';
import '@fontsource/be-vietnam-pro/latin-500.css';
import '@fontsource/be-vietnam-pro/latin-800.css';
import '@fontsource/dela-gothic-one/400.css';
import '@fontsource/dm-mono/latin-500.css';
import '@fontsource/zen-maru-gothic/500.css';
import '@fontsource/zen-maru-gothic/700.css';
import '@fontsource/noto-sans-jp/japanese-500.css';
import '@fontsource/noto-serif-jp/japanese-500.css';
import './styles/base.css';
import { mount } from 'svelte';
import App from './App.svelte';
import Gallery from './features/design/Gallery.svelte';
import { applySettings, loadSettings } from './lib/settings';

applySettings(loadSettings()); // before first paint: no light/dark flash
const Root = location.search.includes('gallery') ? Gallery : App; // ?gallery = component style guide
mount(Root, { target: document.getElementById('app')! });
