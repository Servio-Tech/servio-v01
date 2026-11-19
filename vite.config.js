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
          if (id.includes('node_modules')) {
            if (id.includes('/docx/')) {
              return 'report-docx';
            }
            if (id.includes('/write-excel-file/')) {
              return 'report-xlsx';
            }
            if (id.includes('@mui/x-charts') || id.includes('@mui/x-date-pickers')) {
              return 'charts';
            }
            if (id.includes('@mui') || id.includes('@emotion')) {
              return 'mui';
            }
            if (id.includes('@supabase')) {
              return 'supabase';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});
