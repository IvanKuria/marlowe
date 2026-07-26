import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

const target = document.getElementById('app');
if (!target) throw new Error('The Study could not find its mount point.');

export default mount(App, { target });
