import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const TOKEN = process.argv[2];
const TEAM = 'team_grBXAnvjNcx41kaOltdI7yQg';
const PROJECT = 'prj_r1p2YZM8AuSOLYNy3vtvKMoE7Wsu';
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

function walk(dir, base = '') {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(walk(p, rel));
    else out.push({ file: rel, path: p });
  }
  return out;
}

async function req(method, urlStr, headers, body) {
  const r = await fetch(urlStr, {
    method,
    headers,
    body: body || undefined,
  });
  const txt = await r.text();
  let json; try { json = JSON.parse(txt); } catch { json = txt; }
  return { status: r.status, body: json };
}

const files = walk(DIST);
console.log('FILES', files.length);
for (const f of files) {
  const buf = readFileSync(f.path);
  const sha = createHash('sha1').update(buf).digest('hex');
  f.sha = sha; f.size = buf.length;
  const up = await req('POST', `https://api.vercel.com/v2/files?teamId=${TEAM}`, {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/octet-stream',
    'Content-Length': buf.length,
    'x-vercel-digest': sha
  }, buf);
  if (up.status >= 300 && up.status !== 409) {
    console.log('UPLOAD_FAIL', f.file, up.status, JSON.stringify(up.body));
  } else {
    console.log('UP', f.file, up.status);
  }
}

const fallback = '/((?!assets/|img/|logo.jpg|sw.js|manifest.webmanifest).*)';
const deployBody = JSON.stringify({
  name: 'dose-cafe',
  project: PROJECT,
  target: 'production',
  files: files.map(f => ({ file: f.file, sha: f.sha, size: f.size })),
  routes: [
    { src: '/img/(.*)', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
    { src: '/sw.js', headers: { 'Cache-Control': 'no-cache' }, continue: true },
    { src: fallback, dest: '/index.html' }
  ],
  projectSettings: { framework: null, buildCommand: null, outputDirectory: null, installCommand: null }
});
const dep = await req('POST', `https://api.vercel.com/v13/deployments?teamId=${TEAM}&skipAutoDetectionConfirmation=1&forceNew=1`, {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
  'Content-Length': Buffer.byteLength(deployBody)
}, deployBody);
console.log('DEPLOY_STATUS', dep.status);
console.log('ID=' + (dep.body && dep.body.id));
console.log('URL=' + (dep.body && dep.body.url));
console.log('STATE=' + (dep.body && (dep.body.readyState || dep.body.status)));