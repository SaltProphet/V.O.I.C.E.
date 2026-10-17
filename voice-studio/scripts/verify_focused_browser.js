/* Run through playwright-cli run-code --filename against the isolated test server.
   This checks UI/lifecycle behavior; it does not replace real audio workflow tests. */
async (page) => {
  if (new URL(page.url()).port !== '8875') throw Error('Use the isolated test server on port 8875.');
  await page.reload();
  await page.setViewportSize({width:1041,height:511});
  await page.getByRole('button',{name:'Generate speech',exact:true}).last().waitFor();
  if (await page.locator('iframe').count()) throw Error('Standard view mounted a visual iframe.');
  const visibility=[];
  for (const [name,selector] of [
    ['Generate speech','.generate-panel button.accent'],
    ['Record & edit','.capture-panel button.accent'],
    ['Arrange & export · 0 clips','.timeline button.accent']
  ]) {
    await page.getByRole('button',{name,exact:true}).first().click();
    const box=await page.locator(selector).boundingBox();
    if (!box || box.y<0 || box.y+box.height>511) throw Error(name+' primary action is below the fold.');
    visibility.push({view:name,primaryBottom:box.y+box.height});
  }
  await page.getByRole('button',{name:'Generate speech',exact:true}).first().click();
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  async function sample() {
    const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
    const before=await metrics(),events=[];
    const collect=e=>events.push(...e.value);
    cdp.on('Tracing.dataCollected',collect);
    await cdp.send('Tracing.start',{categories:'devtools.timeline',transferMode:'ReportEvents'});
    await page.waitForTimeout(1200);
    const done=new Promise(r=>cdp.once('Tracing.tracingComplete',r));
    await cdp.send('Tracing.end');await done;
    cdp.off('Tracing.dataCollected',collect);
    const after=await metrics();
    return {
      taskMs:(after.TaskDuration-before.TaskDuration)*1000,
      scriptMs:(after.ScriptDuration-before.ScriptDuration)*1000,
      layoutMs:(after.LayoutDuration-before.LayoutDuration)*1000,
      animationCallbacks:events.filter(e=>e.name==='FireAnimationFrame').length,
      paintEvents:events.filter(e=>e.name==='Paint').length
    };
  }
  await page.waitForTimeout(500);
  const standard=await sample();
  await page.getByRole('button',{name:'Visual mode',exact:true}).click();
  const frame=page.frames().find(f=>f!==page.mainFrame());
  await frame.getByRole('button',{name:'Motion off',exact:true}).waitFor();
  await page.waitForTimeout(700);
  const before=await frame.evaluate(()=>({...window.__visualStats}));
  const off=await sample();
  const after=await frame.evaluate(()=>({...window.__visualStats}));
  if (before.frames!==after.frames || after.pending || off.animationCallbacks) throw Error('Motion Off still schedules rendering.');
  await frame.getByRole('button',{name:'Motion off',exact:true}).click();
  const on=await sample();
  if (!on.animationCallbacks) throw Error('Motion On did not animate.');
  // Explicitly synthetic visibility event: headless tabs can all stay visible.
  const syntheticBackground=await frame.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
    return {...window.__visualStats};
  });
  if (syntheticBackground.pending) throw Error('Background handler left an animation pending.');
  await frame.evaluate(()=>{
    delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
    const dispose=window.__disposeVisual;
    window.__disposeVisual=()=>{dispose();parent.__lastVisualCleanup={...window.__visualStats};};
  });
  await page.getByRole('button',{name:'Generate speech',exact:true}).first().click();
  const cleanup=await page.evaluate(()=>window.__lastVisualCleanup);
  if (!cleanup.disposed || cleanup.pending || await page.locator('iframe').count()) throw Error('Visual cleanup failed.');
  await page.setViewportSize({width:430,height:900});
  const mobile=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth}));
  if (mobile.documentWidth>mobile.width) throw Error('Mobile document overflows horizontally.');
  await page.setViewportSize({width:1041,height:511});
  await cdp.detach();
  return {sampleMs:1200,visibility,standard,off,on,syntheticBackground,cleanup,mobile};
}
