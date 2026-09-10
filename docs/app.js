/* Career OS frontend — vanilla JS, no deps. Talks to /api/* (see server.py). */
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const today=()=>new Date().toISOString().slice(0,10);
async function api(m,p,b){const r=await fetch(p,{method:m,headers:{"Content-Type":"application/json"},body:b?JSON.stringify(b):undefined});if(!r.ok)throw new Error(await r.text());const ct=r.headers.get("content-type")||"";return ct.includes("json")?r.json():r.text();}
let MODE="api";
const GET=p=>MODE==="api"?api("GET",p):LGET(p),POST=(p,b)=>MODE==="api"?api("POST",p,b):LPOST(p,b),PUT=(p,b)=>MODE==="api"?api("PUT",p,b):LPUT(p,b),DEL=p=>MODE==="api"?api("DELETE",p):LDEL(p);
function toast(m){const d=document.createElement("div");d.textContent=m;$("#toast").append(d);setTimeout(()=>d.remove(),3200);}
async function award(ach,base,cat,notes){try{const x=await POST("/api/award",{achievement:ach,base,category:cat||"General",notes:notes||""});S.xp=x;renderLvl();toast(`+${base} XP — ${ach} (Lv ${x.level})`);}catch(e){toast("XP failed: "+e.message);}}

/* ---------- field schemas: key -> [label, type, options] ---------- */
const F={
kpis:{t:"KPI",cols:["period","metric","category","actual","target","variance_pct","yoy","status"],fields:{period:["Period","text"],metric:["Metric","text"],category:["Category","select",["Premium","Growth","Claims","Retention","Profitability","Finance","Distribution"]],actual:["Actual","number"],target:["Target","number"],prior_period:["Prior period","number"],prior_year:["Prior year","number"],driver:["Driver / explanation","textarea"],implication:["Business implication","textarea"],action:["Recommended action","textarea"],owner:["Owner","text"],status:["Status","select",["on-track","attention","off-track"]]}},
tasks:{t:"Task",cols:["title","category","priority","effort","status","xp_reward"],fields:{date:["Date","date"],title:["Outcome / task","text"],category:["Category","select",["Analysis","Reporting","Intel","Strategy","Coordination","Learning","Admin"]],priority:["Priority","select",["P1","P2","P3"]],effort:["Effort","text"],output:["Result / evidence","text"],status:["Status","select",["Not Started","In Progress","Done","Blocked"]],xp_reward:["XP","number"],is_boss:["Boss fight?","select",["0","1"]]}},
initiatives:{t:"Initiative",cols:["title","owner","deadline","status","risk","next_date"],fields:{title:["Initiative","text"],objective:["Strategic objective","text"],owner:["Owner","text"],deadline:["Deadline","date"],status:["Status","select",["Not Started","On Track","At Risk","Delayed","Completed","On Hold"]],risk:["Risk","select",["Green","Amber","Red"]],last_update:["Last update","text"],next_action:["Next action","text"],next_date:["Next action date","date"],escalation:["Escalation?","select",["No","Yes"]]}},
opportunities:{t:"Opportunity",cols:["title","value","feasibility","fit","status","owner"],fields:{title:["Title","text"],segment:["Segment / market","text"],evidence:["Evidence","textarea"],value:["Potential value","select",["High","Medium","Low"]],feasibility:["Feasibility","select",["High","Medium","Low"]],fit:["Strategic fit","select",["High","Medium","Low"]],owner:["Owner","text"],status:["Stage","select",["Idea","Research","Validate","Business Case","Pilot","Scale","Rejected"]],next_step:["Next validation step","text"],source:["Source","text"]}},
intel:{t:"Intel",cols:["date","headline","theme","priority"],fields:{date:["Date","date"],headline:["Headline","text"],theme:["Theme","select",["Insurance","Economy","Regulation","Competition","Technology","AI","InsurTech","Customer","Distribution","Risk"]],changed:["What changed?","textarea"],why_matters:["Why it matters","textarea"],implication:["Business implication","textarea"],opp_risk:["Opportunity / risk","text"],action:["Recommended action","text"],source:["Source","text"],priority:["Priority","select",["High","Medium","Low"]]}},
competitors:{t:"Competitor move",cols:["name","move","implication","date"],fields:{name:["Competitor","text"],move:["Move","textarea"],implication:["Our implication","textarea"],response:["Response required","textarea"],date:["Date","date"]}},
insights:{t:"Insight",cols:["date","topic","recommendation","outcome"],fields:{date:["Date","date"],topic:["Topic","text"],finding:["Finding (what changed)","textarea"],evidence:["Evidence","textarea"],driver:["Driver (why)","textarea"],implication:["Implication (so what)","textarea"],recommendation:["Recommendation","textarea"],action:["Action + owner + date","text"],outcome:["Outcome","select",["Pending","Adopted","Rejected","In progress"]],kpi_ref:["Related KPI","text"]}},
skills:{t:"Skill",cols:["domain","skill","level","target","status"],fields:{domain:["Domain","text"],skill:["Skill","text"],level:["Level (1-5)","number"],target:["Target","number"],method:["Learning method","text"],evidence:["Evidence of mastery","text"],hrs:["Hrs/week","number"],status:["Status","select",["Active","Planned","Paused","Mastered"]],next_step:["Next step","text"]}},
xp:{t:"XP entry",cols:["date","achievement","category","total"],fields:{date:["Date","date"],achievement:["Achievement","text"],category:["Category","text"],base:["Base XP","number"],mult:["Quality x","number"],bonus:["Streak bonus","number"],notes:["Notes","text"]}},
reviews:{t:"Weekly review",cols:["week_ending","business","recommendation"],fields:{week_ending:["Week ending","date"],business:["What happened?","textarea"],insight:["Key insight","textarea"],risk:["Key risk / deterioration","textarea"],opportunity:["Opportunity emerged","textarea"],gap:["Initiative / action gap","textarea"],recommendation:["Recommendation","textarea"],learning:["Personal learning","textarea"],scores:["Scores JSON (6x 1-5)","text"]}},
};
const S={route:"command",D:{},T:{},settings:{},xp:{total:0,week:0,level:1,streak:0},q:{}};
const NAV=[["command","Command Centre"],["daily","Daily OS"],["kpis","KPI Cockpit"],["insights","Insight Log"],["initiatives","Strategic Initiatives"],["opportunities","Opportunity Radar"],["intel","Market Intelligence"],["competitors","Competitors"],["weekly","Weekly Review"],["skills","Skill Tree"],["xp","XP & Progress"],["templates","Templates"],["settings","Settings"]];

