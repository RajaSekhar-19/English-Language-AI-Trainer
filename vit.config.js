import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load .env file variables
  const env = loadEnv(mode, process.cwd(), ''); // Use process.cwd() for root, '' prefix to load all vars

  return {
    plugins: [react()],
    define: {
      // This makes process.env.API_KEY available in your client-side code
      // It will take the value from API_KEY_FROM_DOTENV in your .env file
      'process.env.API_KEY': JSON.stringify(env.API_KEY_FROM_DOTENV)
    },
    server: {
      port: 3000, // You can change the port if needed
      open: true    // Automatically opens the app in your browser
    }
  };
});