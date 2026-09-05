const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync('curriculum.js','utf8'),context);
vm.runInContext(`
const p={preset:'tutor',examples:[],model:null,guidance:{day1Step:1}};
if(Object.keys(courseGuide).length!==8)throw Error('Missing lesson');
for(const page of Object.keys(courseGuide)){
 const c=learningContext(page,p);
 if(!c.goal||!c.next||!c.takeaway)throw Error(page+' missing guidance');
}
p.examples=[{},{},{}];
if(learningContext('lab3',p).step!==3)throw Error('Examples do not advance guidance');
if(learningContext('lab5',p).step!==1)throw Error('Prepared learner blocked');
p.model={};
if(learningContext('lab5',p).step!==2)throw Error('Created model not recognised');
p.guidance.day1Step=4;
if(learningContext('lab1',p).step!==3)throw Error('Day 1 practice not recognised');
`,context);
for(const config of [{apiBaseUrl:'http://localhost:8787'},{apiBaseUrl:'http://localhost:8787',gpuEnabled:true}]){
 const browser={BUILD_AI_CONFIG:config};
 vm.runInNewContext(fs.readFileSync('gpu-client.js','utf8'),{window:browser});
 assert.equal(browser.BuildAICloud.enabled(),config.gpuEnabled===true);
 assert.equal(browser.BuildAICloud.teacherReady(),true);
}
console.log('Course goals, step transitions and independent Eve/GPU settings passed.');
const app={innerHTML:''};
const pageContext=vm.createContext({
 crypto:require('node:crypto').webcrypto,
 localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
 document:{querySelector:s=>s==='#app'?app:null,getElementById:()=>null,addEventListener(){}},
 window:{},setTimeout:()=>0,console
});
vm.runInContext(fs.readFileSync('curriculum.js','utf8')+'\n'+fs.readFileSync('app.js','utf8'),pageContext);
vm.runInContext(`
project().guidance.learnerName='Test';project().preset='tutor';
for(const page of ['intro','lab1','lab2','lab3','lab4','lab5','lab6','lab7']){
 store.page=page;render();
 if(!document.querySelector('#app').innerHTML.includes('Today’s goal'))throw Error(page+' missing learning goal');
}
`,pageContext);
console.log('All eight lesson pages rendered with learning goals.');
