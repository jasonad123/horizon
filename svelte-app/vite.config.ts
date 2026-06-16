import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],

	build: {
		chunkSizeWarningLimit: 600,
		sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true
	},

	server: {
		host: process.env.VITE_HOST || '0.0.0.0',
		fs: { allow: ['..'] },
		proxy: {
			'/api': {
				target: process.env.VITE_API_PROXY || 'http://localhost:8080',
				changeOrigin: true
			}
		}
	}
});
