const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/alexkahn/.cache/claude-memprobe/dr/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('http://geometry.fixture/**', route => {
      const path = new URL(route.request().url()).pathname;
      const sources = {
        '/index.js': fs.readFileSync('dist/index.js', 'utf8'),
        '/projection.js': fs.readFileSync('dist/projection.js', 'utf8'),
        '/alpha.js': fs.readFileSync('dist/alpha.js', 'utf8'),
 ...Object.fromEntries(['closedComponents','solidPointMembership','solidComponents','signedVolume','overlap','materialPartition','triangleWeights','surfaceOrigins','mergeIndexedMesh','principalInertia','axialOrientation','tetrahedronPlaneMoments','trianglePlaneMoments','manifold','manifoldMesh64'].map(n=>['/'+n+'.js',fs.readFileSync('dist/'+n+'.js','utf8')])),
        '/worker.js': `import {projectAlphaCoverage,alphaFromImageBitmap,principalInertiaFrame,axialOrientationTensor,solidPointMembership,tetrahedronPlaneMoments,prepareTetrahedronPlaneMoments,trianglePlaneMoments} from './index.js'; onmessage = e => { try {if(e.data.triangleCases){postMessage(e.data.triangleCases.map(r=>trianglePlaneMoments(r.vertices,r.point,r.normal)));return;}if(e.data.planeCases){postMessage(e.data.planeCases.map(r=>{const q=prepareTetrahedronPlaneMoments(r.vertices);const n=r.normal||[0,1,0];return {wet:q(r.point,n),dry:q(r.point,n.map(x=>-x))}}));return;}if(e.data.plane){const p=e.data.plane;postMessage(tetrahedronPlaneMoments(p.vertices,p.point,p.normal));return;}if(e.data.planeBenchmark){const vertices=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]],normal=[1,1,1],times=[],query=e.data.prepared?prepareTetrahedronPlaneMoments(vertices):(point,n)=>tetrahedronPlaneMoments(vertices,point,n);let checksum=0;for(let warm=0;warm<512;warm++)query([.5,0,0],normal);for(let batch=0;batch<5;batch++){const start=performance.now();for(let i=0;i<4096;i++)checksum+=query([.1+.8*(i%64)/63,0,0],normal).signedVolume;times.push(performance.now()-start);}postMessage({samples:20480,batchSize:4096,batchMs:times,checksum});return;}if(e.data.membership){const m=e.data.membership;const query=solidPointMembership(m.positions,m.indices);postMessage(m.points.map(query));return;}if(e.data.axes){const tensor=axialOrientationTensor(e.data.axes);postMessage({tensor},[tensor.buffer]);return;}if(e.data.tensor){postMessage(principalInertiaFrame(e.data.tensor));return;}if(e.data.bitmap){const alpha=alphaFromImageBitmap(e.data.bitmap);e.data.bitmap.close();postMessage({alpha},[alpha.buffer]);return;}const r = projectAlphaCoverage(e.data); postMessage(r,[r.cells.buffer]);} catch (error) {postMessage({error:String(error)});} };`,
      };
      return route.fulfill({contentType: path in sources ? 'text/javascript' : 'text/html', body: sources[path] || '<!doctype html><title>Geometry worker qualification</title>'});
    });
    await page.goto('http://geometry.fixture/');
    const result = await page.evaluate(async () => {
      const worker = new Worker('/worker.js', { type: 'module' });
      try {
        const positions = new Float64Array([0,0,0,1,0,0,0,0,1]);
        const reply = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(Error('worker deadline')), 5000);
          worker.onmessage = e => {clearTimeout(timer);resolve(e.data)};
          worker.onerror = e => {clearTimeout(timer);reject(Error(e.message))};
          worker.postMessage({positions, uv:new Float32Array([0,0,1,0,0,1]),indices:new Uint16Array([0,1,2]),alpha:new Uint8Array([255]),textureWidth:1,textureHeight:1,cutoff:0.4,resolution:64},[positions.buffer]);
        });
        return {area:reply.coveredArea,gap:reply.gapFraction,cells:reply.cells.length,detached:positions.byteLength===0};
      } finally {worker.terminate()}
    });
    assert.deepEqual(result,{area:0.5,gap:0,cells:4096,detached:true});
    const bitmapResult=await page.evaluate(async()=>{
      const bitmap=await createImageBitmap(new ImageData(new Uint8ClampedArray([255,0,0,255,1,2,3,0,255,255,255,64,0,0,0,128]),2,2),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
      const worker=new Worker('/worker.js',{type:'module'});
      try {
        const reply=await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(Error('bitmap worker deadline')),5000);
          worker.onmessage=e=>{clearTimeout(timer);resolve(e.data)};
          worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))};
          // Structured-clone, not transfer: the worker must not close the borrowed source.
          worker.postMessage({bitmap});
        });
        return {alpha:Array.from(reply.alpha||[]),sourceWidth:bitmap.width,error:reply.error??null};
      }finally{bitmap.close();worker.terminate()}
    });
    assert.deepEqual(bitmapResult,{alpha:[255,0,64,128],sourceWidth:2,error:null});
    assert.equal(await page.evaluate(async()=>typeof(await import('/manifold.js')).getManifoldMesh64),'function');
    const inertiaResult = await page.evaluate(async () => {
      const worker=new Worker('/worker.js',{type:'module'});
      try{return await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('inertia worker deadline')),5000);
        worker.onmessage=e=>{clearTimeout(timer);resolve(e.data)};
        worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))};
        worker.postMessage({tensor:[3,1,0,1,3,0,0,0,4]});
      });}finally{worker.terminate()}
    });
    assert.deepEqual(inertiaResult.principal,[2,4,4]);
    assert.ok(inertiaResult.relativeReconstructionError<1e-12);
    const orientationResult = await page.evaluate(async () => {
      const worker=new Worker('/worker.js',{type:'module'});
      try{return await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('orientation worker deadline')),5000);
        worker.onmessage=e=>{clearTimeout(timer);resolve(Array.from(e.data.tensor))};
        worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))};
        worker.postMessage({axes:[{axis:[1,0,0],weight:1},{axis:[-1,0,0],weight:1}]});
      });}finally{worker.terminate()}
    });
    assert.deepEqual(orientationResult,[1,0,0,0,0,0,0,0,0]);
    const membershipResult=await page.evaluate(async()=>{
      const worker=new Worker('/worker.js',{type:'module'});
      try{return await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('membership worker deadline')),5000);
        worker.onmessage=e=>{clearTimeout(timer);resolve(e.data)};
        worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))};
        const positions=new Float64Array([0,0,0,1,0,0,1,1,0,0,1,0,0,0,1,1,0,1,1,1,1,0,1,1,.5,0,1e-18]);
        const indices=new Uint32Array([0,3,2,0,2,1,4,5,6,4,6,7,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5,0,1,8,1,5,8,5,4,8,4,0,8]);
        worker.postMessage({membership:{positions,indices,points:[[.5,.5,.5],[.5,-1e-6,.5],[.5,0,1e-18]]}},[positions.buffer,indices.buffer]);
      });}finally{worker.terminate()}
    });
    assert.deepEqual(membershipResult,['inside','outside','boundary']);
    const conditioning=JSON.parse(fs.readFileSync('tests/fixtures/plane-conditioning-oracle.json','utf8'));
    const oblique=JSON.parse(fs.readFileSync('tests/fixtures/cut-body-oblique-plane.json','utf8'));
    conditioning.push({vertices:oblique.vertices,point:oblique.planePoint,normal:oblique.planeNormal,scale:1,reach:1,...oblique.oracle});
    const planeResult=await page.evaluate(async(conditioning)=>{
      const worker=new Worker('/worker.js',{type:'module'});
      const request=data=>new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('plane worker deadline')),10000);
        worker.onmessage=e=>{clearTimeout(timer);resolve(e.data)};
        worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))};worker.postMessage(data);
      });
      try{return {conditioning:await request({planeCases:conditioning}),sample:await request({plane:{vertices:[[0,0,0],[1,0,0],[0,1,0],[0,0,1]],point:[.5,0,0],normal:[1,1,1]}}),benchmark:await request({planeBenchmark:true}),preparedBenchmark:await request({planeBenchmark:true,prepared:true}),rejected:await request({plane:{vertices:[[0,0,0],[1,0,0],[0,1,0],[0,0,1]],point:[0,0,0],normal:[0,0,0]}})};}finally{worker.terminate()}
    },conditioning);
    for(let i=0;i<conditioning.length;i++) {
      const expected=conditioning[i],actual=planeResult.conditioning[i];
      assert.ok(Math.abs(actual.wet.signedVolume/expected.wet-1)<2e-11);
      assert.ok(Math.abs((actual.wet.signedVolume+actual.dry.signedVolume)/expected.full-1)<2e-11);
      for(let k=0;k<3;k++)assert.ok(Math.abs(actual.wet.centroid[k]-expected.centroid[k])/(expected.scale*expected.reach)<2e-10);
    }
    assert.ok(Math.abs(planeResult.sample.signedVolume-1/48)<1e-14);
    assert.ok(planeResult.sample.centroid.every(x=>Math.abs(x-.125)<1e-14));
    assert.equal(planeResult.benchmark.samples,20480);
    assert.equal(planeResult.preparedBenchmark.samples,20480);
    assert.equal(planeResult.preparedBenchmark.checksum,planeResult.benchmark.checksum);
    assert.ok(planeResult.benchmark.batchMs.every(Number.isFinite));
    assert.match(planeResult.rejected.error,/Zero clipping normal/);
    const triangleResult=await page.evaluate(async()=>{
      const worker=new Worker('/worker.js',{type:'module'});
      try{return await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('triangle worker deadline')),10000);
        worker.onmessage=e=>{clearTimeout(timer);resolve(e.data)};
        worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))};
        worker.postMessage({triangleCases:Array.from({length:100},(_,i)=>({vertices:[[0,0,0],[1,0,0],[0,1,0]],point:[(i+1)/100,0,0],normal:[1,1,0]}))});
      });}finally{worker.terminate()}
    });
    assert.equal(triangleResult.length,100);
    triangleResult.forEach((r,i)=>{const f=(i+1)/100;assert.ok(Math.abs(r.area-f*f/2)<1e-13);assert.ok(Math.abs(r.firstMoment[0]-f**3/6)<1e-13);assert.ok(Math.abs(r.secondMoment[1]-f**4/24)<1e-13);});
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({triangleWorkerCases:triangleResult.length}));
    fs.mkdirSync('.diagnostics',{recursive:true});
    fs.writeFileSync('.diagnostics/browser-worker.json',JSON.stringify({result,bitmapResult,inertiaResult,orientationResult,membershipResult,planeResult,errors,gpu:'disabled'},null,2));
    console.log('GPU-disabled browser module worker passed',result);
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
