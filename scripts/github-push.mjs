// رفع المشروع إلى GitHub عبر REST API (بدون git محلي)
// الاستخدام: set GH_TOKEN=xxx && node scripts/github-push.mjs
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const OWNER = 'kalsalh23';
const REPO = 'dose';
const BRANCH = 'main';
const TOKEN = process.env.GH_TOKEN;
if (!TOKEN) { console.error('Missing GH_TOKEN'); process.exit(1); }

const API = 'https://api.github.com';
const api = async (path, opts = {}) => {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}
  return { status: res.status, ok: res.ok, body };
};

// 1) فحص/إنشاء المستودع
let repo = await api(`/repos/${OWNER}/${REPO}`);
if (repo.status === 404) {
  console.log('Repo not found — creating…');
  repo = await api('/user/repos', {
    method: 'POST',
    body: JSON.stringify({ name: REPO, description: 'Dose Coffee & More — Tablet kiosk loyalty platform', private: true, auto_init: false }),
  });
  if (!repo.ok) { console.error('Create failed:', JSON.stringify(repo.body)); process.exit(1); }
  console.log('Repo created (private).');
} else if (!repo.ok) {
  console.error('Repo check failed:', repo.status, JSON.stringify(repo.body));
  process.exit(1);
} else {
  console.log('Repo exists. default_branch =', repo.body.default_branch);
}

// 2) جمع الملفات (مع استثناءات)
const SKIP_DIRS = new Set(['node_modules', '.vercel', '.git']);
async function walk(dir, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(join(dir, entry.name), acc);
    } else if (entry.isFile()) {
      acc.push(join(dir, entry.name));
    }
  }
  return acc;
}
const files = await walk(process.cwd());
const root = process.cwd();

// 3) المستودع الفارغ يُهيَّأ بكوميت أول عبر Contents API (واجهة Git Objects ترفض المستودعات الفارغة)
let baseTree, parentCommit;
let ref = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
if (!ref.ok && (ref.status === 409 || ref.status === 404)) {
  console.log('Empty repo — seeding initial commit…');
  const readme = await readFile(join(root, 'README.md'));
  const seed = await api(`/repos/${OWNER}/${REPO}/contents/README.md`, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'Initial commit',
      content: readme.toString('base64'),
      branch: BRANCH,
    }),
  });
  if (!seed.ok) { console.error('Seed failed:', seed.status, JSON.stringify(seed.body).slice(0, 400)); process.exit(1); }
  ref = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
}
if (ref.ok) {
  const commit0 = await api(`/repos/${OWNER}/${REPO}/git/commits/${ref.body.object.sha}`);
  baseTree = commit0.body.tree.sha;
  parentCommit = commit0.body.sha;
  console.log('Base commit:', parentCommit.slice(0, 10));
}

// 4) إنشاء Blobs
const treeItems = [];
for (const file of files) {
  const content = await readFile(file);
  const blob = await api(`/repos/${OWNER}/${REPO}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: content.toString('base64'), encoding: 'base64' }),
  });
  if (!blob.ok) { console.error('Blob failed:', file, blob.status); process.exit(1); }
  treeItems.push({
    path: relative(root, file).split(sep).join('/'),
    mode: '100644',
    type: 'blob',
    sha: blob.body.sha,
  });
}
console.log('Blobs created:', treeItems.length);

// 5) شجرة + كوميت + دفع المرجع
const tree = await api(`/repos/${OWNER}/${REPO}/git/trees`, {
  method: 'POST',
  body: JSON.stringify(baseTree ? { base_tree: baseTree, tree: treeItems } : { tree: treeItems }),
});
if (!tree.ok) { console.error('Tree failed:', JSON.stringify(tree.body)); process.exit(1); }

const commitBody = {
  message: 'Dose Coffee & More — Tablet kiosk loyalty app\n\n- RTL premium coffee UI for in-store tablet\n- Supabase backend (customers, orders, PIN verification RPCs)\n- Points loyalty flow with on-screen PIN confirmation',
  tree: tree.body.sha,
  parents: parentCommit ? [parentCommit] : [],
  author: { name: OWNER, email: `${OWNER}@users.noreply.github.com`, date: new Date().toISOString() },
  committer: { name: OWNER, email: `${OWNER}@users.noreply.github.com`, date: new Date().toISOString() },
};
const commit = await api(`/repos/${OWNER}/${REPO}/git/commits`, { method: 'POST', body: JSON.stringify(commitBody) });
if (!commit.ok) { console.error('Commit failed:', JSON.stringify(commit.body)); process.exit(1); }

if (parentCommit) {
  const push = await api(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.body.sha, force: false }),
  });
  if (!push.ok) { console.error('Push failed:', JSON.stringify(push.body)); process.exit(1); }
} else {
  const push = await api(`/repos/${OWNER}/${REPO}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: commit.body.sha }),
  });
  if (!push.ok) { console.error('Push failed:', JSON.stringify(push.body)); process.exit(1); }
}

console.log('PUSHED →', commit.body.sha.slice(0, 10));
console.log(`https://github.com/${OWNER}/${REPO}/tree/${BRANCH}`);
