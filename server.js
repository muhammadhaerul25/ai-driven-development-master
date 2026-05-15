'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = process.env.PORT || 5500;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function copyHeader(sourceHeaders, targetHeaders, name) {
  const value = sourceHeaders.get(name);
  if (value) targetHeaders[name] = value;
}

function extractMediaUrl(data) {
  const candidates = [
    data?.mp4,
    data?.combinedMediaUrl,
    data?.tweet?.media?.videos?.[0]?.url,
    data?.tweet?.media?.all?.[0]?.url,
    data?.tweet?.mediaURLs?.[0],
    data?.mediaURLs?.[0],
    data?.all?.[0]?.url,
    data?.videos?.[0]?.url,
    data?.tweet?.media?.videos?.find?.((item) => item?.url)?.url,
    data?.tweet?.media?.all?.find?.((item) => item?.url)?.url,
  ];

  return candidates.find((value) => typeof value === 'string' && /\.(mp4|mov|m4v)(\?|$)/i.test(value))
    || candidates.find((value) => typeof value === 'string' && value.startsWith('http'))
    || null;
}

async function resolveTwitterVideo(tweetId) {
  const proxies = [
    'https://api.fxtwitter.com',
    'https://api.vxtwitter.com',
    'https://api.fixupx.com',
  ];

  for (const baseUrl of proxies) {
    try {
      const response = await fetch(`${baseUrl}/status/${tweetId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const mp4 = extractMediaUrl(data);
      if (mp4) {
        return { mp4, source: baseUrl };
      }
    } catch {
      // Try next proxy.
    }
  }

  return null;
}

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function resolveFile(requestPath) {
  const safePath = decodeURIComponent(requestPath.split('?')[0]);
  const normalized = path.normalize(safePath).replace(/^([/\\])+/, '');
  const target = path.join(root, normalized || 'index.html');

  if (!target.startsWith(root)) return null;
  return target;
}

const server = http.createServer((req, res) => {
  const requestPath = req.url === '/' ? '/index.html' : req.url;

  if (requestPath.startsWith('/api/twitter-video.mp4')) {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const tweetId = requestUrl.searchParams.get('tweetId');

    if (!tweetId) {
      sendJson(res, 400, { ok: false, error: 'Missing tweetId' });
      return;
    }

    resolveTwitterVideo(tweetId)
      .then(async (result) => {
        if (!result?.mp4) {
          sendJson(res, 404, { ok: false, error: 'Unable to resolve video URL' });
          return;
        }

        const upstream = await fetch(result.mp4, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
            ...(req.headers.range ? { 'Range': req.headers.range } : {}),
          },
        });

        if (!upstream.ok && upstream.status !== 206) {
          sendJson(res, upstream.status || 502, {
            ok: false,
            error: `Upstream video request failed (${upstream.status})`,
          });
          return;
        }

        const headers = {};
        copyHeader(upstream.headers, headers, 'content-type');
        copyHeader(upstream.headers, headers, 'content-length');
        copyHeader(upstream.headers, headers, 'accept-ranges');
        copyHeader(upstream.headers, headers, 'content-range');
        copyHeader(upstream.headers, headers, 'cache-control');
        copyHeader(upstream.headers, headers, 'etag');
        copyHeader(upstream.headers, headers, 'last-modified');

        headers['Cache-Control'] = 'no-store';

        res.writeHead(upstream.status, headers);
        if (upstream.body?.pipeTo) {
          const writable = new WritableStream({
            write(chunk) {
              res.write(Buffer.from(chunk));
            },
            close() {
              res.end();
            },
            abort() {
              try { res.end(); } catch { }
            },
          });
          await upstream.body.pipeTo(writable);
        } else {
          const buffer = Buffer.from(await upstream.arrayBuffer());
          res.end(buffer);
        }
      })
      .catch((error) => {
        sendJson(res, 500, { ok: false, error: error?.message || 'Video proxy failed' });
      });

    return;
  }

  if (requestPath.startsWith('/api/twitter-video')) {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const tweetId = requestUrl.searchParams.get('tweetId');

    if (!tweetId) {
      sendJson(res, 400, { ok: false, error: 'Missing tweetId' });
      return;
    }

    resolveTwitterVideo(tweetId)
      .then((result) => {
        if (!result) {
          sendJson(res, 404, { ok: false, error: 'Unable to resolve video URL' });
          return;
        }

        sendJson(res, 200, { ok: true, tweetId, mp4: result.mp4, source: result.source });
      })
      .catch((error) => {
        sendJson(res, 500, { ok: false, error: error?.message || 'Video resolution failed' });
      });

    return;
  }

  let filePath = resolveFile(requestPath);

  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      send(res, 404, 'Not found');
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        send(res, 404, 'Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
});