/* ---------- shell ---------- */
function renderNav(){$("#nav").innerHTML=NAV.map(([r,l])=>`<button data-r="${r}" class="${S.route===r?"on":""}"><span class="t">${l}</span>${r==="command"?'<span class="k">⌘1</span>':""}</button>`).join("");
$$("#nav button").forEach(b=>b.onclick=()=>go(b.dataset.r));}
function renderLvl(){const x=S.xp;$("#lvlbox").innerHTML=`LEVEL <b>${x.level}</b> · <b>${x.total}</b> XP<br><span style="color:#8b949e">+${x.week} this week · ${x.streak}d streak · next Lv at ${x.next_at}</span>`;}
async function load(){try{const[dg,st]=await Promise.all([api("GET","/api/dashboard"),api("GET","/api/settings").catch(()=>({}))]);S.D=dg;S.xp=dg.xp;S.settings=st;
for(const t of Object.keys(F)){try{S.T[t]=await api("GET","/api/"+t);}catch(e){S.T[t]=[];}}}catch(e){MODE="local";await localBoot();setTimeout(()=>toast("Demo mode — your data stays in this browser."),400);}}
function go(r){S.route=r;renderNav();render();}
function pill(v){return `<span class="pill ${esc(String(v).replace(/ /g,"."))}">${esc(v||"—")}</span>`;}
function num(v){const n=Number(v);return isFinite(n)?n.toLocaleString():"—";}

/* ---------- local demo mode (GitHub Pages: no Python backend) ---------- */
const LS="cos1";
function persist(d){try{localStorage.setItem(LS,JSON.stringify(d||{tables:S.T,settings:S.settings}));}catch(e){}}
async function localBoot(){let d=null;try{d=JSON.parse(localStorage.getItem(LS));}catch(e){}
if(!d||!d.tables){d=await(await fetch("seed.json")).json();const t=today();
for(const tb of["tasks","intel","insights","competitors","xp"])for(const r of d.tables[tb]||[])if(r.date)r.date=t;
persist(d);}S.T=d.tables;S.settings=d.settings;sync(false);}
function sync(save=true){S.D=buildDash();S.xp=S.D.xp;if(save)persist();renderLvl();}
const lid=t=>Math.max(0,...(S.T[t]||[]).map(r=>+r.id||0))+1;
const xpt=b=>(+b.base||0)*((b.mult==null||b.mult==="")?1:(+b.mult||0))+(+b.bonus||0);
const dayMs=864e5,dayStr=d=>d.toISOString().slice(0,10),dayAgo=(d,n)=>dayStr(new Date(new Date(n+"T12:00")-dayMs));
const inWeek=(d,n)=>{const t=new Date(n+"T12:00")-new Date((d||"")+"T12:00");return t>=0&&t<8*dayMs;};
function buildDash(){const N=today();
const kpis=(S.T.kpis||[]).map(r=>{const k={...r},a=+k.actual||0,t=+k.target||0,pp=+k.prior_period||0,py=+k.prior_year||0;
k.variance=+(a-t).toFixed(2);k.variance_pct=t?+(((a-t)/t*100).toFixed(1)):0;k.yoy=py?+(((a-py)/py*100).toFixed(1)):0;k.mom=pp?+(((a-pp)/pp*100).toFixed(1)):0;
if(!k.status){const v=Math.abs(k.variance_pct);k.status=v<=3?"on-track":v<=8?"attention":"off-track";}return k;});
const alerts=[];
for(const k of kpis){if(["off-track","Delayed","Red"].includes(k.status))alerts.push({kind:"KPI red",text:`${k.metric}: ${k.variance_pct}% vs target`});
else if(["attention","At Risk","Amber"].includes(k.status))alerts.push({kind:"KPI amber",text:`${k.metric}: ${k.variance_pct}% vs target`});}
const od=(S.T.initiatives||[]).filter(o=>o.status!=="Completed"&&o.deadline&&o.deadline<N);
for(const o of od)alerts.push({kind:"Overdue",text:`Initiative overdue: ${o.title} (${o.deadline})`});
for(const s of(S.T.initiatives||[]).filter(x=>["At Risk","Delayed"].includes(x.status)))alerts.push({kind:"At risk",text:`${s.title} is ${s.status}`});
const due=(S.T.tasks||[]).filter(t=>t.date&&t.date<=N&&t.status!=="Done");
if(due.length)alerts.push({kind:"Tasks",text:`${due.length} open tasks due`});
const tot=(S.T.xp||[]).reduce((s,x)=>s+(+x.total||0),0),wk=(S.T.xp||[]).filter(x=>inWeek(x.date,N)).reduce((s,x)=>s+(+x.total||0),0);
const days=[...new Set((S.T.xp||[]).map(x=>x.date).filter(Boolean))].sort().reverse();let st=0,cur=N;if(days[0]&&days[0]!==N)cur=days[0];
for(const d of days){if(d===cur){st++;cur=dayAgo(d,cur);}else if(d<cur)break;}
const lv=Math.floor(tot/200)+1;
return{kpis,alerts:alerts.slice(0,12),overdue:od,open_tasks:due.length,xp:{total:tot,week:wk,level:lv,next_at:lv*200,streak:st},done_week:(S.T.tasks||[]).filter(t=>t.status==="Done"&&inWeek(t.date,N)).length,date:N};}
const path=t=>new URL(t,location.origin).pathname.split("/").filter(Boolean)[1];
async function LGET(p){const u=new URL(p,location.origin),t=u.pathname.split("/").filter(Boolean)[1];
if(t==="dashboard")return buildDash();if(t==="settings")return S.settings;
let rows=[...(S.T[t]||[])];const s=(u.searchParams.get("q")||"").toLowerCase();
return s?rows.filter(r=>JSON.stringify(r).toLowerCase().includes(s)):rows;}
async function LPOST(p,b){const t=path(p);
if(t==="award"){const o={id:lid("xp"),date:today(),achievement:b.achievement||"Work output",category:b.category||"General",base:+b.base||0,mult:+b.mult||1,bonus:+b.bonus||0,notes:b.notes||""};o.total=o.base*o.mult+o.bonus;S.T.xp.unshift(o);sync();return S.xp;}
if(t==="import"){let n=0;for(const r of(b.rows||[]).slice(0,500)){const o={id:lid(b.table)};for(const k of Object.keys(F[b.table].fields))o[k]=r[k]??"";if(!Object.values(o).join("").trim())continue;if(F[b.table].fields.date&&!o.date)o.date=today();S.T[b.table].push(o);n++;}sync();return{imported:n};}
if(t==="settings"){for(const[k,v]of Object.entries(b))S.settings[k]=typeof v==="string"?v:JSON.stringify(v);sync();return{ok:true};}
const o={id:lid(t),...b};if(F[t].fields.date&&!o.date)o.date=today();if(t==="xp"&&o.total==null)o.total=xpt(o);S.T[t].unshift(o);sync();return o;}
async function LPUT(p,b){const ps=new URL(p,location.origin).pathname.split("/").filter(Boolean),r=(S.T[ps[1]]||[]).find(x=>String(x.id)===ps[2]);
if(r){Object.assign(r,b);if(ps[1]==="xp")r.total=xpt(r);sync();}return r||{ok:true};}
async function LDEL(p){const ps=new URL(p,location.origin).pathname.split("/").filter(Boolean);S.T[ps[1]]=(S.T[ps[1]]||[]).filter(x=>String(x.id)!==ps[2]);sync();return{ok:true};}

