import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const projectRoot = process.cwd();
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    const requestPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const absolutePath = path.join(projectRoot, normalizeRequestPath(requestPath));

    try {
        await access(absolutePath);
        const fileStats = await stat(absolutePath);

        if (fileStats.isDirectory()) {
            return sendFile(response, path.join(absolutePath, 'index.html'));
        }

        return sendFile(response, absolutePath);
    } catch {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not Found');
    }
});

server.listen(port, () => {
    console.log(`Static server running at http://localhost:${port}`);
});

function normalizeRequestPath(requestPath) {
    const safePath = path.normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, '');
    return safePath.startsWith(path.sep) ? safePath.slice(1) : safePath;
}

async function sendFile(response, absolutePath) {
    const extension = path.extname(absolutePath).toLowerCase();
    const contentType = mimeTypes[extension] || 'application/octet-stream';

    response.writeHead(200, { 'Content-Type': contentType });
    createReadStream(absolutePath).pipe(response);
}
