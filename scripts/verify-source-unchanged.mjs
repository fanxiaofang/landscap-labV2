import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sourceRoot=process.env.LWM_SOURCE;
if(!sourceRoot) throw new Error('Set LWM_SOURCE to the Live With Me checkout used for the baseline.');
const provenance=JSON.parse(await fs.readFile('public/reference/provenance.json','utf8'));
const original=JSON.parse(await fs.readFile('evidence/source-hashes-before.json','utf8'));
const changed=[];
for(const [name,before] of Object.entries(original)){
  let after='missing';try{after=createHash('sha256').update(await fs.readFile(sourceRoot+'/'+name)).digest('hex');}catch{}
  if(before!==after)changed.push(name);
}
const result={trackedFilesChecked:Object.keys(original).length,changedFiles:changed,passed:changed.length===0,scope:'Tracked source files compared with the captured working-tree baseline. Existing uncommitted work was preserved.'};
await fs.writeFile('evidence/source-unchanged.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(changed.length)process.exitCode=1;
