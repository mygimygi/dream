export default { async fs({ page, G, frames, shot }) {
  await page.click('[data-m=new]'); await frames(5);
  console.log('fullscreen after start:', await G(() => !!document.fullscreenElement));
  console.log('button label:', await G(() => document.querySelector('[data-k=btnFull]').getAttribute('aria-label')));
  await page.click('[data-k=btnFull]'); await frames(5);
  console.log('after toggle:', await G(() => !!document.fullscreenElement));
  await page.click('[data-k=btnFull]'); await frames(5);
  console.log('after toggle again:', await G(() => !!document.fullscreenElement), 'canvas', await G(() => [innerWidth, innerHeight, document.getElementById('game').width]));
  await shot('fs_hud');
} };
