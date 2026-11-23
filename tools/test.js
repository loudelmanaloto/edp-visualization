/* Tests for the built index.html: node test.js <index.html> [seeds] [oracleSeeds] */
const fs=require('fs'), vm=require('vm'), os=require('os'), path=require('path'), cp=require('child_process');
const file=process.argv[2], SEEDS=+(process.argv[3]||400), OSEEDS=+(process.argv[4]||60);
const html=fs.readFileSync(file,'utf8');
const blocks=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const G={}; G.window=G; G.globalThis=G;
vm.createContext(G);
blocks.slice(0,3).forEach((b,i)=>vm.runInContext(b,G,{filename:'block'+i}));
const SIM=G.EDP_SIM, A=G.EDP_ACT, GL=G.EDP_GLOSSARY;
let fails=0, checks=0;
const bad=(msg,ctx)=>{fails++; if(fails<=40) console.log('FAIL:',msg,ctx?JSON.stringify(ctx).slice(0,400):'');};
const ok=(c,msg,ctx)=>{checks++; if(!c) bad(msg,ctx);};
const BADTXT=/undefined|NaN|\[object|null null/;

/* ---------- frames sanity ---------- */
function checkFrames(F,lines,tag){
  ok(F.length>0,tag+' has frames');
  F.forEach((f,i)=>{
    ok(typeof f.msg==='string'&&f.msg.length>5,tag+' frame msg',{i});
    ok(!BADTXT.test(f.msg),tag+' frame text clean',{i,msg:f.msg});
    ok(f.line>=0&&f.line<=lines.length,tag+' line in range',{i,line:f.line,n:lines.length});
  });
  ok(F[F.length-1].kind==='ok'||F[F.length-1].kind==='error',tag+' ends with result');
}
for(const k in SIM.EL_PRESETS){const r=SIM.elRun(SIM.EL_PRESETS[k].prog); checkFrames(r.F,r.lines,'loop:'+k);}
const expect={basic:'A C B',promise:'1 4 3 2',timers:'sync fast medium slow',nested:'start end P1 T1 P2 T2',calls:'start hello HELLO! end',blocking:'done timer clicked'};
for(const k in expect) ok(SIM.elRun(SIM.EL_PRESETS[k].prog).out.join(' ')===expect[k],'loop preset output '+k);
for(const k in SIM.DOM_PRESETS) for(const t of ['button','li','ul']){const cfg=Object.assign(SIM.clone(SIM.DOM_PRESETS[k].cfg),{target:t}); const r=SIM.domRun(cfg); checkFrames(r.F,r.lines,'dom:'+k+':'+t);}
for(const k in SIM.EXP_REQS){const r=SIM.expRun(SIM.EXP_REQS[k].req); checkFrames(r.F,SIM.EXP_CODE.lines,'exp:'+k);}
for(const s of ['ok','404','offline']) checkFrames(SIM.fetchRun(s).F,SIM.FETCH_CODE.lines,'fetch:'+s);
/* observer ops */
{
  for(const mode of ['observer','pubsub']){
    let st=SIM.obsNew(mode); const names=['logger','badge','emailer','chart'], topics=['news','sports','weather'];
    let rng=G.EDP_ACT.mulberry(7);
    for(let i=0;i<300;i++){
      const op=Math.floor(rng()*5), n=names[Math.floor(rng()*4)], t=topics[Math.floor(rng()*3)];
      const r=op===0?SIM.obsSub(st,n,t):op===1?SIM.obsUnsub(st,n,t):op===2?SIM.obsNotify(st,t):SIM.obsDestroy(st,n,op===3);
      r.F.forEach((f,j)=>{ok(!BADTXT.test(f.msg),'obs msg clean',{op,msg:f.msg}); ok(f.line>=0&&f.line<=SIM.OBS_CODE[mode].lines.length,'obs line');});
      st=r.st;
    }
  }
}
/* dispatcher ops vs a plain re-implementation */
{
  let rng=A.mulberry(11);
  for(let i=0;i<300;i++){
    let st=SIM.dispNew(); const types=['login','addItem','orderPlaced','logout','search'];
    const n=1+Math.floor(rng()*5); for(let k=0;k<n;k++) st=SIM.dispEmit(st,types[Math.floor(rng()*5)]).st;
    for(const safe of [true,false]){
      const r=SIM.dispRun(st,SIM.DISP_REG,safe); checkFrames(r.F,SIM.DISP_CODE(safe).lines,'disp');
      const q=st.queue.map(e=>e.type), calls=[]; let crashed=false;
      outer: while(q.length){const t=q.shift(); for(const h of (SIM.DISP_REG[t]||[])){calls.push(h.name); if(h.throws){if(safe) continue; crashed=true; break outer;} (h.emits||[]).forEach(x=>q.push(x));}}
      ok(JSON.stringify(calls)===JSON.stringify(r.calls),'dispatcher matches reference',{calls,got:r.calls});
      ok(crashed===!!r.st.crashed&&(!crashed||q.length===r.st.queue.length),'dispatcher crash state');
    }
  }
}
/* timing: frames agree with pure answers */
{
  let rng=A.mulberry(5);
  for(let i=0;i<500;i++){
    const n=1+Math.floor(rng()*12), ev=[...new Set(Array.from({length:n},()=>Math.floor(rng()*60)*50))].sort((a,b)=>a-b);
    const w=[200,300,500,800][Math.floor(rng()*4)];
    for(const m of ['debounce','throttle']){
      const r=SIM.timingRun(ev,w,m); checkFrames(r.F,SIM.TIMING_CODE[m].lines,'timing');
      const want=m==='debounce'?SIM.debounceFires(ev,w):SIM.throttleFires(ev,w);
      ok(JSON.stringify(r.fires)===JSON.stringify(want),'timing frames vs pure',{ev,w,m,got:r.fires,want});
    }
  }
}
/* calculator: frames agree with calcApply */
{
  let rng=A.mulberry(3); const K='0123456789+-*=C';
  for(let i=0;i<400;i++){
    let a=SIM.CALC_NEW(), b=SIM.CALC_NEW(); const len=1+Math.floor(rng()*12);
    for(let j=0;j<len;j++){const k=K[Math.floor(rng()*K.length)]; const r=SIM.calcPress(a,k); checkFrames(r.F,SIM.CALC_CODE.lines,'calc'); a=r.st; b=SIM.calcApply(b,k);}
    ok(JSON.stringify(a)===JSON.stringify(b),'calcPress == calcApply',{a,b});
  }
}

/* ---------- activities: structure for many seeds ---------- */
const sids=[]; for(let i=0;i<SEEDS;i++) sids.push(String(202300000+i*7919));
const oracleItems=[];
for(const act of A.ACTS){
  const kindCount={};
  for(const sid of sids){
    let items;
    try{items=act.build(sid);}catch(e){bad('build threw '+act.id+' '+sid+' '+e.stack); continue;}
    ok(items.length===25,act.id+' has 25 items',{sid,n:items.length});
    ok(JSON.stringify(items)===JSON.stringify(act.build(sid)),act.id+' deterministic');
    const prompts=new Set();
    items.forEach((it,n)=>{
      const ctx={act:act.id,sid,n,prompt:it.prompt.slice(0,120)};
      ok(typeof it.prompt==='string'&&it.prompt.length>10,'prompt',ctx);
      ok(!BADTXT.test(it.prompt+(it.given||'')),'prompt/given clean',Object.assign({given:it.given},ctx));
      const key=it.prompt+'|'+(it.given||'');
      ok(!prompts.has(key),'no duplicate item',ctx); prompts.add(key);
      if(it.type==='choice'){
        ok(it.choices.length===4||it.choices.length===2,'choice count',ctx);
        ok(new Set(it.choices.map(String)).size===it.choices.length,'choices distinct',Object.assign({choices:it.choices},ctx));
        ok(it.choices.every(c=>!/NaN|\[object/.test(String(c))),'choices clean',ctx);
        const ai=+it.answer; ok(ai>=0&&ai<it.choices.length,'answer index',ctx);
        ok(A.isRight(it,it.answer),'choice self-grade',ctx);
        ok(!A.isRight(it,String((ai+1)%it.choices.length)),'wrong choice fails',ctx);
      }else{
        ok(it.answer!==''&&it.answer!==undefined,'answer present',ctx);
        ok(A.norm(it.type,it.answer)===it.answer,'answer normalized',Object.assign({answer:it.answer},ctx));
        const typed=it.type==='list'?it.answer.split(',').join(', ').toLowerCase():it.answer;
        ok(A.isRight(it,typed),'typed answer grades right',Object.assign({answer:it.answer,typed},ctx));
        ok(!A.isRight(it,''),'blank is wrong',ctx);
        if(it.type==='number') ok(/^-?\d+$/.test(it.answer),'numeric answer',Object.assign({answer:it.answer},ctx));
      }
      if(it.oracle&&sids.indexOf(sid)<OSEEDS){oracleItems.push({act:act.id,sid,n,it}); kindCount[it.oracle.kind]=(kindCount[it.oracle.kind]||0)+1;}
    });
  }
  console.log('built',act.id,'x',sids.length,'oracles',JSON.stringify(kindCount));
}
/* answer spread: no list/number answer should be the same for every student */
for(const act of A.ACTS){
  const per={};
  sids.slice(0,60).forEach(sid=>act.build(sid).forEach((it,n)=>{if(it.type!=='choice'){(per[n]=per[n]||new Set()).add(it.answer);}}));
  Object.keys(per).forEach(n=>{if(per[n].size<2) console.log('note: same answer for all students',act.id,'item',+n+1,[...per[n]][0]);});
}
/* glossary */
for(const k in GL){const terms=GL[k].map(x=>x[0]), defs=GL[k].map(x=>x[1]); ok(new Set(terms).size===terms.length&&new Set(defs).size===defs.length,'glossary distinct '+k); ok(GL[k].length>=12,'glossary size '+k);}

/* ---------- oracles ---------- */
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'edp-'));
function runNode(src){const f=path.join(tmp,'p'+Math.random().toString(36).slice(2)+'.js'); fs.writeFileSync(f,src); try{return cp.execFileSync(process.execPath,[f],{encoding:'utf8',timeout:10000}).trim().split(/\r?\n/).filter(Boolean);}finally{fs.unlinkSync(f);}}
function loopSrc(o){
  return 'function busyWait(ms){const e=Date.now()+ms; while(Date.now()<e){}}\n'+
   'const btn={addEventListener(t,f){this.f=f;}};\n'+
   o.events.map(e=>'setTimeout(()=>{ if(btn.f) btn.f(); },'+e.at+');').join('\n')+'\n'+o.lines.join('\n');
}
const OBS_SRC=(o,body)=>o.subject.join('\n')+'\nconst calls=[];\n'+(o.fns||[]).map(f=>'function '+f+'(d){ calls.push("'+f+'"); }').join('\n')+'\n'+body;
function dispatchRun(o){
  const ctx={console:{error(){}}}; vm.createContext(ctx);
  vm.runInContext(o.code.join('\n')+'\nthis.emit=emit; this.dispatchAll=dispatchAll; this.queue=queue;',ctx);
  const calls=[]; const handlers={};
  Object.keys(o.reg).forEach(t=>{handlers[t]=o.reg[t].map(h=>function(){calls.push(h.name); if(h.throws) throw new Error(h.throws); (h.emits||[]).forEach(x=>ctx.emit(x));});});
  ctx.handlers=handlers; vm.runInContext('var handlers=this.handlers;',ctx);
  o.emits.forEach(t=>ctx.emit(t));
  let threw=false; try{ctx.dispatchAll();}catch(e){threw=true;}
  return {calls,left:ctx.queue.length,threw};
}
function timingRun(o){
  let now=0; const timers=[]; let id=1;
  const ctx={Date:{now:()=>now},setTimeout:(f,ms)=>{timers.push({id:id,due:now+ms,f}); return id++;},clearTimeout:x=>{const i=timers.findIndex(t=>t.id===x); if(i>=0) timers.splice(i,1);}};
  vm.createContext(ctx); vm.runInContext(SIM.TIMING_CODE[o.mode].lines.join('\n')+'\nthis.wrap='+o.mode+';',ctx);
  const fires=[]; const w=ctx.wrap(()=>fires.push(now),o.wait);
  const runDue=limit=>{for(;;){timers.sort((a,b)=>a.due-b.due); if(!timers.length||timers[0].due>limit) break; const t=timers.shift(); now=t.due; t.f();}};
  o.events.forEach(t=>{runDue(t-1); now=t; w();}); runDue(Infinity);
  return fires;
}
function calcRunReal(seq){
  const display={textContent:'0'}; let handler=null;
  const ctx={document:{querySelector:s=>s==='#display'?display:{addEventListener:(t,f)=>{handler=f;}}},calc:(a,op,b)=>op==='+'?a+b:op==='-'?a-b:a*b};
  vm.createContext(ctx); vm.runInContext(SIM.CALC_CODE.lines.join('\n').replace('const state','var state')+'\nvar __eq=0; var __orig=onEquals; onEquals=function(){__eq++; return __orig();};',ctx);
  seq.forEach(k=>{const type=/\d/.test(k)?'digit':k==='='?'equals':k==='C'?'clear':'op'; const btn={dataset:{type,value:/\d/.test(k)||type==='op'?k:''}}; handler({target:{closest:()=>btn}});});
  return {shown:display.textContent,stored:ctx.state.stored,eq:vm.runInContext('__eq',ctx)};
}
function expressRef(q){
  /* independent mini-Express with the same seven registrations */
  const ran=[]; let err=null, status=null;
  const users={7:1,12:1};
  const stack=[
    {name:'logger',m:null,fn:(next)=>next()},
    {name:'express.json()',m:null,fn:(next)=>q.body==='bad'?next({s:400}):next()},
    {name:'requireAuth',m:p=>p==='/api'||p.startsWith('/api/'),fn:(next)=>{if(!q.token){status=401;return;} next();}},
    {name:'getUser',m:p=>q.method==='GET'&&/^\/api\/users\/\d+$/.test(p),fn:(next)=>{const id=+q.path.split('/').pop(); if(users[id]) status=200; else next({s:404});}},
    {name:'createUser',m:p=>q.method==='POST'&&p==='/api/users',fn:(next)=>{if(q.body==='json') status=201; else next({s:400});}},
    {name:'notFound',m:null,fn:()=>{status=404;}},
    {name:'errorHandler',m:null,err:true,fn:()=>{status=err.s;}}
  ];
  let i=0;
  const next=e=>{if(e) err=e; while(i<stack.length){const s=stack[i++]; if(!!s.err!==!!err) continue; if(s.m&&!s.m(q.path)) continue; ran.push(s.name); s.fn(next); return;}};
  next();
  return {status,ran};
}
let oracleN=0;
for(const {act,sid,n,it} of oracleItems){
  const o=it.oracle, ctx={act,sid,n,kind:o.kind};
  try{
    if(o.kind==='loop'){const out=runNode(loopSrc(o)); ok(JSON.stringify(out)===JSON.stringify(o.out),'loop oracle',Object.assign({out,want:o.out},ctx));}
    else if(o.kind==='node'){const out=runNode(o.src); ok(JSON.stringify(out)===JSON.stringify(o.out),'node oracle',Object.assign({out,want:o.out,src:o.src},ctx));}
    else if(o.kind==='observer'){
      const c={}; vm.createContext(c); vm.runInContext(OBS_SRC(o,o.lines.join('\n')+'\nthis.calls=calls; this.s=s;\nthis.marks=[]; '),c);
      /* replay to find the last notify's callers */
      const c2={}; vm.createContext(c2);
      const lastIdx=o.lines.map((l,i)=>l.startsWith('s.notify')?i:-1).filter(i=>i>=0).pop();
      vm.runInContext(OBS_SRC(o,o.lines.slice(0,lastIdx).join('\n')+'\nconst before=calls.length;\n'+o.lines[lastIdx]+'\nthis.last=calls.slice(before);'),c2);
      if(o.ask==='last') ok(JSON.stringify(c2.last)===JSON.stringify(o.want),'observer last oracle',Object.assign({got:c2.last,want:o.want},ctx));
      if(o.ask==='count') ok(c.calls.filter(x=>x===o.fn).length===o.want,'observer count oracle',ctx);
      if(o.ask==='len') ok(c.s.observers.length===o.want,'observer len oracle',ctx);
    }
    else if(o.kind==='pubsub'){
      const fns=[...new Set(o.lines.map(l=>(l.match(/subscribe\('[^']+', (\w+)\)/)||[])[1]).filter(Boolean))];
      const c={}; vm.createContext(c); vm.runInContext(SIM.OBS_CODE.pubsub.lines.join('\n')+'\nconst calls=[]; const data=1;\n'+fns.map(f=>'function '+f+'(){calls.push(1);}').join('\n')+'\n'+o.lines.join('\n')+'\nthis.n=calls.length;',c);
      ok(c.n===o.want,'pubsub oracle',Object.assign({got:c.n,want:o.want},ctx));
    }
    else if(o.kind==='arrow'){
      const c={printed:0}; c.console={log:()=>{c.printed++;}}; vm.createContext(c); vm.runInContext(o.subject.join('\n')+'\n'+o.lines.join('\n'),c);
      ok(c.printed===o.want,'arrow oracle',ctx);
    }
    else if(o.kind==='dispatch'){const r=dispatchRun(o); ok(JSON.stringify(r.calls)===JSON.stringify(o.want),'dispatch oracle',Object.assign({got:r.calls,want:o.want},ctx));}
    else if(o.kind==='dispatchLeft'){const r=dispatchRun(o); ok(r.left===o.want&&r.threw,'dispatch left oracle',Object.assign({got:r.left,want:o.want},ctx));}
    else if(o.kind==='timing'){const f=timingRun(o); ok(JSON.stringify(f)===JSON.stringify(o.want),'timing oracle',Object.assign({got:f,want:o.want,o},ctx));}
    else if(o.kind==='calc'){const r=calcRunReal(o.seq); ok(r.shown===String(o.want),'calc oracle',Object.assign({got:r.shown,want:o.want,seq:o.seq},ctx));}
    else if(o.kind==='calcStored'){const r=calcRunReal(o.seq); ok(r.stored===o.want,'calc stored oracle',Object.assign({got:r.stored,want:o.want},ctx));}
    else if(o.kind==='calcEq'){const r=calcRunReal(o.seq); ok(r.eq===o.want,'calc equals oracle',Object.assign({got:r.eq,want:o.want},ctx));}
    else if(o.kind==='express'){const r=expressRef(o.req); ok(r.status===o.status&&JSON.stringify(r.ran)===JSON.stringify(o.ran),'express oracle',Object.assign({ref:r,status:o.status,ran:o.ran,req:o.req},ctx));}
    else if(o.kind==='dom'||o.kind==='wiring'){continue;} /* checked in the browser */
    else bad('unknown oracle '+o.kind);
    oracleN++;
  }catch(e){bad('oracle threw '+o.kind+' '+e.message,ctx);}
}
/* express: every request combination */
for(const method of ['GET','POST']) for(const p of ['/api/users/7','/api/users/12','/api/users/99','/api/users','/about','/','/api/orders','/contact','/api']) for(const token of [true,false]) for(const body of ['none','json','bad']){
  const q={method,path:p,token,body}, a=SIM.expRun(q), b=expressRef(q);
  ok(a.status===b.status&&JSON.stringify(a.ran)===JSON.stringify(b.ran),'express all combos',{q,a:[a.status,a.ran],b});
}
fs.rmSync(tmp,{recursive:true,force:true});
console.log('oracle items run:',oracleN);
console.log(fails?('FAILED '+fails+' of '+checks+' checks'):('ALL PASSED: '+checks+' checks'));
process.exit(fails?1:0);
