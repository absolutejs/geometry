const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/home/alexkahn/.cache/claude-memprobe/dr/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--disable-gpu']});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('http://geometry.fixture/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Double import worker</title>'});
   if(path==='/worker.js')return route.fulfill({contentType:'text/javascript',body:`
import Module from '/native/manifold.js';
import {createManifoldMesh64,createManifoldPartitionKernel,getManifoldMesh64,createManifoldCutSession,auditManifoldCoverage} from '/dist/manifold.js';
import {partitionSolidMaterials,prepareTrianglePositiveQuadraticMoments} from '/dist/index.js';
onmessage=async e=>{try{
 const wasm=await Module({locateFile:()=>'/native/manifold.wasm'});wasm.setup();
 const seed=wasm.Manifold.cube([1,1,1],true),m=seed.getMesh();seed.delete();
 const p=Float64Array.from(m.vertProperties,v=>v*1.123456789+.123456789012345);
 const solid=createManifoldMesh64(wasm,{numProp:3,vertProperties:p,triVerts:m.triVerts});
 let vertices=0;try{const out=getManifoldMesh64(solid),exact=new Set();for(let i=0;i<p.length;i+=3)exact.add(Array.from(p.slice(i,i+3)).join(','));for(let i=0;i<out.vertProperties.length;i+=3){if(!exact.has(Array.from(out.vertProperties.slice(i,i+3)).join(',')))throw Error('Rounded position');vertices++;}}finally{solid.delete();}
 const rows=e.data.map(f=>{const inputs=f.inputs.map(m=>({positions:Float64Array.from(m.positions),indices:Uint32Array.from(m.indices)}));const r=partitionSolidMaterials(inputs,createManifoldPartitionKernel(wasm,inputs.length));return {variant:f.variant,shape:f.shape,volume:r.materialVolume,faces:r.exterior.indices.length/3};});
 const session=createManifoldCutSession(wasm,[{positions:Float64Array.from(m.vertProperties),indices:m.triVerts}]);
 let sessionResult;try{const initial=session.snapshot().volume;const r=session.cut({positions:Float64Array.from(m.vertProperties,(v,k)=>v+(k%3===0?.5:0)),indices:m.triVerts});const air=session.cut({positions:Float64Array.from(m.vertProperties,(v,k)=>v+(k%3===0?100:0)),indices:m.triVerts});const coverage=session.auditCoverage([{positions:Float64Array.from(m.vertProperties),indices:m.triVerts}]);sessionResult={coverage:{components:coverage.components.length,missing:coverage.components[0].missingVolume,excess:coverage.components[0].excessVolume,owner:coverage.cells[0].owner},initial,removed:r.removed.volume,retained:r.retained.volume,sequence:r.sequence,airSkipped:air.broadPhaseSkipped,airNativeEvaluated:air.removed.stats.nativeEvaluated};}finally{session.dispose();}
 const outer=wasm.Manifold.cube([2,2,2]),holeSeed=wasm.Manifold.cube([1,1,1]),hole=holeSeed.translate([.5,.5,.5]),hollow=outer.subtract(hole);let cavity;
 try{const r=auditManifoldCoverage(wasm,hollow,[]);cavity={components:r.components.length,cavities:r.cavities,volume:r.components[0].nativeVolume};}finally{hollow.delete();hole.delete();holeSeed.delete();outer.delete();}
 const pressure=prepareTrianglePositiveQuadraticMoments([[0,0,0],[1,0,0],[0,1,0]])([-.5,.5,-.5]);
 const wetPressure=prepareTrianglePositiveQuadraticMoments([[0,0,0],[1,0,0],[0,1,0]])([-.5,.5,-.5],[.25,.25,-.75]);
 postMessage({vertices,rows,sessionResult,cavity,pressure,wetPressure});
}catch(error){postMessage({error:String(error)});}};`});
   const allowed=path.startsWith('/dist/')&&/^\/dist\/[A-Za-z0-9]+\.js$/.test(path);
   const file=allowed?'.'+path:path==='/native/manifold.js'?'node_modules/manifold-3d/manifold.js':path==='/native/manifold.wasm'?'node_modules/manifold-3d/manifold.wasm':null;
   return file?route.fulfill({contentType:path.endsWith('.wasm')?'application/wasm':'text/javascript',body:fs.readFileSync(file)}):route.abort();
  });
  await page.goto('http://geometry.fixture/');
  const fixtures=['0-broad','1-slender','1-broad','2-slender'].map(n=>JSON.parse(fs.readFileSync('artifacts/deformed-tree-precision/'+n+'.json','utf8')));
  const result=await page.evaluate(fixtures=>new Promise((resolve,reject)=>{
   const w=new Worker('/worker.js',{type:'module'}),timer=setTimeout(()=>{w.terminate();reject(Error('worker deadline'));},20000);
   w.onmessage=e=>{clearTimeout(timer);w.terminate();resolve(e.data);};w.onerror=e=>{clearTimeout(timer);w.terminate();reject(Error(e.message));};w.postMessage(fixtures);
  }),fixtures);
  assert.deepEqual(result.sessionResult,{coverage:{components:1,missing:0,excess:.5,owner:0},initial:1,removed:.5,retained:.5,sequence:1,airSkipped:true,airNativeEvaluated:false});assert.equal(result.cavity.components,1);assert.equal(result.cavity.cavities,1);assert.ok(Math.abs(result.cavity.volume-7)<1e-12);assert.equal(result.error,undefined);assert.equal(result.vertices,8);assert.equal(result.rows.length,4);result.rows.forEach(r=>assert.ok(r.volume>0&&r.faces>0));assert.deepEqual(errors,[]);assert.ok(Math.abs(result.pressure.integral-1/192)<1e-15);assert.ok(Math.abs(result.pressure.cubicIntegral-1/640)<1e-15);assert.ok(Math.abs(result.pressure.meanOffset[0]-.8)<1e-14);assert.ok(Math.abs(result.wetPressure.integral-(.5**4-.25**4)/12)<1e-15);
  fs.mkdirSync('.diagnostics',{recursive:true});fs.writeFileSync('.diagnostics/import64-browser.json',JSON.stringify({gpu:'disabled',result,errors},null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
