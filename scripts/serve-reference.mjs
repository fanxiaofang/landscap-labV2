// Read-only Vite host. All optimizer caches are in this independent experiment.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const source = process.env.LWM_SOURCE;
if (!source) throw new Error('Set LWM_SOURCE to a local Live With Me checkout before starting the reference host.');
const requireSource = createRequire(path.join(source, 'package.json'));
const { default: tailwindcss } = await import(pathToFileURL(requireSource.resolve('@tailwindcss/vite')).href);
const server = await createServer({
  configFile: false, root: source,
  cacheDir: path.resolve('.reference-cache'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': source } },
  server: { host: '127.0.0.1', port: 4178, strictPort: true },
});
await server.listen();
server.printUrls();
