import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,

    // Enable source maps for production debugging
    sourcemap: mode === 'development',

    // Optimize dependencies
    commonjsOptions: {
      transformMixedEsModules: true,
    },

    rollupOptions: {
      output: {
        // Manual chunking for better code splitting
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            // React ecosystem
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }

            // UI Components
            if (id.includes('@radix-ui') || id.includes('cmdk') || id.includes('class-variance-authority')) {
              return 'ui-vendor';
            }

            // Form and validation
            if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) {
              return 'form-vendor';
            }

            // Data visualization
            if (id.includes('recharts') || id.includes('d3')) {
              return 'charts-vendor';
            }

            // Date utilities
            if (id.includes('date-fns')) {
              return 'date-vendor';
            }

            // PDF and Excel
            if (id.includes('jspdf') || id.includes('xlsx')) {
              return 'document-vendor';
            }

            // State management and data fetching
            if (id.includes('@tanstack/react-query')) {
              return 'data-vendor';
            }

            // Other utilities
            if (id.includes('lodash')) {
              return 'utils-vendor';
            }

            // Everything else in node_modules
            return 'vendor';
          }

          // Application chunks
          if (id.includes('src/pages')) {
            const match = id.match(/src\/pages\/(\w+)/);
            if (match) {
              return `page-${match[1].toLowerCase()}`;
            }
          }

          if (id.includes('src/components')) {
            // Group large component directories
            if (id.includes('components/dashboard')) return 'comp-dashboard';
            if (id.includes('components/students')) return 'comp-students';
            if (id.includes('components/teachers')) return 'comp-teachers';
            if (id.includes('components/payments')) return 'comp-payments';
            if (id.includes('components/ui')) return 'comp-ui';
            if (id.includes('components/forms')) return 'comp-forms';
            return 'comp-misc';
          }

          if (id.includes('src/hooks')) {
            return 'hooks';
          }

          if (id.includes('src/utils') || id.includes('src/lib')) {
            return 'utils';
          }

          if (id.includes('src/contexts')) {
            return 'contexts';
          }
        },

        // Optimize chunk names
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : '';
          const name = chunkInfo.name || facadeModuleId || 'chunk';
          return `assets/${name}-[hash].js`;
        },

        // Optimize entry file names
        entryFileNames: 'assets/[name]-[hash].js',

        // Optimize asset file names
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name?.split('.').pop() || '';
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/woff2?|ttf|otf|eot/i.test(extType)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },

    // Optimize CSS
    cssCodeSplit: true,

    // Minification options
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
        pure_funcs: mode === 'production' ? ['console.log', 'console.info'] : [],
      },
      format: {
        comments: false,
      },
    },
  },

  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'date-fns',
      'lodash',
    ],
    exclude: ['@capacitor/android', '@capacitor/ios'],
  },
}));