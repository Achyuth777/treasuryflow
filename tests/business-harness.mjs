import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { handleBusiness } from '../hosted/server/business.mjs';
export function harness(){
 const sqlite=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync('hosted/drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('hosted/drizzle/'+file,'utf8'));
 const prepare=sql=>({args:[],bind(...args){this.args=args;return this;},async first(){return sqlite.prepare(sql).get(...this.args)||null;},async all(){return {results:sqlite.prepare(sql).all(...this.args)};},runSync(){return {meta:{changes:Number(sqlite.prepare(sql).run(...this.args).changes)}};}});
 const objects=new Map();const env={DB:{prepare,async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.runSync());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}},BUCKET:{async put(k,v){objects.set(k,v);},async get(k){return objects.has(k)?{body:objects.get(k)}:null;},async delete(k){objects.delete(k);}}};
 async function raw(user,path='',method='GET',data,headers={}){
  return handleBusiness(new Request('https://treasury.test/api/business'+(path?'/'+path:''),{method,headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.com'}:{}),'Origin':'https://treasury.test','X-Treasury-Request':'1',...headers},...(data===undefined?{}:{body:typeof data==='string'||data instanceof Uint8Array?data:JSON.stringify(data)})}),env);
 }
 async function call(user,path,method,data,headers){const r=await raw(user,path,method,data,headers);return {status:r.status,body:await r.json()};}
 async function setup(){const c=await call('owner','companies','POST',{name:'Test Operations',currency:'INR',threshold:'5000'});const cid=c.body.id;const s=await call('owner',cid+'/suppliers','POST',{name:'Northstar',email:'supplier@example.com',category:'Services'});return {cid,sid:s.body.id};}
 async function invite(cid,user,role){const i=await call('owner',cid+'/invites','POST',{email:user+'@example.com',role});return call(user,'accept','POST',{token:i.body.token});}
 const close=()=>sqlite.close();return {sqlite,env,call,raw,setup,invite,close,objects};
}
