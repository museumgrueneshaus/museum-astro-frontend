import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  vite: {
    server: {
      proxy: {
        // Simuliert den nginx-Proxy vom Pi lokal im Dev-Server
        // → /website-proxy/ leitet auf die echte Museum-Website weiter
        '/website-proxy': {
          target: 'https://www.museum-reutte.at',
          changeOrigin: true,
          selfHandleResponse: true,
          rewrite: (path) => path.replace(/^\/website-proxy/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Accept-Encoding', 'identity');
            });
            proxy.on('proxyRes', (proxyRes, _req, res) => {
              // Strip blocking headers
              delete proxyRes.headers['x-frame-options'];
              delete proxyRes.headers['content-security-policy'];

              const type = proxyRes.headers['content-type'] || '';
              const isText = type.includes('text/html') || type.includes('text/css') || type.includes('javascript');

              if (!isText) {
                // Binary responses (images, fonts…) — pipe through unchanged
                res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
                proxyRes.pipe(res);
                return;
              }

              // Text responses — buffer, rewrite domain refs, send
              delete proxyRes.headers['content-length'];
              const chunks = [];
              proxyRes.on('data', (chunk) => chunks.push(chunk));
              proxyRes.on('end', () => {
                let body = Buffer.concat(chunks).toString('utf8');
                body = body
                  .replace(/https:\/\/www\.museum-reutte\.at/g, '/website-proxy')
                  .replace(/http:\/\/www\.museum-reutte\.at/g,  '/website-proxy')
                  .replace(/\/\/www\.museum-reutte\.at/g,       '/website-proxy');
                res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
                res.end(body);
              });
            });
          },
        },
      },
    },
  },
});
