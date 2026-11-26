import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, '/');
          if (!moduleId.includes('/node_modules/')) return undefined;
          if (moduleId.includes('/@mui/x-charts/') || moduleId.includes('/@mui/x-date-pickers/')) return 'charts';
          if (moduleId.includes('/@mui/icons-material/')) return 'mui-icons';
          if (moduleId.includes('/@mui/') || moduleId.includes('/@emotion/')) return 'mui';
          if (moduleId.includes('/@supabase/')) return 'supabase';
          if (
            moduleId.includes('/react/') ||
            moduleId.includes('/react-dom/') ||
            moduleId.includes('/react-router-dom/')
          ) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
});