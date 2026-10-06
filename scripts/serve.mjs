import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../site/', import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'staticwebapp.config.json'), 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.css': 'text/css', '.json': 'application/json' };

createServer(async (req, res) => {
  const headers = { ...config.globalHeaders, 'Cache-Control': 'no-store' };
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { ...headers, Allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (error) {
    console.error('Invalid request URL:', error.message);
    res.writeHead(400, headers);
    res.end('Bad request');
    return;
  }
  if (pathname === '/index.html') {
    res.writeHead(301, { ...headers, Location: '/' });
    res.end();
    return;
  }
  const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!filename.startsWith(root) || pathname.includes('\0') || pathname.includes('\\')) {
    res.writeHead(400, headers);
    res.end('Bad request');
    return;
  }
  try {
    const content = await readFile(filename);
    res.writeHead(200, { ...headers, 'Content-Type': types[path.extname(filename)] ?? 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) {
      try {
        const content = await readFile(path.join(root, '404.html'));
        res.writeHead(404, { ...headers, 'Content-Type': types['.html'] });
        res.end(req.method === 'HEAD' ? undefined : content);
      } catch (notFoundError) {
        console.error('Cannot serve the 404 page:', notFoundError);
        res.writeHead(500, headers);
        res.end('Server error');
      }
    } else {
      console.error('Cannot serve file:', error);
      res.writeHead(500, headers);
      res.end('Server error');
    }
  }
}).listen(4280, '127.0.0.1', () => {
  console.log('Portfolio preview: http://127.0.0.1:4280');
}).on('error', (error) => {
  console.error('Preview server failed:', error);
  process.exitCode = 1;
});
