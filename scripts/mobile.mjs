export default { async mobile({ page, G, frames, shot }) {
  await shot('m_title');
  await page.tap('[data-m=new]'); await frames(4);
  for (let i = 0; i < 4; i++) { if (await G(() => window.__game.ui.dialogOpen)) { await page.tap('.dialog'); await frames(3); } }
  const p0 = await G(() => window.__game.player.pos.toArray());
  // drag joystick upward using touch pointer events via CDP
  const box = await page.locator('.stick').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
  for (let i = 1; i <= 6; i++) { await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy - i * 9, id: 1 }] }); }
  await frames(30);
  await shot('m_move');
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const p1 = await G(() => window.__game.player.pos.toArray());
  console.log('moved', p0.map((v) => v.toFixed(2)), '->', p1.map((v) => v.toFixed(2)));
  console.log('touch enabled', await G(() => window.__game.touch.enabled));
  await G(() => window.__game.inv.add('sword'));
  await page.tap('.tb.big'); await frames(8);
  console.log('attack action', await G(() => window.__game.player.action));
  await frames(20);
  await page.tap('.rbtn[data-k=btnInv]'); await frames(5); await shot('m_inv');
} };
