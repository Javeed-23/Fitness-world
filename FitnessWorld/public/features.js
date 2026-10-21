/* FitnessWorld feature layer: loads after app.js, reuses its data, helpers and CSS classes. */
(()=>{
const st=document.createElement("style");st.textContent=`.fw-bars{display:flex;gap:8px;align-items:flex-end;height:96px;margin:14px 0 6px}.fw-bar{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;font-size:10px;color:var(--muted)}.fw-bar i{display:block;width:100%;background:#111;border-radius:6px 6px 0 0;min-height:3px}.fw-bar i.zero{background:#e8e8e8}.fw-thread{margin-top:14px;border-top:1px solid var(--line);padding-top:12px;display:grid;gap:8px}.fw-goal{margin-bottom:12px}.fw-goal-row{display:flex;justify-content:space-between;font-size:12px;font-weight:700}.fw-goal .progress-track{margin:8px 0 0}.fw-row{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);font-size:13px}.fw-qty{display:flex;gap:6px;align-items:center}.fw-qty button{width:28px;height:28px;padding:0}.fw-timer{font-size:44px;font-weight:800;letter-spacing:-2px;margin:10px 0}.fw-btns{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.fw-card{margin-bottom:16px}`;document.head.appendChild(st);
const X=()=>{const e=data.extra=data.extra||{};e.goals=e.goals||{weekly:3,kcal:2000,protein:100,water:2500};e.cart=e.cart||{};e.comments=e.comments||{};return e};
const card=(id,after,inside)=>{let c=document.getElementById(id);if(!c){c=document.createElement("div");c.id=id;c.className="card form-card fw-card";inside?after.appendChild(c):after.insertAdjacentElement("afterend",c)}return c};
const bar=(label,val,goal,unit)=>{const p=Math.min(100,Math.round(val/Math.max(1,goal)*100));return `<div class="fw-goal"><div class="fw-goal-row"><span>${label}</span><span>${val}${unit} / ${goal}${unit}</span></div><div class="progress-track"><div class="progress-fill" style="width:${p}%"></div></div></div>`};
const goalInput=(id,label,v)=>`<label>${label}<input type="number" id="${id}" min="1" value="${v}"></label>`;
/* Dashboard: last 7 days + weekly goal */
function dash(){const g=X().goals,host=$("#page-dashboard .stats-grid");if(!host)return;const c=card("fwWeek",host);
 const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d.toISOString().slice(0,10)});
 const mins=days.map(d=>data.workouts.filter(w=>w.date===d).reduce((s,w)=>s+(Number(w.duration)||0),0)),max=Math.max(30,...mins),n=data.workouts.filter(w=>days.includes(w.date)).length;
 c.innerHTML=`<h2>Last 7 days</h2><p class="muted small">Workout minutes per day.</p><div class="fw-bars">${days.map((d,i)=>`<div class="fw-bar" title="${mins[i]} min">${mins[i]?mins[i]:""}<i class="${mins[i]?"":"zero"}" style="height:${Math.max(3,mins[i]/max*70)}px"></i>${"SMTWTFS"[new Date(d).getUTCDay()]}</div>`).join("")}</div>${bar("Workouts this week",n,g.weekly,"")}${goalInput("fwWeekly","Workouts per week",g.weekly)}`}
/* Workout: rest timer (built once so it keeps running while data re-renders) */
let end=0,tick=null,left=60,pre=60;const fmt=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
function showT(){const t=$("#fwTime");if(t)t.textContent=fmt(Math.max(0,Math.ceil(left)))}
function stop(){clearInterval(tick);tick=null;$("#fwStart").textContent="Start"}
function timer(){const f=$("#workoutForm");if(!f||$("#fwTimer"))return;const c=card("fwTimer",f);
 c.innerHTML=`<h2>Rest timer</h2><div class="fw-timer" id="fwTime">1:00</div><div class="fw-btns">${[30,60,90,120].map(s=>`<button class="btn btn-secondary" type="button" data-fwrest="${s}">${s}s</button>`).join("")}</div><div class="fw-btns"><button class="btn btn-primary" type="button" id="fwStart">Start</button><button class="btn btn-quiet" type="button" id="fwReset">Reset</button></div>`;showT()}
/* Social: comments + delete own posts */
const open=new Set(),cm=id=>X().comments[id]||[];
function social(){$$("#feedList .post-card").forEach(el=>{const b=el.querySelector("[data-like]");if(!b)return;const id=b.dataset.like,list=cm(id),p=data.posts.find(x=>String(x.id)===id),ac=el.querySelector(".post-actions");
 ac.insertAdjacentHTML("beforeend",`<button data-fwc="${id}">💬 Comments (${list.length})</button>`);
 if(p&&!p.sample&&p.name===data.profile.name)ac.insertAdjacentHTML("beforeend",`<button data-fwdel="${id}">Delete</button>`);
 if(open.has(id))el.insertAdjacentHTML("beforeend",`<div class="fw-thread">${list.map(c=>`<div class="exercise-item"><span><strong>${esc(c.name)}</strong><br>${esc(c.text)}</span><small>${esc(c.date)}</small></div>`).join("")||'<p class="muted small">No comments yet.</p>'}<form data-fwcf="${id}" class="post-form"><div class="post-form-bottom"><input name="t" maxlength="300" placeholder="Write a comment" required><button class="btn btn-secondary" type="submit">Post</button></div></form></div>`)})}
