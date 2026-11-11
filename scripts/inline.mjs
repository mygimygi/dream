// Bundles dist/ into a single self-contained HTML body (for one-file hosting / artifact publishing).
import fs from 'fs';
import path from 'path';
const dist = path.resolve('dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const assets = fs.readdirSync(path.join(dist, 'assets'));
const js = assets.filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(dist, 'assets', f), 'utf8')).join('\n');
const css = assets.filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(dist, 'assets', f), 'utf8')).join('\n');
const safeJs = js.replace(/<\/script/gi, '<\\/script');
const body = `<title>파도섬 이야기</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap">
<style>${css}</style>
<canvas id="game" tabindex="0"></canvas>
<div id="ui"></div>
<script type="module">${safeJs}</script>`;
fs.writeFileSync(path.join(dist, 'wave-isle-single.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"></head><body>${body}</body></html>`);
fs.writeFileSync(path.join(dist, 'artifact-body.html'), body);
console.log('single file:', (fs.statSync(path.join(dist, 'wave-isle-single.html')).size / 1024).toFixed(0), 'KB');
void html;