/* ---------- generic table + form ---------- */
function toolbar(t,extra){return `<div class="toolbar"><input id="fq" placeholder="Filter…" value="${esc(S.q[t]||"")}" oninput="S.q['${t}']=this.value;paintRows('${t}')">
<button class="btn sm" onclick="openForm('${t}')">+ Add</button>
<button class="btn sm ghost" onclick="expCSV('${t}')">Export CSV</button>${extra||""}</div>`;}
function rowMatch(t,r){const q=(S.q[t]||"").toLowerCase();return !q||JSON.stringify(r).toLowerCase().includes(q);}
function paintRows(t){const tb=$("#rows");if(!tb)return;const c=F[t];const rows=(S.T[t]||[]).filter(r=>rowMatch(t,r));
tb.innerHTML=rows.length?rows.map(r=>`<tr onclick="openForm('${t}',${r.id})">${c.cols.map(k=>{let v=r[k];
if(k==="variance_pct"&&r.actual!=null&&r.target!=null){const a=+r.actual,tg=+r.target;v=tg?(((a-tg)/tg*100).toFixed(1)+"%"):"—";}
if(["status","risk","priority","value","feasibility","fit","outcome"].includes(k))return `<td>${pill(v)}</td>`;
return `<td>${esc(v??"—")}</td>`;}).join("")}</tr>`).join(""):`<tr><td colspan="9"><div class="empty">No records. Click + Add — or import a CSV from Settings.</div></td></tr>`;}
function crudView(t,title,sub){return `<div class="top"><h1>${title}</h1><span class="date">${esc(sub||"")}</span><span class="sp"></span>
<button class="btn ghost sm" onclick="impCSV('${t}')">Import CSV</button><button class="btn sm" onclick="openForm('${t}')">+ Add ${F[t].t}</button></div>
${toolbar(t)}<div class="card" style="padding:4px 8px;overflow:auto"><table><thead><tr>${F[t].cols.map(c=>`<th>${esc(c.replace(/_/g," "))}</th>`).join("")}</tr></thead><tbody id="rows"></tbody></table></div>`;}
function openForm(t,id){const c=F[t];const r=id?(S.T[t]||[]).find(x=>x.id===id)||{}:{};
$("#sheet").innerHTML=`<h2>${id?"Edit":"New"} ${c.t}</h2>${Object.entries(c.fields).map(([k,[l,ty,op]])=>{
let v=r[k]??(k==="date"||k==="week_ending"?today():"");let inp;
if(ty==="textarea")inp=`<textarea name="${k}" rows="2">${esc(v)}</textarea>`;
else if(ty==="select")inp=`<select name="${k}">${op.map(o=>`<option ${String(v)===o?"selected":""}>${o}</option>`).join("")}</select>`;
else inp=`<input name="${k}" type="${ty==="number"?"number":"text"}" value="${esc(v)}">`;
const half=["date","priority","status","level","target","value","feasibility","fit","risk","mult","bonus","base","hrs"].includes(k);
return `<div ${half?'style="display:inline-block;width:49%;vertical-align:top;margin-right:1%"':""}><label>${l}</label>${inp}</div>`;}).join("")}
<div style="margin-top:14px;display:flex;gap:8px"><button class="btn" onclick="saveForm('${t}',${id||"null"})">Save</button>
${id?`<button class="btn danger" onclick="delRow('${t}',${id})">Delete</button>`:""}
<button class="btn ghost" onclick="closeModal()">Cancel</button></div>`;
$("#modal").classList.add("open");}
async function saveForm(t,id){const b={};$$("#sheet [name]").forEach(i=>b[i.name]=i.value);
try{if(id){const r=await PUT(`/api/${t}/${id}`,b);S.T[t]=S.T[t].map(x=>x.id===id?r:x);}else{const r=await POST("/api/"+t,b);S.T[t]=[r,...(S.T[t]||[])];}
closeModal();render();toast("Saved.");}catch(e){toast("Save failed: "+e.message);}}
async function delRow(t,id){if(!confirm("Delete this record?"))return;await DEL(`/api/${t}/${id}`);S.T[t]=S.T[t].filter(x=>x.id!==id);closeModal();render();}
function closeModal(){$("#modal").classList.remove("open");}
function expCSV(t){if(MODE==="api")return location.href="/api/export?table="+t;
const cols=["id",...Object.keys(F[t].fields)],cell=v=>`"${String(v??"").replace(/"/g,'""')}"`;
const csv=[cols.join(","),...(S.T[t]||[]).map(r=>cols.map(c=>cell(r[c])).join(","))].join("\n");
const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=t+".csv";a.click();}
function impCSV(t){S._imp=t;$("#csvfile").click();}
$("#csvfile").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;const txt=await f.text();
const lines=txt.split(/\r?\n/).filter(l=>l.trim());if(lines.length<2)return toast("Empty CSV");
const head=lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,""));
const rows=lines.slice(1).map(l=>{const cells=l.split(",");const o={};head.forEach((h,i)=>o[h]=(cells[i]||"").trim().replace(/^"|"$/g,""));return o;});
try{const r=await POST("/api/import",{table:S._imp,rows});await load();render();toast(`Imported ${r.imported} rows into ${S._imp}.`);}catch(err){toast("Import failed: "+err.message);}e.target.value="";});