/* Marketplace: cart */
const prod=id=>gymAllProducts().find(p=>p.id===id);
function cart(){const p=$("#gymMarketplacePanel");if(!p)return;const c=card("fwCart",p,true),items=Object.entries(X().cart).map(([id,q])=>[prod(id),q]).filter(([p])=>p),sum=items.reduce((s,[p,q])=>s+p.price*q,0);
 c.innerHTML=`<h2>Your cart</h2>${items.length?items.map(([p,q])=>`<div class="fw-row"><span><strong>${gymSafe(p.title)}</strong><br><small class="muted">${gymMoney(p.price)} each</small></span><span class="fw-qty"><button class="btn btn-secondary" data-fwq="${p.id}:-1">−</button>${q}<button class="btn btn-secondary" data-fwq="${p.id}:1">+</button><button class="btn btn-quiet" data-fwq="${p.id}:0">Remove</button></span></div>`).join("")+`<div class="fw-row"><strong>Total</strong><strong>${gymMoney(sum)}</strong></div><p class="small muted">Demo checkout: no payment is collected.</p><button class="btn btn-primary" id="fwPlace">Place demo order</button>`:'<p class="muted small">Your cart is empty. Add items from the shop above.</p>'}`}
/* Hook into the existing render functions */
const _ra=renderAll;renderAll=function(){_ra();dash();cart()};
const _rp=renderPosts;renderPosts=function(){_rp();social()};
const _rm=gymRenderMarketplace;gymRenderMarketplace=function(){_rm();$$("[data-gym-buy]").forEach(b=>b.textContent="Add to cart");cart()};
/* Events */
window.addEventListener("click",e=>{const b=e.target.closest("[data-gym-buy]");if(!b)return;e.stopImmediatePropagation();e.preventDefault();const c=X().cart;c[b.dataset.gymBuy]=(c[b.dataset.gymBuy]||0)+1;save();toast("Added to cart.")},true);
document.addEventListener("click",e=>{const t=e.target;let b;
 if(b=t.closest("[data-fwrest]")){stop();pre=left=Number(b.dataset.fwrest);showT()}
 else if(t.closest("#fwStart")){if(tick){left=Math.max(0,(end-Date.now())/1000);stop();return}if(left<=0)left=pre;end=Date.now()+left*1000;$("#fwStart").textContent="Pause";tick=setInterval(()=>{left=(end-Date.now())/1000;showT();if(left<=0){stop();left=pre;showT();toast("Rest over. Time for your next set.");navigator.vibrate&&navigator.vibrate([200,100,200])}},250)}
 else if(t.closest("#fwReset")){stop();left=pre;showT()}
 else if(b=t.closest("[data-fwc]")){const id=b.dataset.fwc;open.has(id)?open.delete(id):open.add(id);renderPosts()}
 else if(b=t.closest("[data-fwdel]")){if(confirm("Delete this post and its comments?")){const id=b.dataset.fwdel;data.posts=data.posts.filter(p=>String(p.id)!==id);delete X().comments[id];open.delete(id);save();toast("Post deleted.")}}
 else if(b=t.closest("[data-fwq]")){const[id,d]=b.dataset.fwq.split(":"),c=X().cart;const q=d==="0"?0:(c[id]||0)+Number(d);q>0?c[id]=q:delete c[id];save()}
 else if(t.closest("#fwPlace")){const items=Object.entries(X().cart).map(([id,q])=>[prod(id),q]).filter(([p])=>p);if(!items.length)return;items.forEach(([p,q],i)=>{const gr=X().group,pr=gr&&p.seller===gr.name&&(gr.plan==="Pro"||(!gr.plan&&Date.now()<new Date(gr.trialEnds))),rate=pr?1:5,gross=p.price*q,fee=Math.round(gross*rate)/100;gymMarketOrders.unshift({id:"order-"+Date.now()+i,title:p.title+(q>1?" ×"+q:""),price:gross,seller:p.seller,status:"Demo order · unpaid",date:today()});(data.extra.ledger=data.extra.ledger||[]).unshift({type:"Marketplace sale",title:p.title+(q>1?" ×"+q:""),date:today(),amount:gross,rate,fee,net:gross-fee})});X().cart={};save();gymRenderShop();toast("Demo order placed. No money was charged.")}});
document.addEventListener("submit",e=>{const f=e.target.closest("[data-fwcf]");if(!f)return;e.preventDefault();const id=f.dataset.fwcf,t=f.t.value.trim();if(!t)return;(X().comments[id]=cm(id).concat({name:data.profile.name,text:t,date:today()}));save()});
document.addEventListener("change",e=>{const m={fwWeekly:"weekly"}[e.target.id];if(!m)return;const v=Math.round(Number(e.target.value));if(v>0){X().goals[m]=v;save()}});
timer();renderAll();renderPosts();
})();
