export default { async bd({ page, G, frames }) {
  await page.click('[data-m=new]'); await frames(3); await page.click('[data-cr=done]'); await frames(3);
  await G(() => { const g = window.__game; g.ui.advance(); g.player.place(4, 28, 0); g.rig.snap(g.player.pos); }); await frames(15);
  const r = await G(() => {
    const g = window.__game, cam = g.cam; const fr = new window.__THREE.Frustum().setFromProjectionMatrix(new window.__THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const out = {}; let calls = 0;
    g.scene.traverseVisible((o) => {
      if (!o.isMesh && !o.isPoints && !o.isLine) return;
      o.updateWorldMatrix(true, false);
      if (o.geometry.boundingSphere === null) o.geometry.computeBoundingSphere();
      const sph = (o.isInstancedMesh && o.boundingSphere ? o.boundingSphere : o.geometry.boundingSphere).clone().applyMatrix4(o.matrixWorld);
      if (o.frustumCulled !== false && !fr.intersectsSphere(sph)) return;
      const tri = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
      const per = Math.round((o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3); let tag = o.isInstancedMesh ? `inst per=${per} mat=${o.material.type}${o.material.vertexColors ? '' : ''} wind=${/wind/.test(o.material.customProgramCacheKey?.() ?? '') ? 1 : 0} key=${o.material.customProgramCacheKey?.() ?? ''}` : (o.parent?.name || o.type);
      out[tag] = out[tag] || { calls: 0, tris: 0, n: 0 }; out[tag].calls++; out[tag].tris += tri; out[tag].n += o.isInstancedMesh ? o.count : 1; calls++;
    });
    return Object.entries(out).sort((a, b) => b[1].tris - a[1].tris).slice(0, 12).map(([k, v]) => `${k}: ${v.calls} calls, n=${v.n}, ${Math.round(v.tris / 1000)}k tris`).join('\n') + `\nTOTAL calls ${calls}`;
  });
  console.log(r);
} };
