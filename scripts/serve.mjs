import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web'));
const port = Number(process.env.ACCEPTANCE_PORT || 8000);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if(pathname==='/health'){response.writeHead(200,{'Content-Type':'text/plain'});response.end('stc-diagnostic-v2');return;}
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const target = normalize(join(root, relative));
    if (!target.startsWith(root + sep)) throw new Error('path outside web root');
    if (!(await stat(target)).isFile()) throw new Error('not a file');
    response.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(target));
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Acceptance UI: http://127.0.0.1:${port}`));
