const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist/server');fs.mkdirSync(out,{recursive:true});
const names=['index.html','styles.css','classroom.css','runtime-config.js','gpu-client.js','curriculum.js','experience.js','journey.js','lesson-design.js','app.js','assets/eve-teacher.png'];
const assets={};for(const name of names){const filename=path.join(root,name);if(!fs.statSync(filename).isFile())throw Error('Missing public asset: '+name);assets['/'+name]={data:fs.readFileSync(filename).toString('base64'),type:name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.png')?'image/png':'text/javascript; charset=utf-8'};}
fs.writeFileSync(path.join(out,'assets.js'),'export default '+JSON.stringify(assets)+';\n');
fs.copyFileSync(path.join(root,'online/worker.mjs'),path.join(out,'index.js'));
fs.writeFileSync(path.join(out,'package.json'),'{"type":"module"}\n');
const python=path.join(root,'gpu-service/api/.teacher-venv/Scripts/python.exe');
const instructions=cp.execFileSync(python,[path.join(root,'scripts/export-teacher-prompt.py')],{encoding:'utf8'});
fs.writeFileSync(path.join(out,'instructions.js'),'export default '+JSON.stringify(instructions)+';\n');
fs.mkdirSync(path.join(root,'dist/.openai'),{recursive:true});fs.copyFileSync(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));
if(fs.statSync(path.join(out,'assets.js')).size>8_000_000)throw Error('Asset bundle exceeds safe size.');
console.log('Built protected course and Eve service; public assets allowlisted, no private env files included.');
