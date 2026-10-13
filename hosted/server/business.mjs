// Hosted API. Identity headers are injected by Sites dispatch; no browser role is trusted.
const roles=['owner','manager','creator','accountant','auditor'];
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
class Failure extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=(status,message)=>{throw new Failure(status,message);};
const id=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const text=(v,name,max=180)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail(400,`${name} is required (maximum ${max} characters).`);return v.trim();};
const email=v=>{const s=text(v,'Email',254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))fail(400,'Enter a valid email address.');return s;};
export const cents=v=>{if(typeof v!=='string'||!/^\d{1,9}(\.\d{1,2})?$/.test(v)||Number(v)<=0)fail(400,'Enter a positive amount with at most two decimals.');const [a,b='']=v.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));};
const date=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)fail(400,'Enter a valid date.');return v;};
const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function handleBusiness(request,env){
 try{
  const url=new URL(request.url), route=url.pathname.replace(/^\/api\/business\/?/,'').split('/').filter(Boolean),method=request.method;
  if(route.join('/')==='health'&&method==='GET')return json({status:'ok',storage:!!env.DB,uploads:!!env.BUCKET,mode:'manual-payment-records'});
  const uid=request.headers.get('oai-authenticated-user-id'),mail=request.headers.get('oai-authenticated-user-email');
  if(!uid||!mail)fail(401,'Sign in to access your company workspace.');
  if(method!=='GET'&&(request.headers.get('Origin')!==url.origin||request.headers.get('X-Treasury-Request')!=='1'))fail(403,'Request origin could not be verified.');
  const db=env.DB;if(!db)fail(503,'Database is not available.');
  const one=(sql,...args)=>db.prepare(sql).bind(...args).first();
  const all=async(sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
  const stmt=(sql,...args)=>db.prepare(sql).bind(...args);
  const body=async()=>{if(Number(request.headers.get('content-length')||0)>200000)fail(413,'Request is too large.');let s=await request.text();if(s.length>200000)fail(413,'Request is too large.');try{const v=JSON.parse(s);if(!v||typeof v!=='object'||Array.isArray(v))throw 0;return v;}catch{fail(400,'Invalid request body.');}};
  const log=(cid,action,detail,invoice=null,eventId=id())=>stmt('INSERT INTO events (id,company_id,invoice_id,actor,action,detail,created_at) VALUES (?,?,?,?,?,?,?)',eventId,cid,invoice,mail,action,detail,now());
  if(route.length===0&&method==='GET')return json({user:{id:uid,email:mail},companies:await all('SELECT c.*,m.role FROM companies c JOIN members m ON m.company_id=c.id WHERE m.user_id=? ORDER BY c.created_at',uid)});
  if(route[0]==='companies'&&route.length===1&&method==='POST'){
   const b=await body(),cid=id(),name=text(b.name,'Company name',100),currency=b.currency;
   if(!['INR','USD','EUR','GBP'].includes(currency))fail(400,'Choose a supported currency.');
   const threshold=cents(b.threshold||'5000');
   if((await one('SELECT COUNT(*) n FROM members WHERE user_id=? AND role=?',uid,'owner')).n>=10)fail(409,'You can own up to 10 workspaces.');
   await db.batch([stmt('INSERT INTO companies VALUES (?,?,?,?,?)',cid,name,currency,threshold,now()),stmt('INSERT INTO members VALUES (?,?,?,?)',cid,uid,mail.toLowerCase(),'owner'),log(cid,'COMPANY_CREATED',name)]);return json({id:cid},201);
  }
  if(route[0]==='accept'&&method==='POST'){
   const b=await body(),token=text(b.token,'Invitation code',200),digest=await hash(token),inv=await one('SELECT * FROM invites WHERE token_hash=?',digest);
   if(!inv||inv.accepted_by||inv.expires_at<now())fail(400,'Invitation is invalid, expired or already used.');
   if(inv.email!==mail.toLowerCase())fail(403,'Sign in with the email address on this invitation.');
   if(await one('SELECT 1 FROM members WHERE company_id=? AND user_id=?',inv.company_id,uid))fail(409,'You already belong to this company.');
   const r=await db.batch([stmt('UPDATE invites SET accepted_by=? WHERE id=? AND accepted_by IS NULL AND expires_at>?',uid,inv.id,now()),stmt('INSERT INTO members SELECT company_id,?,email,role FROM invites WHERE id=? AND accepted_by=?',uid,inv.id,uid),log(inv.company_id,'INVITE_ACCEPTED',inv.role)]);
   if(!r[0].meta.changes)fail(409,'Invitation has already been used.');return json({id:inv.company_id});
  }
  const cid=route[0], member=await one('SELECT m.*,c.currency,c.threshold,c.name FROM members m JOIN companies c ON c.id=m.company_id WHERE m.company_id=? AND m.user_id=?',cid,uid);
  if(!member)fail(403,'You do not have access to this company.');
  const permit=(...allowed)=>{if(!allowed.includes(member.role))fail(403,'Your role cannot perform this action.');};
  const resource=route[1],rid=route[2];
  if(resource==='state'&&method==='GET'){
   const [suppliers,invoices,approvals,files,members,events,invites]=await Promise.all([
    all('SELECT * FROM suppliers WHERE company_id=? ORDER BY name',cid),
    all('SELECT i.*,s.name supplier_name FROM invoices i JOIN suppliers s ON s.id=i.supplier_id WHERE i.company_id=? ORDER BY i.created_at DESC LIMIT 2000',cid),
    all("SELECT a.*,COALESCE(m.email,'Former team member') email FROM approvals a JOIN invoices i ON i.id=a.invoice_id LEFT JOIN members m ON m.user_id=a.user_id AND m.company_id=i.company_id WHERE i.company_id=?",cid),
    all('SELECT * FROM files WHERE company_id=? ORDER BY created_at',cid),
    all('SELECT user_id,email,role FROM members WHERE company_id=?',cid),
    all('SELECT * FROM events WHERE company_id=? ORDER BY created_at DESC LIMIT 500',cid),
    member.role==='owner'?all('SELECT id,email,role,expires_at,accepted_by FROM invites WHERE company_id=? ORDER BY expires_at DESC',cid):Promise.resolve([])
   ]);return json({totalInvoices:(await one('SELECT COUNT(*) n FROM invoices WHERE company_id=?',cid)).n,recordLimit:2000,company:{id:cid,name:member.name,currency:member.currency,threshold:member.threshold},role:member.role,suppliers,invoices,approvals,files,members,events,invites});
  }
  if(resource==='invites'&&method==='POST'){
   permit('owner');const b=await body(),address=email(b.email),role=b.role;if(!roles.slice(1).includes(role))fail(400,'Choose a valid team role.');
   if(await one('SELECT 1 FROM members WHERE company_id=? AND email=?',cid,address))fail(409,'This person already belongs to the company.');
   const token=id()+id(),expires=new Date(Date.now()+7*86400000).toISOString(),iid=id();
   await db.batch([stmt('INSERT INTO invites VALUES (?,?,?,?,?,?,NULL)',iid,cid,address,role,await hash(token),expires),log(cid,'INVITE_CREATED',`${address} · ${role}`)]);return json({token,expiresAt:expires,email:address},201);
  }
  if(resource==='invites'&&rid&&method==='DELETE'){permit('owner');await db.batch([stmt('DELETE FROM invites WHERE id=? AND company_id=? AND accepted_by IS NULL',rid,cid),log(cid,'INVITE_REVOKED',rid)]);return json({ok:true});}
  if(resource==='members'&&rid&&method==='DELETE'){
   permit('owner');const target=await one('SELECT * FROM members WHERE company_id=? AND user_id=?',cid,rid);
   if(!target)fail(404,'Team member not found.');if(target.role==='owner')fail(409,'The company owner cannot be removed.');
   await db.batch([
    stmt("DELETE FROM approvals WHERE user_id=? AND invoice_id IN (SELECT id FROM invoices WHERE company_id=? AND status IN ('SUBMITTED','APPROVED'))",rid,cid),
    stmt("UPDATE invoices SET status='SUBMITTED',version=version+1,action_id=? WHERE company_id=? AND status='APPROVED' AND (SELECT COUNT(*) FROM approvals WHERE invoice_id=invoices.id)<required",id(),cid),
    stmt('DELETE FROM members WHERE company_id=? AND user_id=?',cid,rid),
    log(cid,'MEMBER_REMOVED',target.email+' · unpaid invoices require remaining valid approvals')
   ]);return json({ok:true});
  }
  if(resource==='suppliers'&&method==='POST'){
   permit('owner','accountant');const b=await body(),sid=id(),name=text(b.name,'Supplier name',120),address=email(b.email),category=text(b.category,'Category',80);
   await db.batch([stmt('INSERT INTO suppliers VALUES (?,?,?,?,?,1,?)',sid,cid,name,address,category,now()),log(cid,'SUPPLIER_CREATED',name)]);return json({id:sid},201);
  }
  if(resource==='suppliers'&&rid&&method==='PATCH'){
   permit('owner','accountant');const b=await body();if(!await one('SELECT 1 FROM suppliers WHERE id=? AND company_id=?',rid,cid))fail(404,'Supplier not found.');
   const name=text(b.name,'Supplier name',120),address=email(b.email),category=text(b.category,'Category',80);if(typeof b.active!=='boolean')fail(400,'Choose supplier status.');
   await db.batch([stmt('UPDATE suppliers SET name=?,email=?,category=?,active=? WHERE id=? AND company_id=?',name,address,category,b.active?1:0,rid,cid),log(cid,'SUPPLIER_UPDATED',name)]);return json({ok:true});
  }
  if(resource==='invoices'&&route.length===2&&method==='POST'){
   permit('owner','creator','accountant');const b=await body(),iid=id(),sid=text(b.supplierId,'Supplier'),number=text(b.number,'Invoice number',80).toUpperCase(),amount=cents(b.amount),due=date(b.dueDate),description=text(b.description,'Description',1000);
   if(!await one('SELECT 1 FROM suppliers WHERE id=? AND company_id=? AND active=1',sid,cid))fail(400,'Choose an active supplier.');
   await db.batch([stmt('INSERT INTO invoices (id,company_id,supplier_id,number,amount,due_date,description,creator_id,status,required,version,action_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?)',iid,cid,sid,number,amount,due,description,uid,'SUBMITTED',amount>member.threshold?2:1,id(),now()),log(cid,'INVOICE_SUBMITTED',`${number} · ${member.currency} ${b.amount}`,iid)]);return json({id:iid},201);
  }
  if(resource==='invoices'&&rid){
   const invoice=await one('SELECT * FROM invoices WHERE id=? AND company_id=?',rid,cid);if(!invoice)fail(404,'Invoice not found.');
   const action=route[3];
   if(action==='files'&&method==='POST'){
    if(!env.BUCKET)fail(503,'File storage is not available.');
    const kind=url.searchParams.get('kind')==='receipt'?'receipt':'invoice';
    if(kind==='receipt')permit('owner','accountant');else {permit('owner','creator','accountant');if(invoice.creator_id!==uid&&member.role!=='owner')fail(403,'Only the creator or owner may attach an invoice.');if(invoice.status!=='SUBMITTED'||await one('SELECT 1 FROM approvals WHERE invoice_id=?',rid))fail(409,'Invoice documents are locked after the first approval.');}
    if((await one('SELECT COUNT(*) n FROM files WHERE invoice_id=?',rid)).n>=10)fail(409,'An invoice can have up to 10 attachments.');
    if(Number(request.headers.get('content-length')||0)>5*1024*1024)fail(413,'PDF must be 5 MB or smaller.');
    const reader=request.body?.getReader();if(!reader)fail(400,'Upload a PDF file.');const chunks=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5*1024*1024){await reader.cancel();fail(413,'PDF must be 5 MB or smaller.');}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')fail(400,'Only PDF files are accepted.');
    const fid=id(),name=text(url.searchParams.get('name'),'File name',160).replace(/[^\w. ()-]/g,'_');
    await env.BUCKET.put(`${cid}/${fid}`,bytes,{httpMetadata:{contentType:'application/pdf'}});
    const token=id();try{
     const r=await db.batch([stmt("UPDATE invoices SET version=version+1,action_id=? WHERE id=? AND company_id=? AND version=? AND (?='receipt' OR (status='SUBMITTED' AND NOT EXISTS (SELECT 1 FROM approvals WHERE invoice_id=invoices.id)))",token,rid,cid,invoice.version,kind),stmt('INSERT INTO files SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM invoices WHERE id=? AND action_id=?)',fid,cid,rid,name,kind,size,uid,now(),rid,token),stmt('INSERT INTO events SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM invoices WHERE id=? AND action_id=?)',id(),cid,rid,mail,'FILE_UPLOADED',name,now(),rid,token)]);
     if(!r[0].meta.changes){await env.BUCKET.delete(`${cid}/${fid}`);fail(409,'Invoice changed during upload. Refresh and try again.');}
    }catch(e){await env.BUCKET.delete(`${cid}/${fid}`);throw e;}return json({id:fid},201);
   }
   if(method==='POST'&&action==='revise'){
    permit('owner','creator','accountant');if(invoice.creator_id!==uid&&member.role!=='owner')fail(403,'Only the creator or owner may revise this invoice.');
    const b=await body();if(invoice.status!=='REJECTED'||b.version!==invoice.version)fail(409,'Only rejected invoices can be revised. Refresh and try again.');
    const amount=cents(b.amount),due=date(b.dueDate),description=text(b.description,'Description',1000),token=id();
    if(!await one('SELECT 1 FROM suppliers WHERE id=? AND company_id=? AND active=1',invoice.supplier_id,cid))fail(409,'Reactivate this supplier before resubmitting.');
    const r=await db.batch([
     stmt("UPDATE invoices SET amount=?,due_date=?,description=?,required=?,status='SUBMITTED',version=version+1,action_id=? WHERE id=? AND company_id=? AND version=? AND status='REJECTED'",amount,due,description,amount>member.threshold?2:1,token,rid,cid,b.version),
     stmt('DELETE FROM approvals WHERE invoice_id=? AND EXISTS (SELECT 1 FROM invoices WHERE id=? AND action_id=?)',rid,rid,token),
     stmt('INSERT INTO events SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM invoices WHERE id=? AND action_id=?)',id(),cid,rid,mail,'INVOICE_REVISED',JSON.stringify({before:{amount:invoice.amount,dueDate:invoice.due_date,description:invoice.description},after:{amount,dueDate:due,description}}),now(),rid,token)
    ]);if(!r[0].meta.changes)fail(409,'Invoice changed. Refresh and try again.');return json({ok:true});
   }
   if(method==='POST'&&['approve','reject','record-payment','reconcile'].includes(action)){
    const b=await body();if(!Number.isInteger(b.version)||b.version!==invoice.version)fail(409,'This invoice changed. Refresh before continuing.');
    const token=id(),stamp=now();let update,detail='';
    if(action==='approve'){
     permit('owner','manager');if(invoice.creator_id===uid)fail(403,'You cannot approve your own invoice.');if(invoice.status!=='SUBMITTED')fail(409,'This invoice is not awaiting approval.');
     if(await one('SELECT 1 FROM approvals WHERE invoice_id=? AND user_id=?',rid,uid))fail(409,'You have already approved this invoice.');
     const results=await db.batch([
      stmt("INSERT INTO approvals SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM invoices WHERE id=? AND company_id=? AND version=? AND status='SUBMITTED')",token,rid,uid,stamp,rid,cid,b.version),
      stmt("UPDATE invoices SET status=CASE WHEN (SELECT COUNT(*) FROM approvals WHERE invoice_id=?)>=required THEN 'APPROVED' ELSE 'SUBMITTED' END,version=version+1,action_id=? WHERE id=? AND EXISTS (SELECT 1 FROM approvals WHERE id=?)",rid,token,rid,token),
      stmt('INSERT INTO events SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM approvals WHERE id=?)',id(),cid,rid,mail,'APPROVED','Manager approval recorded',stamp,token)]);
     if(!results[0].meta.changes)fail(409,'Invoice changed. Refresh and try again.');return json({ok:true});
    }
    if(action==='reject'){permit('owner','manager');if(invoice.creator_id===uid)fail(403,'You cannot review your own invoice.');if(invoice.status!=='SUBMITTED')fail(409,'Only pending invoices can be rejected.');detail=text(b.reason,'Reason',500);update=stmt("UPDATE invoices SET status='REJECTED',version=version+1,action_id=? WHERE id=? AND company_id=? AND version=? AND status='SUBMITTED'",token,rid,cid,b.version);}
    if(action==='record-payment'){
     permit('owner','accountant');if(invoice.status!=='APPROVED')fail(409,'Complete all approvals before recording payment.');
     const ref=text(b.reference,'Bank reference',100).toUpperCase(),paid=date(b.paidAt);if(paid>stamp.slice(0,10))fail(400,'Payment date cannot be in the future.');detail=text(b.note,'Payment note',500);
     update=stmt("UPDATE invoices SET status='PAID_RECORDED',payment_ref=?,paid_at=?,payment_note=?,version=version+1,action_id=? WHERE id=? AND company_id=? AND version=? AND status='APPROVED' AND (SELECT COUNT(*) FROM approvals WHERE invoice_id=?)>=required",ref,paid,detail,token,rid,cid,b.version,rid);detail=`Manual payment recorded · ${ref} · ${detail}`;
    }
    if(action==='reconcile'){
     permit('owner','accountant');if(invoice.status!=='PAID_RECORDED')fail(409,'Record the payment before reconciliation.');
     const ref=text(b.reference,'Statement reference',100).toUpperCase(),amount=cents(b.amount),evidence=text(b.evidence,'Statement evidence',500);
     if(ref!==invoice.payment_ref||amount!==invoice.amount)fail(409,'Statement amount or reference does not match. No changes were made.');
     update=stmt("UPDATE invoices SET status='RECONCILED',version=version+1,action_id=? WHERE id=? AND company_id=? AND version=? AND status='PAID_RECORDED'",token,rid,cid,b.version);detail=`Manual statement match · ${ref} · ${evidence}`;
    }
    const r=await db.batch([update,stmt('INSERT INTO events SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM invoices WHERE id=? AND action_id=?)',id(),cid,rid,mail,action.toUpperCase().replaceAll('-','_'),detail,stamp,rid,token)]);
    if(!r[0].meta.changes)fail(409,'Invoice changed. Refresh and try again.');return json({ok:true});
   }
  }
  if(resource==='files'&&rid&&method==='GET'){
   const f=await one('SELECT * FROM files WHERE id=? AND company_id=?',rid,cid);if(!f)fail(404,'Attachment not found.');const blob=await env.BUCKET.get(`${cid}/${rid}`);if(!blob)fail(404,'Attachment not found.');
   return new Response(blob.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${f.name.replace(/["\\\r\n]/g,'_')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox"}});
  }
  fail(404,'Endpoint not found.');
 }catch(e){if(e instanceof Failure)return json({error:e.message},e.status);if(/UNIQUE constraint failed/.test(String(e)))return json({error:'This invoice, approval or payment reference already exists.'},409);console.error('Business API failure',e?.name);return json({error:'The request could not be completed. Please retry.'},500);}
}