/* ---------- views ---------- */
function vCommand(){const d=S.D,k=d.kpis||[];const bf=S.settings.boss_fight||"—";let pr=[];try{pr=JSON.parse(S.settings.priorities||"[]");}catch(e){}
const card=(l,v,s)=>`<div class="card"><h3>${l}</h3><div class="kpi-num mono">${v}</div><div class="kpi-sub">${s||""}</div></div>`;
const g=k.find(x=>/gross written/i.test(x.metric))||k[0]||{};
return `<div class="top"><h1>Command Centre</h1><span class="date">${esc(d.date)} — what matters today, in 30 seconds</span></div>
<div class="boss"><small>TODAY'S BOSS FIGHT</small><div class="t">${esc(bf)}</div><div style="margin-top:8px"><button class="btn sm" onclick="go('daily')">Open in Daily OS</button></div></div>
<div class="grid g4">${card("Gross premium",num(g.actual)+((g.metric||"").includes("bn")?"bn":""),`target ${num(g.target)} · ${g.variance_pct??"—"}%`)}
${card("Target achievement",(((k.find(x=>/achievement/i.test(x.metric))||{}).actual??"—"))+"%","vs 100%")}
${card("YoY growth",((k.find(x=>/yoy/i.test(x.metric))||{}).actual??"—")+"%","target 15%")}
${card("XP this week","+"+S.xp.week,`Lv ${S.xp.level} · ${S.xp.streak}d streak`)}</div>
<div class="grid g2" style="margin-top:12px"><div class="card"><h3>Business pulse — actual vs target</h3><canvas class="chart" id="ch1"></canvas></div>
<div class="card"><h3>Attention required (${d.alerts.length})</h3>${d.alerts.length?d.alerts.map(a=>`<div class="alert ${a.kind.includes("red")||a.kind==="Overdue"?"red":a.kind==="Tasks"?"green":""}"><b>${esc(a.kind)}</b> — ${esc(a.text)}</div>`).join(""):'<div class="mut">Nothing flagged. Business is quiet — use the time for deep work.</div>'}</div></div>
<div class="grid g3" style="margin-top:12px">
<div class="card"><h3>Top priorities</h3>${pr.length?pr.map((p,i)=>`<div>● ${esc(p)}</div>`).join(""):'<span class="mut">Set in Settings.</span>'}</div>
<div class="card"><h3>Opportunity radar</h3>${(S.T.opportunities||[]).filter(o=>o.status!=="Rejected").slice(0,4).map(o=>`<div>● <b>${esc(o.title)}</b> ${pill(o.value)} <span class="mut">${esc(o.status||"")}</span></div>`).join("")||'<span class="mut">None.</span>'}<div style="margin-top:6px"><button class="btn sm ghost" onclick="go('opportunities')">Open radar</button></div></div>
<div class="card"><h3>Latest intelligence</h3>${(S.T.intel||[]).slice(0,4).map(w=>`<div>● <b>${esc(w.headline)}</b><br><span class="mut">${esc(w.theme||"")} · ${esc(w.date||"")}</span></div>`).join("")||'<span class="mut">None.</span>'}<div style="margin-top:6px"><button class="btn sm ghost" onclick="go('intel')">Open intel</button></div></div></div>`;}

