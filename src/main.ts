import './styles/base.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { applySettings, loadSettings } from './lib/settings';

applySettings(loadSettings()); // before first paint: no light/dark flash
mount(App, { target: document.getElementById('app')! });
