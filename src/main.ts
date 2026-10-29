import './styles/base.css';
import { mount } from 'svelte';
import App from './App.svelte';
import Gallery from './features/design/Gallery.svelte';
import { applySettings, loadSettings } from './lib/settings';

applySettings(loadSettings()); // before first paint: no light/dark flash
const Root = location.search.includes('gallery') ? Gallery : App; // ?gallery = component style guide
mount(Root, { target: document.getElementById('app')! });