function vDaily(){const ts=(S.T.tasks||[]).filter(t=>t.date===today());const boss=ts.find(t=>t.is_boss==="1")||ts[0];
return `<div class="top"><h1>Daily OS</h1><span class="date">${today()} — outcomes, not to-dos</span><span class="sp"></span>
<button class="btn ghost sm" onclick="openFocus()">◎ Focus mode</button><button class="btn sm" onclick="openForm('tasks')">+ Add outcome</button></div>
<div class="boss"><small>TODAY'S BOSS FIGHT</small><div class="t">${esc(S.settings.boss_fight||boss?.title||"Set one high-value outcome in Settings.")}</div></div>
<div class="card"><h3>Today's outcomes (${ts.filter(t=>t.status==="Done").length}/${ts.length} done)</h3>
<table><thead><tr><th>Outcome</th><th>Cat</th><th>Pri</th><th>Effort</th><th>Status</th><th>XP</th><th></th></tr></thead><tbody>
${ts.map(t=>`<tr onclick="openForm('tasks',${t.id})"><td><b>${esc(t.title)}</b>${t.is_boss==="1"?' <span class="pill High">BOSS</span>':""}<br><span class="mut small">${esc(t.output||"")}</span></td><td>${esc(t.category||"")}</td><td>${esc(t.priority||"")}</td><td>${esc(t.effort||"")}</td><td>${pill(t.status)}</td><td class="mono">+${esc(t.xp_reward||0)}</td>
<td><button class="btn sm ghost" onclick="event.stopPropagation();doneTask(${t.id})">Done</button></td></tr>`).join("")||'<tr><td colspan="7"><div class="empty">Nothing planned. Add your Boss Fight + top 3 outcomes.</div></td></tr>'}</tbody></table></div>
<div class="grid g2" style="margin-top:12px"><div class="card"><h3>Operating rhythm</h3>
${[["08:00–08:15","Intelligence scan","3–5 signals captured"],["08:15–10:15","Deep work","one tangible output"],["10:30–12:00","Reporting / analysis","numbers checked twice"],["12:00–14:00","Meetings / recharge","actions captured"],["14:00–15:30","Strategic work","1 insight or opportunity"],["15:30–16:30","Close loop","tracker + tomorrow's fight"]].map(r=>`<div>● <b>${r[0]}</b> ${r[1]} <span class="mut">→ ${r[2]}</span></div>`).join("")}</div>
<div class="card"><h3>Deep-work timer (Pomodoro)</h3><div class="kpi-num mono" id="pom">25:00</div>
<div style="display:flex;gap:8px;margin-top:8px"><button class="btn sm" onclick="pomStart()">Start</button><button class="btn sm ghost" onclick="pomStop()">Stop</button><button class="btn sm ghost" onclick="award('Protected deep-work block',10,'Focus')">Log block +10</button></div>
<div class="small mut" style="margin-top:6px">Rule: no games / social / YouTube during the block. One distraction = +1 counter.</div></div></div>`;}
async function doneTask(id){const t=(S.T.tasks||[]).find(x=>x.id===id);if(!t)return;
const r=await PUT(`/api/tasks/${id}`,{status:"Done"});S.T.tasks=S.T.tasks.map(x=>x.id===id?r:x);
await award(t.is_boss==="1"?"Boss fight complete: "+t.title:"Completed: "+t.title,+(t.xp_reward||10),"Execution");render();}

function vKPIs(){return `<div class="top"><h1>KPI Cockpit</h1><span class="date">actual · target · variance · driver → implication → action</span><span class="sp"></span>
<button class="btn ghost sm" onclick="openInsight()">＋ Insight builder</button><button class="btn sm" onclick="openForm('kpis')">+ Add KPI</button></div>
<div class="grid g2"><div class="card"><h3>Actual vs target</h3><canvas class="chart" id="chK"></canvas></div>
<div class="card"><h3>Variance % (red = off track)</h3><canvas class="chart" id="chV"></canvas></div></div>
${toolbar("kpis")}<div class="card" style="padding:4px 8px;overflow:auto"><table><thead><tr>
<th>Period</th><th>Metric</th><th>Actual</th><th>Target</th><th>Var</th><th>Var%</th><th>YoY</th><th>Driver</th><th>Action</th><th>Status</th></tr></thead><tbody id="rows"></tbody></table></div>
<div class="small mut" style="margin-top:6px">Click a row to edit driver / implication / action — or send it to the Insight Builder. Rule: every red KPI must have an owner + next action.</div>`;}

