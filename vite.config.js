import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const base = process.env.VITE_PUBLIC_BASE_PATH || '/YanStoryBox/';

export default defineConfig({
  base,
  plugins: [react()],
});
