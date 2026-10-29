/** Research fixtures only: reuse canonical game generation without physics/GPU. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const game=resolve(process.argv[2]!),directory=resolve(process.argv[3]!);mkdirSync(directory,{recursive:true});
const {generatedCollisionMesh}=await import(game+'/src/world/generatedCollisionMesh.ts');
const {surfaceHeight}=await import(game+'/src/world/terrain.ts');
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const sites=[{id:'captured',seed:417317994,x:38286.3424544,z:10.03214},{id:'shore',seed:417317994,x:38160.901,z:-186.987},{id:'landform',seed:2126658212,x:80881,z:66354}];
const rows=[];
for(const {id,...site} of sites)for(const radius of [0,2.5,8]){
 const edits=radius?[{center:[site.x,surfaceHeight(site.x,site.z,site.seed)-1,site.z],radius}]:[];
 const ground=generatedCollisionMesh(site,edits),raw=Buffer.from(JSON.stringify(ground,(_,v)=>ArrayBuffer.isView(v)?Array.from(v as unknown as ArrayLike<number>):v)),archive=gzipSync(raw),file=id+'-'+radius+'.json.gz';writeFileSync(directory+'/'+file,archive);
 rows.push({file,site,edits,rawSha256:sha(raw),archiveSha256:sha(archive),triangles:ground.indices.length/3});
 if(process.memoryUsage().rss>1024**3)throw Error('Fixture generation memory budget');
}
writeFileSync(directory+'/manifest.json',JSON.stringify({scope:'Nine deterministic generated/excavated patches, no solver or renderer',selectedSources:Object.fromEntries([import.meta.path,game+'/src/world/generatedCollisionMesh.ts',game+'/src/world/terrain.ts'].map(p=>[p,sha(readFileSync(p))])),rows},null,2)+'\n');
console.log(JSON.stringify(rows,null,2));