function openInsight(preset){const steps=[["changed","1. What changed? (metric, size, period)"],["sig","2. How significant? (vs target / prior / material?)"],["why","3. Why did it happen? (facts)"],["driver","4. What is driving it? (root cause)"],["matter","5. Why does it matter? (financial / strategic effect)"],["do","6. What should management do?"],["who","7. Who acts?"],["when","8. By when?"]];
$("#sheet").innerHTML=`<h2>Insight builder — Track → Analyse → Identify → Explain → Recommend</h2>
<label>Topic / KPI</label><input name="topic" value="${esc(preset||"")}">
${steps.map(([k,l])=>`<label>${l}</label><textarea name="${k}" rows="1"></textarea>`).join("")}
<div style="margin-top:12px;display:flex;gap:8px"><button class="btn" onclick="saveInsight()">Generate management insight</button><button class="btn ghost" onclick="closeModal()">Cancel</button></div>`;
$("#modal").classList.add("open");}
async function saveInsight(){const g=n=>document.querySelector(`#sheet [name="${n}"]`).value.trim();
const finding=`${g("changed")} Significance: ${g("sig")}`;
await POST("/api/insights",{date:today(),topic:g("topic")||"Untitled insight",finding,evidence:g("why"),
driver:g("driver"),implication:g("matter"),recommendation:g("do"),action:`${g("who")} by ${g("when")}`,outcome:"Pending",kpi_ref:g("topic")});
S.T.insights=await GET("/api/insights");closeModal();await award("Found material business insight",25,"Analysis");go("insights");}

