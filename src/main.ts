import { Game } from './core/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap';
document.head.appendChild(link);
// Building the island takes a moment on phones: show a loading card first, then build on the next frame.
const t0 = performance.now();
const loading = document.createElement('div');
loading.id = 'loading';
loading.innerHTML = '<div><b>파도섬 이야기</b><span>섬을 만드는 중…</span><i></i></div>';
document.body.appendChild(loading);
requestAnimationFrame(() => setTimeout(() => {
  try {
    new Game(canvas);
    (window as any).__loadMs = Math.round(performance.now() - t0);
  } catch (e) { showError(e); }
  loading.classList.add('done'); setTimeout(() => loading.remove(), 600);
}, 30));
function showError(e: unknown) {
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:0;display:grid;place-items:center;background:#fff7e8;color:#4a3424;font:16px sans-serif;padding:24px;text-align:center">이 기기에서는 WebGL을 시작할 수 없어요.<br>${String(e)}</div>`);
  console.error(e);
}
