import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// YY手帳 管理後台(獨立網站,只給電腦使用)
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