function vOpp(){const os=(S.T.opportunities||[]).filter(o=>o.status!=="Rejected");
const cell=(v,f)=>`<div class="mx"><h4>${v} value × ${f} feasibility</h4>${os.filter(o=>o.value===v&&o.feasibility===f).map(o=>`<div onclick="openForm('opportunities',${o.id})" style="cursor:pointer">● <b>${esc(o.title)}</b> <span class="mut">${esc(o.status||"")}</span></div>`).join("")||'<div class="mut">—</div>'}</div>`;
return `<div class="top"><h1>Opportunity Radar</h1><span class="date">evidence first — interesting ≠ viable</span><span class="sp"></span><button class="btn sm" onclick="openForm('opportunities')">+ Add opportunity</button></div>
<div class="matrix">${cell("High","High")}${cell("High","Low")}${cell("Low","High")}${cell("Low","Low")}</div>
<div style="margin-top:12px">${toolbar("opportunities")}<div class="card" style="padding:4px 8px;overflow:auto"><table><thead><tr><th>Title</th><th>Value</th><th>Feas.</th><th>Fit</th><th>Stage</th><th>Owner</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;}

function vWeekly(){const revs=S.T.reviews||[];const d=S.D;
return `<div class="top"><h1>Weekly Review</h1><span class="date">Friday — business + self</span><span class="sp"></span><button class="btn sm" onclick="openForm('reviews')">+ New review</button></div>
<div class="grid g4"><div class="card"><h3>XP earned</h3><div class="kpi-num mono">+${S.xp.week}</div></div>
<div class="card"><h3>Tasks closed (7d)</h3><div class="kpi-num mono">${d.done_week}</div></div>
<div class="card"><h3>Insights logged</h3><div class="kpi-num mono">${(S.T.insights||[]).length}</div></div>
<div class="card"><h3>Open alerts</h3><div class="kpi-num mono">${d.alerts.length}</div></div></div>
<div class="card" style="margin-top:12px"><h3>Friday check (score 1–5 each)</h3><div class="small mut">Material change spotted? Explained why? Opportunity/risk found? Initiative moved? Recommendation made? Deep work protected?</div></div>
${revs.map(r=>`<div class="card" style="margin-top:8px"><b>Week ending ${esc(r.week_ending)}</b> — ${esc((r.business||"").slice(0,140))}<br><span class="mut">${esc((r.recommendation||"").slice(0,140))}</span> <button class="btn sm ghost" onclick="openForm('reviews',${r.id})">Open</button></div>`).join("")||'<div class="empty">No reviews yet.</div>'}`;}

function vSkills(){const sk=S.T.skills||[];const by={};sk.forEach(s=>{(by[s.domain]=by[s.domain]||[]).push(s);});
return `<div class="top"><h1>Skill Tree</h1><span class="date">am I becoming better at this job?</span><span class="sp"></span><button class="btn sm" onclick="openForm('skills')">+ Add skill</button></div>
${Object.entries(by).map(([dom,arr])=>`<div class="card" style="margin-top:10px"><h3>${esc(dom)}</h3>
${arr.map(s=>{const pc=Math.min(100,Math.round(s.level/s.target*100));return `<div onclick="openForm('skills',${s.id})" style="cursor:pointer;padding:6px 0;border-top:1px solid var(--line)"><b>${esc(s.skill)}</b> ${pill(s.status)}<br>
<div style="background:#eef;height:7px;border-radius:99px;margin:5px 0"><div style="width:${pc}%;background:var(--acc);height:7px;border-radius:99px"></div></div>
<span class="small mut">Lv ${esc(s.level)} → ${esc(s.target)} · ${pc}% · next: ${esc(s.next_step||"—")}</span></div>`;}).join("")}</div>`).join("")||'<div class="empty">No skills.</div>'}`;}

function vXP(){const rows=S.T.xp||[];let guide=[];try{guide=JSON.parse(S.settings.xp_guide||"[]");}catch(e){}
return `<div class="top"><h1>XP &amp; Progress</h1><span class="date">outputs, not hours</span><span class="sp"></span><button class="btn sm" onclick="openForm('xp')">+ Log XP</button></div>
<div class="grid g4"><div class="card"><h3>Level</h3><div class="kpi-num">${S.xp.level}</div><div class="kpi-sub">next at ${S.xp.next_at} XP</div></div>
<div class="card"><h3>Lifetime</h3><div class="kpi-num mono">${S.xp.total}</div></div>
<div class="card"><h3>This week</h3><div class="kpi-num mono">+${S.xp.week}</div></div>
<div class="card"><h3>Streak</h3><div class="kpi-num mono">${S.xp.streak}d</div></div></div>
<div class="grid g2" style="margin-top:12px"><div class="card"><h3>Reward guide (outputs)</h3>${guide.map(([a,x])=>`<div>● ${esc(a)} <b class="mono">+${x}</b> <button class="btn sm ghost" onclick="award('${esc(a)}',${x},'General')">Claim</button></div>`).join("")}</div>
<div class="card"><h3>Recent XP</h3>${rows.slice(0,12).map(x=>`<div>● ${esc(x.date)} <b>${esc(x.achievement)}</b> <span class="mono">+${esc(x.total)}</span></div>`).join("")||'<span class="mut">None.</span>'}</div></div>`;}

function vTemplates(){const T=[
["Performance analysis","What changed? → Why? → So what? → What should we do? → Owner + date?","insights"],
["Executive one-slide","Headline = conclusion · Evidence (2–4 facts) · Driver · Implication · Recommendation · Owner/timing","insights"],
["Market intel → action","Signal · What changed · Why it matters · Impact · Opportunity/Risk · Action","intel"],
["Opportunity","Problem · Opportunity · Evidence · Value · Feasibility · Next validation step","opportunities"],
["Initiative","Objective · Actions · Owner · Milestone · Risk · Next step","initiatives"]];
return `<div class="top"><h1>Templates</h1><span class="date">start structured, finish management-ready</span></div>
${T.map(t=>`<div class="card" style="margin-top:8px"><b>${t[0]}</b><br><span class="mut">${t[1]}</span><br><button class="btn sm ghost" style="margin-top:6px" onclick="openForm('${t[2]}')">Use template →</button></div>`).join("")}`;}

function vSettings(){return `<div class="top"><h1>Settings</h1></div><div class="grid g2">
<div class="card"><h3>Today</h3><label class="small mut">Boss fight</label><input id="sbf" value="${esc(S.settings.boss_fight||"")}">
<label class="small mut">Top 3 priorities (one per line)</label><textarea id="spr" rows="3">${esc((()=>{try{return JSON.parse(S.settings.priorities||"[]").join("\n");}catch(e){return "";}})())}</textarea>
<div style="margin-top:8px"><button class="btn sm" onclick="saveSettings()">Save</button></div></div>
<div class="card"><h3>Data</h3><div class="small mut">Workbook parity: each module exports / imports CSV with the same columns as the Excel sheets (KPI Cockpit, Strategic Tracker, …). Excel import: save the sheet as CSV, then import here.</div>
<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">${Object.keys(F).map(t=>`<button class="btn sm ghost" onclick="expCSV('${t}')">↓ ${t}</button>`).join("")}</div>
<div class="small mut">Fresh demo data: stop the server, delete career_os.db, restart.</div></div></div>`;}
async function saveSettings(){const pr=$("#spr").value.split("\n").map(s=>s.trim()).filter(Boolean).slice(0,3);
await POST("/api/settings",{boss_fight:$("#sbf").value,priorities:pr});S.settings.boss_fight=$("#sbf").value;S.settings.priorities=JSON.stringify(pr);toast("Saved.");render();}

/* ---------- router ---------- */
function render(){renderLvl();const v=$("#view");const R=S.route;
if(R==="command")v.innerHTML=vCommand();
else if(R==="daily")v.innerHTML=vDaily();
else if(R==="kpis")v.innerHTML=vKPIs();
else if(R==="insights")v.innerHTML=crudView("insights","Management Intelligence Log","my permanent knowledge base — finding · evidence · implication · recommendation");
else if(R==="initiatives")v.innerHTML=crudView("initiatives","Strategic Initiatives","days-to-deadline tracked automatically");
else if(R==="opportunities")v.innerHTML=vOpp();
else if(R==="intel")v.innerHTML=crudView("intel","Market Intelligence","signal → implication → opportunity/risk → action");
else if(R==="competitors")v.innerHTML=crudView("competitors","Competitor Monitoring","move → our implication → response");
else if(R==="weekly")v.innerHTML=vWeekly();
else if(R==="skills")v.innerHTML=vSkills();
else if(R==="xp")v.innerHTML=vXP();
else if(R==="templates")v.innerHTML=vTemplates();
else if(R==="settings")v.innerHTML=vSettings();
if(F[R])paintRows(R);
if(R==="command")bar($("#ch1"),S.D.kpis.map(k=>k.metric.split("(")[0].slice(0,14)),S.D.kpis.map(k=>[+k.actual||0,+k.target||0]));
if(R==="kpis"){const k=(S.T.kpis||[]).filter(r=>rowMatch("kpis",r)).slice(0,10);
bar($("#chK"),k.map(x=>x.metric.split("(")[0].slice(0,14)),k.map(x=>[+x.actual||0,+x.target||0]));
bars($("#chV"),k.map(x=>x.metric.split("(")[0].slice(0,14)),k.map(x=>{const a=+x.actual||0,t=+x.target||1;return +(((a-t)/t*100).toFixed(1));}));}}

/* ---------- canvas charts (no deps) ---------- */
function setup(cv){const d=devicePixelRatio||1,w=cv.clientWidth||600,h=180;cv.width=w*d;cv.height=h*d;const c=cv.getContext("2d");c.scale(d,d);return[c,w,h];}
function bar(cv,labels,pairs){if(!cv)return;const[c,W,H]=setup(cv);c.clearRect(0,0,W,H);if(!labels.length){c.fillStyle="#888";c.fillText("No data",10,20);return;}
const mx=Math.max(...pairs.flat(),1),n=labels.length,bw=Math.min(14,(W/n-16)/2.4);
pairs.forEach((p,i)=>{const x0=8+i*(W-16)/n;[p[0],p[1]].forEach((v,j)=>{const bh=(v/mx)*(H-30);c.fillStyle=j?"#c9d4de":"#1f6feb";const x=x0+j*(bw+2);c.fillRect(x,H-18-bh,bw,bh);});c.fillStyle="#67707a";c.font="10px sans-serif";c.fillText(labels[i],x0,H-5);});
c.fillStyle="#1f6feb";c.fillRect(8,4,10,8);c.fillStyle="#333";c.fillText("actual",22,12);c.fillStyle="#c9d4de";c.fillRect(70,4,10,8);c.fillStyle="#333";c.fillText("target",84,12);}
function bars(cv,labels,vals){if(!cv)return;const[c,W,H]=setup(cv);c.clearRect(0,0,W,H);if(!labels.length){c.fillStyle="#888";c.fillText("No data",10,20);return;}
const mx=Math.max(...vals.map(Math.abs),1),n=labels.length,bw=Math.min(26,(W/n)-10);
vals.forEach((v,i)=>{const bh=Math.abs(v)/mx*(H-44);const x=6+i*(W-12)/n;c.fillStyle=v<-8?"#cf222e":v<-3?"#9a6700":"#1a7f37";const y=v<0?(H/2):(H/2-bh);c.fillRect(x,y,bw,Math.max(2,bh));c.fillStyle="#67707a";c.font="10px sans-serif";c.fillText(labels[i],x,H-5);c.fillStyle="#333";c.fillText(v+"%",x,H/2-(v<0?-12:bh+4));});
c.strokeStyle="#ccc";c.beginPath();c.moveTo(0,H/2-8);c.lineTo(W,H/2-8);c.stroke();}

/* ---------- focus + pomodoro + search ---------- */
let FT={t:null,left:1500,dist:0,task:""};
function openFocus(){const ts=(S.T.tasks||[]).filter(t=>t.date===today()&&t.status!=="Done");FT.task=(ts.find(t=>t.is_boss==="1")||ts[0]||{title:"Deep work"}).title;
$("#ftask").textContent=FT.task;FT.left=1500;FT.dist=0;updF();$("#focus").classList.add("open");}
function updF(){const m=String(Math.floor(FT.left/60)).padStart(2,"0"),s=String(FT.left%60).padStart(2,"0");$("#ftimer").textContent=`${m}:${s}`;$("#fdist").textContent=FT.dist;const p=$("#pom");if(p)p.textContent=`${m}:${s}`;}
function tick(){if(FT.left>0){FT.left--;updF();}else{clearInterval(FT.t);FT.t=null;toast("Block complete. Log it for +10 XP.");}}
$("#fstart").onclick=()=>{if(FT.t){clearInterval(FT.t);FT.t=null;$("#fstart").textContent="Start";}else{FT.t=setInterval(tick,1000);$("#fstart").textContent="Pause";}};
$("#fdistbtn").onclick=()=>{FT.dist++;updF();};
$("#fdone").onclick=async()=>{clearInterval(FT.t);FT.t=null;$("#focus").classList.remove("open");await award("Protected deep-work block",10,"Focus",FT.task);};
$("#fexit").onclick=()=>{clearInterval(FT.t);FT.t=null;$("#focus").classList.remove("open");};
let PT={t:null,left:1500};
function pomStart(){if(PT.t)return;PT.t=setInterval(()=>{if(PT.left>0){PT.left--;FT.left=PT.left;updF();}else{clearInterval(PT.t);PT.t=null;PT.left=1500;toast("Pomodoro done — take 5.");}},1000);}
function pomStop(){clearInterval(PT.t);PT.t=null;PT.left=1500;FT.left=1500;updF();}
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#search").classList.add("open");$("#sin").value="";sres("");setTimeout(()=>$("#sin").focus(),30);}
if(e.key==="Escape"){closeModal();$("#search").classList.remove("open");}});
$("#sin").addEventListener("input",e=>sres(e.target.value));
function sres(q){q=(q||"").toLowerCase();const out=[];const push=(t,arr,label)=>arr.forEach(r=>{const s=JSON.stringify(r).toLowerCase();if(q&&s.includes(q))out.push([t,r.id,(r.title||r.metric||r.headline||r.topic||r.name||r.achievement||"")+"",label]);});
if(q){push("kpis",S.T.kpis||[],"KPI");push("insights",S.T.insights||[],"Insight");push("initiatives",S.T.initiatives||[],"Initiative");push("opportunities",S.T.opportunities||[],"Opportunity");push("intel",S.T.intel||[],"Intel");push("tasks",S.T.tasks||[],"Task");}
$("#sres").innerHTML=out.slice(0,20).map(([t,id,txt,l])=>{const r=t==="tasks"?"daily":t;return `<div onclick="document.querySelector('#search').classList.remove('open');go('${r}');setTimeout(()=>openForm('${t}',${id}),150)"><b>${l}</b> — ${esc(txt.slice(0,90))}</div>`;}).join("")||(q?'<div class="mut" style="padding:8px">No matches.</div>':"");}
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal();});

/* ---------- boot ---------- */
(async function(){try{await load();renderNav();render();}catch(e){$("#view").innerHTML=`<div class="card"><h3>Server unreachable</h3><p class="mut">${esc(e.message)}</p><p>Start it with: <kbd>python server.py</kbd> in the career-os folder.</p></div>`;}})();
