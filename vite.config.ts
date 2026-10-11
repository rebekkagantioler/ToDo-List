import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()], define: { __APP_BUILD__: JSON.stringify(new Date().toISOString()) }, base: process.env.GITHUB_PAGES === 'true' ? './' : '/', server: { port: 5173, proxy: { '/api': 'http://localhost:3001' } }, preview: { proxy: { '/api': 'http://localhost:3001' } } });
