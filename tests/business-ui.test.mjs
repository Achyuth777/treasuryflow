import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {harness} from './business-harness.mjs';
let bundle;
before(async()=>{bundle=(await build({stdin:{contents:"import React from 'react';import{createRoot}from'react-dom/client';import{Business}from'./frontend/Business';createRoot(document.getElementById('root')).render(<Business/>);",resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'}})).outputFiles[0].text;});
const sleep=()=>new Promise(r=>setTimeout(r,45));
const button=(d,t)=>[...d.querySelectorAll('button')].find(b=>b.textContent.trim()===t);
async function click(el){assert.ok(el,'control exists');el.click();await sleep();}
async function set(w,el,value){assert.ok(el,'input exists');const proto=el.tagName==='SELECT'?w.HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?w.HTMLTextAreaElement.prototype:w.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new w.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));await sleep();}
async function open(h,user){const dom=new JSDOM('<div id="root"></div>',{url:'https://treasury.test/app',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;w.matchMedia=()=>({matches:false});w.fetch=async(path,options={})=>h.raw(user,String(path).replace('/api/business/','').replace('/api/business',''),options.method||'GET',options.body);w.eval(bundle);await sleep();await sleep();return {dom,w,doc:w.document};}
const submit=async(w,form)=>{form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await sleep();await sleep();};
test('anonymous workspace offers top-level sign-in, not a role picker',async()=>{const h=harness(),{dom,doc}=await open(h,null);try{const a=doc.querySelector('a[href^="/signin-with-chatgpt"]');assert.equal(a.target,'_top');assert.match(a.href,/return_to/);assert.equal(doc.querySelector('select'),null);assert.match(doc.body.textContent,/does not move money/);}finally{dom.window.close();h.close();}});
test('mounted company onboarding, supplier creation and invoice submission persist through API',async()=>{
 const h=harness(),{dom,w,doc}=await open(h,'owner');try{
 await click(button(doc,'Create company'));await set(w,doc.querySelector('[name=name]'),'Live Operations');await submit(w,doc.querySelector('form'));assert.match(doc.body.textContent,/Live Operations/);assert.equal(h.sqlite.prepare('SELECT count(*) n FROM companies').get().n,1);
 await click(button(doc,'Suppliers'));await click(button(doc,'+ Add supplier'));await set(w,doc.querySelector('[name=name]'),'Acme Parts');await set(w,doc.querySelector('[name=email]'),'parts@example.com');await set(w,doc.querySelector('[name=category]'),'Equipment');await submit(w,doc.querySelector('form'));assert.match(doc.body.textContent,/Acme Parts/);
 await click(button(doc,'+ Submit invoice'));await set(w,doc.querySelector('[name=number]'),'INV-LIVE');await set(w,doc.querySelector('[name=amount]'),'1250.50');await set(w,doc.querySelector('[name=description]'),'Replacement equipment');await submit(w,doc.querySelector('form'));assert.equal(h.sqlite.prepare('SELECT amount FROM invoices').get().amount,125050);assert.match(doc.querySelector('.modal').textContent,/independent manager/);assert.equal(button(doc,'Approve invoice'),undefined);
 }finally{dom.window.close();h.close();}
});
test('manager can approve in UI and auditor has no write controls',async()=>{
 const h=harness();const {cid,sid}=await h.setup();await h.invite(cid,'manager','manager');await h.invite(cid,'auditor','auditor');await h.call('owner',cid+'/invoices','POST',{supplierId:sid,number:'INV-UI',amount:'100',dueDate:'2026-10-20',description:'Test'});
 const m=await open(h,'manager');try{await click(button(m.doc,'Invoices'));await click(button(m.doc,'INV-UI'));await click(button(m.doc,'Approve invoice'));assert.equal(h.sqlite.prepare('SELECT status FROM invoices').get().status,'APPROVED');assert.match(m.doc.querySelector('.modal').textContent,/manager@example.com/);}finally{m.dom.window.close();}
 const a=await open(h,'auditor');try{await click(button(a.doc,'Invoices'));await click(button(a.doc,'INV-UI'));assert.equal(button(a.doc,'Record a bank payment'),undefined);assert.equal(button(a.doc,'+ Submit invoice'),undefined);assert.equal(a.doc.querySelector('input[type=file]'),null);}finally{a.dom.window.close();h.close();}
});
