/* FitnessWorld groups layer: group creation (₹50, demo payment), 7-day Pro trial, plans, challenge credits, payment records. Loads after plans.js. */
(()=>{
const E=()=>data.extra=data.extra||{},G=()=>E().group||null,stop=e=>{e.preventDefault();e.stopImmediatePropagation()};
const left=d=>Math.max(0,Math.ceil((new Date(d)-Date.now())/864e5)),eff=g=>g.plan||(Date.now()<new Date(g.trialEnds)?"Pro trial":"Trial ended"),pro=g=>g.plan==="Pro"||eff(g)==="Pro trial";
function cred(g){const s=eff(g);if(s==="Trial ended")return{tot:0,used:0,label:"Choose a plan to get challenge credits"};
 if(s==="Pro trial")return{tot:2,used:g.usage.filter(u=>u.trial).length,label:"Trial credits (whole trial)"};
 const d=new Date(),h=d.getUTCDate()<=15?1:2,ym=today().slice(0,7);return{tot:s==="Pro"?5:2,used:g.usage.filter(u=>!u.trial&&u.date.slice(0,7)===ym&&(new Date(u.date).getUTCDate()<=15?1:2)===h).length,label:`Gym ${s} credits, days ${h===1?"1–15":"16–end"} of this month`}}
const add=(o)=>(E().ledger=E().ledger||[]).unshift(Object.assign({date:today()},o));
const row=(a,b)=>`<div class="fw-row"><span class="muted">${a}</span><strong>${b}</strong></div>`,card=(id,host,pos)=>{let c=document.getElementById(id);if(!c){c=document.createElement("div");c.id=id;c.className="card form-card fw-card";host.insertAdjacentElement(pos,c)}return c};
function group(){const p=$("#gymPlansPanel");if(!p)return;const c=card("fwGroup",p,"afterbegin"),g=G();
 if(!g){c.innerHTML=`<h2>My gym group</h2><p class="muted small">You have no group yet. Creating one costs ₹50 once (demo payment) and starts a 7-day Gym Pro trial with no automatic charge.</p><button class="btn btn-primary" type="button" data-gymtab="gymGroupsPanel">Create a group</button>`;return}
 const s=eff(g),k=cred(g);c.innerHTML=`<h2>My gym group</h2>${row("Group",esc(g.name))}${row("Location",esc(g.location))}${row("Invite code",g.code)}${row("Plan",s==="Pro trial"?`Gym Pro trial · ${left(g.trialEnds)} day(s) left`:s==="Trial ended"?"Trial ended: choose a plan":"Gym "+s)}${row("Challenge credits",`${Math.max(0,k.tot-k.used)} of ${k.tot} left`)}<p class="fw-note">${k.label}</p>${row("Marketplace platform fee",pro(g)?"1%":"5%")}<p class="fw-note">Fees apply only to paid marketplace sales, never to subscriptions or the group creation fee. Demo supports one group; managing several groups on Pro is not built yet.</p>`}
function ledger(){const p=$("#gymPlansPanel");if(!p)return;const c=card("fwLedger",p,"beforeend"),L=E().ledger||[],m=n=>gymMoney(n);
 c.innerHTML=`<h2>Payment records</h2><p class="muted small">Demo records. No real money moves.</p>${L.length?L.map(x=>`<div class="exercise-item"><span><strong>${esc(x.type)}${x.title?" · "+esc(x.title):""}</strong><br><small class="muted">${esc(x.date)} · ${x.type==="Marketplace sale"?`Platform fee ${x.rate}% = ${m(x.fee)}. Seller receives ${m(x.net)}.`:"No platform fee (it applies to marketplace sales only)."}</small></span><strong>${m(x.amount)}</strong></div>`).join(""):'<p class="muted small">No payments yet.</p>'}`}
function arena(){const h=$("#challengeCards");if(!h)return;const c=card("fwCredits",h,"beforebegin"),g=G();
 if(!g){c.innerHTML='<h2>Challenge credits</h2><p class="muted small">Create a gym group (Gym → Groups) to get challenge credits. Phase 1 allows Local and District non-cash challenges only.</p>';return}
 const k=cred(g);c.innerHTML=`<h2>Challenge credits</h2>${row("Left this period",`${Math.max(0,k.tot-k.used)} of ${k.tot}`)}<p class="fw-note">${k.label}. Each new challenge uses 1 credit. Phase 1 allows Local and District non-cash challenges only.</p>`}
let pend=null,before=null,plan=null;
window.addEventListener("submit",e=>{const f=e.target;
 if(f.id==="gymForm"){if(G()){stop(e);toast("This demo supports one gym group per account.");return}
  if(!confirm("Create this group for ₹50? This is a demo payment and nothing is charged.")){stop(e);return}
  const q=n=>f.elements[n].value.trim();pend={name:q("name"),location:q("location"),email:q("email")}}
 else if(f.id==="challengeForm"){const g=G(),lv=f.elements.level.value,k=g&&cred(g);
  const m=!g?"Create a gym group first (Gym → Groups).":eff(g)==="Trial ended"?"Your trial has ended. Choose a plan in Gym → Plans.":!["Local","District"].includes(lv)?"Only Local and District challenges are open in Phase 1.":/cash/i.test(f.elements.prize.value)?"Cash prizes are not allowed until the legal review is complete.":k.tot-k.used<1?"No challenge credits left for this period.":"";
  if(m){stop(e);toast(m);return}before=new Set(data.challenges.map(c=>c.id))}},true);
window.addEventListener("submit",e=>{const f=e.target;
 if(f.id==="gymForm"&&pend){const d=new Date(Date.now()+7*864e5).toISOString();E().group=Object.assign(pend,{code:Math.random().toString(36).slice(2,8).toUpperCase(),created:today(),trialEnds:d,plan:null,usage:[]});add({type:"Group creation",amount:50,fee:0});pend=null;save();toast("Group created. Your 7-day Gym Pro trial has started.")}
 else if(f.id==="challengeForm"&&before){const n=data.challenges.find(c=>!before.has(c.id));before=null;if(n){G().usage.push({date:today(),name:n.name,trial:eff(G())==="Pro trial"});save()}}});
window.addEventListener("click",e=>{const b=e.target.closest("[data-plan-choice]");if(!b)return;const g=G(),pl=b.dataset.planChoice;
 if(!g){stop(e);toast("Create a gym group first (Gym → Groups).");return}
 if(g.plan===pl){stop(e);toast("You are already on this plan.");return}
 if(!confirm(`Authorize a demo payment of ₹${pl==="Pro"?499:199} per month for Gym ${pl}? Nothing is charged.`)){stop(e);return}plan=pl},true);
window.addEventListener("click",()=>{if(!plan)return;const g=G();g.plan=plan;add({type:"Subscription · Gym "+plan,amount:plan==="Pro"?499:199,fee:0});plan=null;save();toast("Plan activated (demo payment).")});
const _r=renderAll;renderAll=function(){_r();group();ledger();arena()};renderAll();
})();
