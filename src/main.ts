import { Game } from './core/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap';
document.head.appendChild(link);
try {
  new Game(canvas);
} catch (e) {
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:0;display:grid;place-items:center;background:#fff7e8;color:#4a3424;font:16px sans-serif;padding:24px;text-align:center">이 기기에서는 WebGL을 시작할 수 없어요.<br>${String(e)}</div>`);
  throw e;
}
