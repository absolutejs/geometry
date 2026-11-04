const {chromium}=require('/home/alexkahn/.cache/claude-memprobe/dr/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
const b=await chromium.launch({headless:true,args:['--disable-gpu']});const timer=setTimeout(()=>b.close(),20000);
try{
const p=await b.newPage();await p.route('http://contour.fixture/**',r=>{
 const path=new URL(r.request().url()).pathname;
 return r.fulfill({contentType:path==='/'?'text/html':'text/javascript',body:path==='/'?'<title>Contour worker</title>':path==='/field.js'?fs.readFileSync('dist/scalarContour2D.js','utf8'):`import {prepareScalarContour2D} from './field.js';onmessage=({data})=>{const c=prepareScalarContour2D({values:data,width:3,height:3,spacing:1,sample:(x,y)=>Math.expm1((x-.25)*7),refinementSteps:14});postMessage({hit:c.nearest(0,1,2),segments:c.segmentCount,plateaus:c.zeroPlateauCells,refinedEdges:c.refinedEdges,refinementSamples:c.refinementSamples});};`});
});await p.goto('http://contour.fixture/');
const result=await p.evaluate(async()=>{const w=new Worker('/worker.js',{type:'module'}),values=new Float64Array([-.25,.75,1.75,-.25,.75,1.75,-.25,.75,1.75]);try{const reply=await new Promise((resolve,reject)=>{w.onmessage=e=>resolve(e.data);w.onerror=e=>reject(Error(e.message));w.postMessage(values,[values.buffer]);});return{reply,detached:values.byteLength===0};}finally{w.terminate();}});
assert.equal(result.reply.hit.distance,.25);assert.equal(result.reply.segments,2);assert.equal(result.reply.plateaus,0);assert.equal(result.detached,true);assert.equal(result.reply.refinedEdges,3);assert.ok(result.reply.refinementSamples>0);console.log(JSON.stringify(result));
}finally{clearTimeout(timer);await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
