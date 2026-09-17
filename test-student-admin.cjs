const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {pathToFileURL}=require('node:url');
const {DatabaseSync}=require('node:sqlite');
const {chromium}=require('playwright');

class D1{
 constructor(){this.db=new DatabaseSync(':memory:');for(const file of fs.readdirSync(__dirname+'/drizzle').filter(name=>name.endsWith('.sql')).sort())this.db.exec(fs.readFileSync(__dirname+'/drizzle/'+file,'utf8'));}
 prepare(sql){return{bind:(...args)=>({first:async()=>this.db.prepare(sql).get(...args)||null,all:async()=>({results:this.db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(this.db.prepare(sql).run(...args).changes)}}),sql,args})};}
 async batch(items){this.db.exec('BEGIN');try{const result=items.map(item=>({meta:{changes:Number(this.db.prepare(item.sql).run(...item.args).changes)}}));this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}}
}

(async()=>{
 const worker=(await import(pathToFileURL(__dirname+'/dist/server/index.js'))).default;
 const db=new D1(),env={DB:db,OPENAI_API_KEY:'mock-key',COURSE_ADMIN_EMAIL:'secret-owner@example.com',COURSE_INITIAL_STUDENTS:'alice@example.com,testing@example.com,platform-owner@example.com'};
 const server=http.createServer(async(request,response)=>{try{
  const chunks=[];for await(const chunk of request)chunks.push(chunk);
  const headers=new Headers(request.headers),match=(request.headers.cookie||'').match(/testEmail=([^;]+)/),email=match?decodeURIComponent(match[1]):'';
  if(email){headers.set('oai-authenticated-user-id','id-'+email);headers.set('oai-authenticated-user-email',email);}
  const init={method:request.method,headers,...(!['GET','HEAD'].includes(request.method)?{body:Buffer.concat(chunks)}:{})};
  const result=await worker.fetch(new Request('http://127.0.0.1:8993'+request.url,init),env);
  response.writeHead(result.status,Object.fromEntries(result.headers));response.end(Buffer.from(await result.arrayBuffer()));
 }catch(error){response.writeHead(500);response.end(error.stack||error.message);}});
 await new Promise(resolve=>server.listen(8993,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const makeContext=async email=>{const context=await browser.newContext();await context.addCookies([{name:'testEmail',value:email,url:'http://127.0.0.1:8993'}]);return context;};
 try{
  const anonymous=await fetch('http://127.0.0.1:8993/',{redirect:'manual'});assert.equal(anonymous.status,302);assert.match(anonymous.headers.get('location'),/signin-with-chatgpt/);
  const stranger=await makeContext('stranger@example.com'),strangerPage=await stranger.newPage();await strangerPage.goto('http://127.0.0.1:8993/');assert.equal(await strangerPage.getByRole('heading',{name:'This email is not invited yet'}).count(),1);await stranger.close();

  const adminContext=await makeContext('secret-owner@example.com'),page=await adminContext.newPage();await page.goto('http://127.0.0.1:8993/');await page.waitForFunction(()=>CourseSession.active);assert.equal(await page.evaluate(()=>BUILD_AI_CONFIG.isAdmin),true);
  await page.getByRole('button',{name:/Manage students/}).click();await page.getByRole('heading',{name:'Manage students',exact:true}).waitFor();await page.getByText('alice@example.com',{exact:true}).waitFor();assert.equal(await page.locator('.student-row').count(),3);
  await page.locator('#student-email').fill('new.student@example.com');await page.getByRole('button',{name:'Add student',exact:true}).click();await page.getByText('new.student@example.com',{exact:true}).waitFor();assert.match(await page.locator('#student-admin-message').innerText(),/can now sign in/);
  const aliceRow=page.locator('.student-row').filter({hasText:'alice@example.com'});page.once('dialog',dialog=>dialog.accept());await aliceRow.getByRole('button',{name:'Remove',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#student-list')?.textContent.includes('alice@example.com'));assert.match(await page.locator('#student-admin-message').innerText(),/can no longer open/);
  await adminContext.close();

  const studentContext=await makeContext('new.student@example.com'),studentPage=await studentContext.newPage();await studentPage.goto('http://127.0.0.1:8993/');await studentPage.waitForFunction(()=>CourseSession.active);await studentPage.locator('#learner-name').waitFor();assert.equal(await studentPage.evaluate(()=>BUILD_AI_CONFIG.isAdmin),false);assert.equal(await studentPage.getByRole('button',{name:/Manage students/}).count(),0);
  const forbidden=await studentPage.evaluate(()=>fetch('/api/admin/students').then(async response=>({status:response.status,body:await response.json()})));assert.equal(forbidden.status,403);assert.match(forbidden.body.detail,/Only the course administrator/);
  await studentPage.evaluate(()=>go('admin'));assert.notEqual(await studentPage.evaluate(()=>store.page),'admin');await studentContext.close();

  const removedContext=await makeContext('alice@example.com'),removedPage=await removedContext.newPage();await removedPage.goto('http://127.0.0.1:8993/');assert.equal(await removedPage.getByRole('heading',{name:'This email is not invited yet'}).count(),1);await removedContext.close();
  const activeRows=db.db.prepare('SELECT email,active FROM course_access ORDER BY email').all();assert.ok(activeRows.some(row=>row.email==='new.student@example.com'&&row.active===1));assert.ok(activeRows.some(row=>row.email==='alice@example.com'&&row.active===0));
  console.log('PASS: only the exact administrator email sees the button/page; actual add, list, remove, persistence, uninvited denial, removed-student denial and direct student API denial passed. ChatGPT identity headers and D1 were mocked.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
