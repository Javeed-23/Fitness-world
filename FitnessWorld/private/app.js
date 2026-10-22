const FW_USER = window.FW_USER || {id:"guest",name:"Fitness Member"};
const STORE_KEY = "fitnessworld_demo_v1_u" + FW_USER.id;
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const today = () => new Date().toISOString().slice(0,10);
const esc = (v="") => String(v).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const samplePosts = () => [
 {id:9001,name:"Arjun Fitness",text:"Week 6 of my strength journey 💪 Added one rep to my push-ups today. Small progress is still progress!",date:today(),likes:124,sample:true},
 {id:9002,name:"Priya Wellness",text:"Leg day complete 🔥 Squats, lunges and glute bridges. Remember to warm up and focus on good form.",date:today(),likes:86,sample:true},
 {id:9003,name:"Rahul Runs",text:"Morning 5K done 🏃‍♂️ Trying to be consistent instead of chasing a perfect workout. Who else trained today?",date:today(),likes:57,sample:true},
 {id:9004,name:"Meera Moves",text:"Quick fitness tip: keep a water bottle nearby and take regular sips throughout the day 💧",date:today(),likes:42,sample:true},
 {id:9005,name:"Vikram Lifts",text:"Today’s upper-body session: dumbbell rows, shoulder presses and curls. Logging workouts helps me stay accountable.",date:today(),likes:73,sample:true}
];
const defaultData = () => ({
 profile:{name:FW_USER.name||"Fitness Member",home:"dashboard",units:"Metric (kg, cm)",language:"English"},
 points:{member:0,gym:0}, workouts:[], measurements:[], foods:[], water:{date:today(),ml:0},
 gyms:[], challenges:[], activity:[], posts:samplePosts(), recovery:[]
});
let data = loadData();
function normalizeData(stored){const merged={...defaultData(),...stored};const existing=Array.isArray(stored.posts)?stored.posts:[];const existingIds=new Set(existing.map(p=>p.id));merged.posts=[...samplePosts().filter(p=>!existingIds.has(p.id)),...existing];return merged}
function loadData(){try{return normalizeData(JSON.parse(localStorage.getItem(STORE_KEY)||"{}"))}catch{return defaultData()}}
const DIRTY_KEY=STORE_KEY+"_unsent";
function save(){localStorage.setItem(STORE_KEY,JSON.stringify(data));localStorage.setItem(DIRTY_KEY,"1");renderAll();queueSync()}

/* Account sync. The server keeps this account's data; the browser keeps a copy so the app keeps working while a save is in flight.
   Every save names the version it was based on. If another window saved first, the server answers 409 and this window loads the latest data. */
let syncVersion=0,syncTimer=null,syncRunning=false,syncAgain=false;
const VERSION_KEY=STORE_KEY+"_version";
const knownVersion=()=>+localStorage.getItem(VERSION_KEY)||0;
function setSync(state,text){const el=$("#syncPill");if(el){el.textContent=text;el.dataset.state=state}}
function stable(v){if(Array.isArray(v))return"["+v.map(x=>stable(x)).join(",")+"]";if(v&&typeof v==="object")return"{"+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+":"+stable(v[k])).join(",")+"}";return JSON.stringify(v===undefined?null:v)}
const sameData=(a,b)=>stable(normalizeData(a))===stable(normalizeData(b));
function replaceData(next){const merged=normalizeData(next);Object.keys(data).forEach(k=>delete data[k]);Object.assign(data,merged);localStorage.setItem(STORE_KEY,JSON.stringify(data))}
function queueSync(){if(window.FW_OFFLINE)return;clearTimeout(syncTimer);syncTimer=setTimeout(pushSync,400)}
async function pushSync(){
  if(window.FW_OFFLINE)return;
  if(syncRunning){syncAgain=true;return}
  syncRunning=true;setSync("saving","Saving…");
  const sent=JSON.stringify(data);
  try{
    const res=await fetch("/api/me/data",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({baseVersion:syncVersion,data:JSON.parse(sent)})});
    if(res.status===401){location.href="/login";return}
    if(res.status===409){localStorage.removeItem(DIRTY_KEY);toast("Another window saved first. Loaded the latest data; your last change here was not saved.");syncRunning=false;await loadSync();return}
    if(!res.ok)throw new Error("save "+res.status);
    const j=await res.json();syncVersion=j.version;localStorage.setItem(VERSION_KEY,String(j.version));if(JSON.stringify(data)===sent)localStorage.removeItem(DIRTY_KEY);setSync("ok","Saved to your account");
  }catch(e){setSync("offline","Saved on this device, will retry");clearTimeout(syncTimer);syncTimer=setTimeout(pushSync,10000)}
  finally{syncRunning=false;if(syncAgain){syncAgain=false;queueSync()}}
}
async function loadSync(){
  if(window.FW_OFFLINE){setSync("offline","Preview: saved on this device");return}
  setSync("saving","Loading…");
  try{
    const res=await fetch("/api/me/data",{credentials:"same-origin",cache:"no-store"});
    if(res.status===401){location.href="/login";return}
    if(!res.ok)throw new Error("load "+res.status);
    const j=await res.json(),dirty=!!localStorage.getItem(DIRTY_KEY)&&!!localStorage.getItem(STORE_KEY);
    /* an unsent change from this browser: already on the server (the page was closed after it landed), or still on top of the latest version */
    if(dirty&&j.version>0&&j.data&&sameData(j.data,data)){syncVersion=j.version;localStorage.setItem(VERSION_KEY,String(j.version));localStorage.removeItem(DIRTY_KEY);setSync("ok","Saved to your account");return}
    if(dirty&&j.version===knownVersion()){syncVersion=j.version;setSync("saving","Saving your last changes");queueSync();return}
    if(dirty)toast("Your last change was not saved because the account changed elsewhere. Loaded the latest data.");
    localStorage.removeItem(DIRTY_KEY);
    if(j.version>0&&j.data){syncVersion=j.version;localStorage.setItem(VERSION_KEY,String(j.version));replaceData(j.data);renderAll();fillProfileForm();setSync("ok","Saved to your account")}
    else{syncVersion=0;setSync("ok","Saved to your account");if(localStorage.getItem(STORE_KEY))queueSync()}
  }catch(e){setSync("offline","Offline: using this device\'s copy")}
}
window.addEventListener("load",loadSync);
/* leaving the page: send a pending save with keepalive so the last change is not lost */
window.addEventListener("pagehide",()=>{if(window.FW_OFFLINE||!localStorage.getItem(DIRTY_KEY))return;clearTimeout(syncTimer);const body=JSON.stringify({baseVersion:syncVersion,data});if(body.length<60000)fetch("/api/me/data",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"same-origin",body,keepalive:true}).catch(()=>{})});
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.remove("hidden");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.add("hidden"),2800)}
function initials(name){return name.trim().split(/\s+/).slice(0,2).map(s=>s[0]||"").join("").toUpperCase()||"FM"}
function rankFor(points){if(points>=10000)return "International";if(points>=5000)return "National";if(points>=3000)return "Diamond";if(points>=1000)return "Gold";if(points>=500)return "Silver";return "Bronze"}
function nextRank(points){if(points<500)return `${points} / 500 points to Silver`;if(points<1000)return `${points} / 1,000 points to Gold`;if(points<3000)return `${points} / 3,000 points to Diamond`;if(points<5000)return `${points} / 5,000 points to National`;if(points<10000)return `${points} / 10,000 points to International`;return "Highest configured rank reached"}
function go(page){const target=$("#page-"+page);if(!target)return;$$(".page").forEach(p=>p.classList.toggle("active",p===target));$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));$("#pageHeading").textContent=({dashboard:"My Profile",progress:"My Progress",training:"Workout",gym:"Gym",arena:"Gym Arena",social:"Social Feed",settings:"Security & Settings"})[page]||"FitnessWorld";$("#sidebar").classList.remove("open");window.scrollTo({top:0,behavior:"smooth"});if(page==="settings")fillProfileForm()}
document.addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b){e.preventDefault();go(b.dataset.page)}});
$("#menuToggle").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
const exercises=[
["Bodyweight squat","Quads, glutes","Bodyweight"],["Push-up","Chest, triceps","Bodyweight"],["Incline push-up","Chest, triceps","Bench / wall"],["Glute bridge","Glutes, hamstrings","Bodyweight"],["Dumbbell curl","Biceps","Dumbbells"],["Dumbbell row","Back, biceps","Dumbbells"],["Plank","Core","Bodyweight"],["Hip hinge","Glutes, hamstrings","Bodyweight / barbell"]
];
function renderExercises(filter=""){const rows=exercises.filter(x=>x.join(" ").toLowerCase().includes(filter.toLowerCase()));$("#exerciseList").innerHTML=rows.map(x=>`<div class="exercise-item"><div><strong>${esc(x[0])}</strong><br><small>${esc(x[1])}</small></div><small>${esc(x[2])}</small></div>`).join("")||'<p class="muted small">No matching exercises.</p>'}
$("#exerciseSearch").addEventListener("input",e=>renderExercises(e.target.value));
function renderAll(){
const p=data.profile;$("#sideName").textContent=p.name;$("#profileName").textContent=p.name;$("#profileInitials").textContent=initials(p.name);$("#memberPoints").textContent=data.points.member;$("#gymPoints").textContent=data.points.gym;$("#rankText").textContent=rankFor(data.points.member);$("#rankStat").textContent=rankFor(data.points.member);$("#rankProgress").textContent=nextRank(data.points.member);
$("#workoutStat").textContent=data.workouts.length;$("#progressWorkouts").textContent=data.workouts.length;$("#challengeStat").textContent=data.activity.filter(a=>a.action==="Joined").length;$("#streakStat").textContent=data.workouts.length?`${Math.min(data.workouts.length,30)} days`:"0 days";
$("#consistencyBar").style.width=Math.min(100,data.workouts.length/5*100)+"%";
$("#workoutRows").innerHTML=data.workouts.length?data.workouts.slice().reverse().map(w=>`<tr><td>${esc(w.date)}</td><td><strong>${esc(w.name)}</strong><br><span class="muted">${esc(w.notes||"No notes")}</span></td><td>${esc(w.duration)} min</td><td>${esc(w.difficulty)}</td></tr>`).join(""):'<tr><td colspan="4" class="muted">No workouts logged yet.</td></tr>';
$("#measurementRows").innerHTML=data.measurements.length?data.measurements.slice().reverse().map(m=>`<tr><td>${esc(m.date)}</td><td>${m.weight?esc(m.weight)+" kg":"—"}</td><td>${m.waist?esc(m.waist)+" cm":"—"}</td><td>${esc(m.notes||"—")}</td></tr>`).join(""):'<tr><td colspan="4" class="muted">No measurements recorded yet.</td></tr>';

$("#gymRows").innerHTML=data.gyms.length?data.gyms.slice().reverse().map(g=>`<tr><td>${esc(g.type)}</td><td>${esc(g.details)}</td><td><span class="status-chip">${esc(g.status)}</span></td></tr>`).join(""):'<tr><td colspan="3" class="muted">No requests submitted.</td></tr>';
$("#challengeActivityRows").innerHTML=data.activity.length?data.activity.slice().reverse().map(a=>`<tr><td>${esc(a.name)}</td><td>${esc(a.action)}</td><td>${esc(a.status)}</td><td>${esc(a.score||"—")}</td></tr>`).join(""):'<tr><td colspan="4" class="muted">No challenge activity yet.</td></tr>';
renderChallenges();renderPosts();renderMeasurementsActivity();
}
function renderMeasurementsActivity(){const items=[];data.workouts.slice(-3).reverse().forEach(w=>items.push({date:w.date,text:`Completed workout: ${w.name}`}));data.activity.slice(-3).reverse().forEach(a=>items.push({date:a.date,text:`${a.action}: ${a.name}`}));items.sort((a,b)=>b.date.localeCompare(a.date));$("#recentActivity").innerHTML=items.length?items.slice(0,4).map(i=>`<div class="setting-row"><div><strong>${esc(i.text)}</strong><p class="small muted">${esc(i.date)}</p></div></div>`).join(""):'<div class="empty-symbol">↗</div><strong>Your activity will appear here</strong><p>Complete a workout or join a challenge to start building your history.</p>'}
$("#workoutForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);data.workouts.push({name:f.get("name"),duration:Number(f.get("duration")),difficulty:f.get("difficulty"),notes:f.get("notes"),date:today()});e.currentTarget.reset();save();toast("Workout logged in this browser.")});
$("#measurementForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(!f.get("weight")&&!f.get("waist"))return toast("Enter a weight or waist measurement.");data.measurements.push({date:f.get("date"),weight:f.get("weight"),waist:f.get("waist"),notes:f.get("notes")});e.currentTarget.reset();e.currentTarget.date.value=today();save();toast("Measurement saved.")});
$("#clearMeasurements").addEventListener("click",()=>{if(confirm("Clear all measurement history in this browser?")){data.measurements=[];save();toast("Measurement history cleared.")}});


document.addEventListener("submit",e=>{if(e.target.id!=="recoveryForm")return;e.preventDefault();const f=new FormData(e.target);const item={date:today(),feeling:f.get("feeling"),severity:f.get("severity"),notes:f.get("notes")};data.recovery.push(item);e.target.reset();const n=e.target.querySelector("#recoveryNotice");n.classList.remove("hidden");n.textContent=(item.feeling==="Joint pain"||item.feeling==="Injury concern"||item.severity==="Severe")?"Saved. Stop activities that cause pain and consider prompt advice from a qualified healthcare professional. This app does not diagnose injuries.":"Recovery check-in saved. Adjust training based on how you feel.";save();toast("Recovery check-in saved.")});
$$(".tab[data-tab]").forEach(t=>t.addEventListener("click",()=>{$$(".tab").forEach(x=>x.classList.toggle("active",x===t));$$(".tab-panel").forEach(p=>p.classList.toggle("active",p.id===t.dataset.tab))}));

$("#joinGymForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);data.gyms.push({type:"Join request",details:`Invite code: ${f.get("code")}`,status:"Demo request"});e.currentTarget.reset();save();toast("Demo join request saved locally.")});
$("#gymForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);data.gyms.push({type:"Gym verification",details:`${f.get("name")} · ${f.get("location")} · ${f.get("email")} · Documents: ${f.get("docs")}`,status:"Pending demo review"});e.currentTarget.reset();save();toast("Gym request saved locally; no documents were uploaded.")});
const demoChallenges=[
{id:"demo-1",name:"Two-Minute Push-up Challenge",level:"Local",category:"Calisthenics",mode:"Offline",description:"Complete the highest number of valid push-ups in two minutes under published technique rules.",fee:0,prize:"Trophy + gym merchandise",prizeValue:0,memberPoints:5,gymPoints:10,capacity:30,eligibility:"Registered members; beginner-friendly technique standards",scoring:"Highest valid repetition count wins. Tie-break: judge review of form and valid reps.",start:today(),end:today(),venue:"Example Community Gym",address:"Organizer must provide verified venue details",status:"Published demo",organizer:"Demo verified organizer",documents:"Organizer verification, event rules, venue/safety plan",funding:true,registrations:8,joined:false,submissions:[],winner:null},
{id:"demo-2",name:"Remote Plank Hold",level:"District",category:"Endurance",mode:"Online",description:"Submit a continuous video of a valid plank hold following the camera and identity rules.",fee:0,prize:"Fitness kit",prizeValue:0,memberPoints:5,gymPoints:10,capacity:100,eligibility:"Eligible participants in the district",scoring:"Longest valid hold wins. Tie-break: earliest valid submission, if published in advance.",start:today(),end:today(),venue:"",address:"",status:"Published demo",organizer:"Demo verified organizer",documents:"Organizer verification, rules, video evidence instructions",funding:true,registrations:12,joined:false,submissions:[],winner:null}
];
if(!data.challenges.length)data.challenges=demoChallenges;
function renderChallenges(){const q=($("#challengeSearch")?.value||"").toLowerCase(),lev=$("#levelFilter")?.value||"All";const list=data.challenges.filter(c=>(lev==="All"||c.level===lev)&&`${c.name} ${c.level} ${c.category} ${c.mode}`.toLowerCase().includes(q));$("#challengeCards").innerHTML=list.map(c=>`<article class="challenge-card card"><div class="challenge-top"><div><div class="challenge-tags"><span class="tag strong">${esc(c.level)}</span><span class="tag">${esc(c.mode==="Offline"?"Offline / in-person":"Online / video")}</span><span class="tag">${esc(c.category)}</span></div><h3 style="margin-top:12px">${esc(c.name)}</h3></div><span class="status-text">${esc(c.status)}</span></div><div class="challenge-description">${esc(c.description)}</div><div class="challenge-meta"><div><small>Prize</small><strong>${esc(c.prize)}</strong></div><div><small>Registration</small><strong>${Number(c.fee)===0?"Free":`₹${esc(c.fee)}`}</strong></div><div><small>Winner points</small><strong>${esc(c.memberPoints)} Member · ${esc(c.gymPoints)} Gym</strong></div><div><small>Dates</small><strong>${esc(c.start)} – ${esc(c.end)}</strong></div></div><div class="challenge-actions"><button class="btn btn-secondary" data-detail="${esc(c.id)}">View details</button>${c.status==="Published demo"||c.status==="Published"?`<button class="btn btn-primary" data-join="${esc(c.id)}" ${c.joined?"disabled":""}>${c.joined?"Joined":"Join challenge"}</button>`:`<button class="btn btn-secondary" data-detail="${esc(c.id)}">View status</button>`}</div></article>`).join("")||'<div class="card empty-state"><strong>No matching challenges</strong><p>Try another search or level.</p></div>'}
$("#challengeSearch").addEventListener("input",renderChallenges);$("#levelFilter").addEventListener("change",renderChallenges);
function openCreate(){ $("#challengeModal").classList.remove("hidden");document.body.style.overflow="hidden";syncModeFields()}
function closeModal(id){$(id).classList.add("hidden");document.body.style.overflow=""}
$("#createChallengeBtn").addEventListener("click",openCreate);$("#closeChallengeModal").addEventListener("click",()=>closeModal("#challengeModal"));$("#cancelChallenge").addEventListener("click",()=>closeModal("#challengeModal"));$("#closeDetailModal").addEventListener("click",()=>closeModal("#detailModal"));
$("#challengeMode").addEventListener("change",syncModeFields);$("#challengeLevel").addEventListener("change",()=>{const lev=$("#challengeLevel").value;$("#modeGuidance").textContent=["State","National","International"].includes(lev)?`${lev} challenges: offline is preferred, but the organizer may select online video if the rules and verification plan support it.`:"The organizer chooses one mode per challenge. Offline means the organizer arranges the event; online means evidence is submitted remotely.";});
function syncModeFields(){const mode=$("#challengeMode").value;$("#offlineFields").classList.toggle("hidden",mode!=="Offline");$("#onlineFields").classList.toggle("hidden",mode!=="Online");const lev=$("#challengeLevel").value;$("#modeGuidance").textContent=["State","National","International"].includes(lev)?`${lev} challenges: offline is preferred, but the organizer may select online video if the rules and verification plan support it.`:"The organizer chooses one mode per challenge. Offline means the organizer arranges the event; online means evidence is submitted remotely."}
$("#challengeForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(f.get("end")<f.get("start"))return toast("End date cannot be before the start date.");if(f.get("mode")==="Offline"&&(!f.get("venue").trim()||!f.get("address").trim()||!f.get("judges").trim()||!f.get("safety").trim()||!f.get("venueDocs").trim()))return toast("Complete all offline event arrangement fields.");if(f.get("mode")==="Online"&&(!f.get("camera").trim()||!f.get("onlineRules").trim()))return toast("Complete the online evidence rules.");const c={id:"c-"+Date.now(),name:f.get("name"),level:f.get("level"),category:f.get("category"),mode:f.get("mode"),description:`${f.get("category")} challenge. Eligibility: ${f.get("eligibility")}`,fee:Number(f.get("fee")),prize:f.get("prize"),prizeValue:Number(f.get("prizeValue")||0),memberPoints:Number(f.get("memberPoints")),gymPoints:Number(f.get("gymPoints")),capacity:Number(f.get("capacity")),eligibility:f.get("eligibility"),scoring:f.get("scoring"),start:f.get("start"),end:f.get("end"),venue:f.get("venue"),address:f.get("address"),judges:f.get("judges"),safety:f.get("safety"),venueDocs:f.get("venueDocs"),evidence:f.get("evidence"),camera:f.get("camera"),onlineRules:f.get("onlineRules"),documents:f.get("documents"),organizer:f.get("email"),status:"Submitted for review",funding:true,registrations:0,joined:false,submissions:[],winner:null,createdAt:today()};data.challenges.push(c);data.activity.push({date:today(),name:c.name,action:"Created",status:"Submitted for review"});save();e.currentTarget.reset();$("#challengeMode").value="Offline";syncModeFields();closeModal("#challengeModal");toast("Challenge submitted for simulated review. It is not publicly published.");});
document.addEventListener("click",e=>{const join=e.target.closest("[data-join]");if(join){const c=data.challenges.find(x=>x.id===join.dataset.join);if(!c)return;if(c.fee>0)return toast("Paid registration is disabled in this prototype.");if(c.joined)return;c.joined=true;c.registrations=(c.registrations||0)+1;data.activity.push({date:today(),name:c.name,action:"Joined",status:"Registered demo",score:"Pending"});save();toast("Joined demo challenge.");}const det=e.target.closest("[data-detail]");if(det)showChallenge(det.dataset.detail)});
function showChallenge(id){const c=data.challenges.find(x=>x.id===id);if(!c)return;$("#detailTitle").textContent=c.name;const items=[["Level",c.level],["Mode",c.mode==="Offline"?"Offline / in-person":"Online / remote video"],["Category",c.category],["Status",c.status],["Registration",c.fee===0?"Free":`₹${c.fee}`],["Prize",c.prize],["Prize value",c.prizeValue?`₹${c.prizeValue}`:"Not specified"],["Member Points",c.memberPoints],["Gym Points",c.gymPoints],["Eligibility",c.eligibility],["Scoring & tie-breaker",c.scoring],["Dates",`${c.start} – ${c.end}`],["Organizer",c.organizer],["Required documents",c.documents]];if(c.mode==="Offline")items.push(["Venue",`${c.venue||"Not provided"} · ${c.address||"Address missing"}`],["Judge/staff plan",c.judges||"Not provided"],["Safety plan",c.safety||"Not provided"],["Venue documents",c.venueDocs||"Not provided"]);else items.push(["Evidence",c.evidence||"Not provided"],["Camera / identity rules",c.camera||"Not provided"],["Online instructions",c.onlineRules||"Not provided"]);if(c.winner)items.push(["Winner",c.winner.name],["Final result",c.winner.status],["Prize status",c.winner.prizeStatus]);$("#detailBody").innerHTML=`<p class="muted small">${esc(c.description)}</p><div class="detail-list">${items.map(i=>`<div class="detail-item"><small>${esc(i[0])}</small><strong>${esc(i[1]||"Not provided")}</strong></div>`).join("")}</div><div class="notice">Prototype status only. Uploaded documents, organizer identity, payment, scores, and prize delivery are not verified by a server.</div>${c.status==="Submitted for review"?'<div class="notice"><strong>Review queue (demo)</strong><p>This challenge is awaiting admin review. The controls below simulate a review only and are not suitable for production access control.</p><button class="btn btn-secondary" data-review="approve" data-id="'+esc(c.id)+'">Simulate approval</button> <button class="btn btn-secondary" data-review="reject" data-id="'+esc(c.id)+'">Request corrections</button></div>':""}${c.joined?`<div class="notice"><strong>Your participation</strong><p>Submit a score for demo review. Do not enter sensitive identity information.</p><form id="scoreForm" data-score-id="${esc(c.id)}"><label>Demo score<input name="score" required maxlength="100" placeholder="e.g. 52 valid reps / 01:45"></label><label>Evidence note<input name="evidence" required maxlength="200" placeholder="Describe evidence (no file upload in demo)"></label><button class="btn btn-primary" type="submit">Submit demo performance</button></form></div>`:""}${c.submissions?.length?`<h3 style="margin-top:20px">Performance submissions</h3>${c.submissions.map((s,i)=>`<div class="setting-row"><div><strong>${esc(s.name)} · ${esc(s.score)}</strong><p class="small muted">${esc(s.evidence)} · ${esc(s.status)}</p></div><div>${s.status==="Pending review"?`<button class="btn btn-secondary" data-score-review="approve" data-id="${esc(c.id)}" data-index="${i}">Approve</button> <button class="btn btn-secondary" data-score-review="reject" data-id="${esc(c.id)}" data-index="${i}">Reject</button>`:""}</div></div>`).join("")}`:""}${c.status==="Results under review"||c.status==="In progress"||c.status==="Published demo"||c.status==="Published"?`<div class="notice"><strong>Organizer/admin demo tools</strong><p>In production, only authorized reviewers may approve scores or finalize winners. These controls are simulated in this local prototype.</p><button class="btn btn-secondary" data-start="${esc(c.id)}">Mark in progress</button> <button class="btn btn-secondary" data-results="${esc(c.id)}">Review results / choose winner</button></div>`:""}`;$("#detailFoot").innerHTML=`<button class="btn btn-secondary" id="detailCloseBottom">Close</button>${!c.joined&&(c.status==="Published demo"||c.status==="Published")?`<button class="btn btn-primary" data-join="${esc(c.id)}">${c.fee?"Paid registration unavailable":"Join challenge"}</button>`:""}`;$("#detailModal").classList.remove("hidden");document.body.style.overflow="hidden";$("#detailCloseBottom").addEventListener("click",()=>closeModal("#detailModal"))}
document.addEventListener("submit",e=>{if(e.target.id==="scoreForm"){e.preventDefault();const c=data.challenges.find(x=>x.id===e.target.dataset.scoreId);if(!c)return;c.submissions=c.submissions||[];c.submissions.push({name:data.profile.name,score:new FormData(e.target).get("score"),evidence:new FormData(e.target).get("evidence"),status:"Pending review",date:today()});data.activity.push({date:today(),name:c.name,action:"Submitted performance",status:"Pending review",score:new FormData(e.target).get("score")});save();showChallenge(c.id);toast("Performance submitted for demo review.");}});
document.addEventListener("click",e=>{const r=e.target.closest("[data-review]");if(r){const c=data.challenges.find(x=>x.id===r.dataset.id);if(!c)return;c.status=r.dataset.review==="approve"?"Published demo":"Changes requested";save();showChallenge(c.id);toast(`Demo review: ${c.status}.`)}const sr=e.target.closest("[data-score-review]");if(sr){const c=data.challenges.find(x=>x.id===sr.dataset.id);const s=c?.submissions?.[Number(sr.dataset.index)];if(!s)return;s.status=sr.dataset.scoreReview==="approve"?"Verified":"Rejected";save();showChallenge(c.id);toast(`Submission ${s.status.toLowerCase()}.`)}const st=e.target.closest("[data-start]");if(st){const c=data.challenges.find(x=>x.id===st.dataset.start);if(c){c.status="In progress";save();showChallenge(c.id)}}const rs=e.target.closest("[data-results]");if(rs){const c=data.challenges.find(x=>x.id===rs.dataset.results);if(!c)return;const verified=(c.submissions||[]).filter(s=>s.status==="Verified");if(!verified.length){toast("No verified submissions. Verify a score first.");return}const sorted=[...verified].sort((a,b)=>{const na=Number(String(a.score).match(/\d+(\.\d+)?/)?.[0]||0),nb=Number(String(b.score).match(/\d+(\.\d+)?/)?.[0]||0);return nb-na});const winner=sorted[0];if(!confirm(`Finalize demo winner ${winner.name} with score ${winner.score}? This awards configured demo points.`))return;c.winner={name:winner.name,score:winner.score,status:"Final demo result",prizeStatus:"Pending organizer delivery"};c.status="Completed";if(!c.pointsAwarded){data.points.member+=Number(c.memberPoints)||0;data.points.gym+=Number(c.gymPoints)||0;c.pointsAwarded=true}data.activity.push({date:today(),name:c.name,action:"Won (demo)",status:"Final demo result",score:`${winner.score}; +${c.memberPoints} member points`});save();showChallenge(c.id);toast("Demo winner finalized. No real prize or points were transferred.")}});
$("#postForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);data.posts.push({id:Date.now(),name:data.profile.name,text:f.get("text"),date:today(),likes:0});e.currentTarget.reset();save();toast("Demo post published locally.")});
function renderPosts(){$("#feedList").innerHTML=data.posts.slice().reverse().map(p=>`<article class="post-card card"><div class="post-head"><div class="avatar">${esc(initials(p.name))}</div><div><strong>${esc(p.name)}</strong><small>${esc(p.date)} · Demo post</small></div></div><div class="post-copy">${esc(p.text)}</div><div class="post-actions"><button data-like="${p.id}">♡ Like (${p.likes})</button><button data-report="${p.id}">Report</button></div></article>`).join("")||'<div class="card empty-state"><strong>No posts yet</strong><p>Be the first to share a training milestone.</p></div>'}
document.addEventListener("click",e=>{const l=e.target.closest("[data-like]");if(l){const p=data.posts.find(x=>x.id===Number(l.dataset.like));if(p){p.likes++;save()}}const r=e.target.closest("[data-report]");if(r){toast("Demo report noted only in this session. Production needs a real moderation queue.");}});
function fillProfileForm(){const f=$("#profileForm");f.elements.namedItem("name").value=data.profile.name;f.elements.namedItem("home").value=data.profile.home||"dashboard";f.elements.namedItem("units").value=data.profile.units||"Metric (kg, cm)";f.elements.namedItem("language").value=data.profile.language||"English"}
$("#profileForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);data.profile={name:f.get("name").trim(),home:f.get("home"),units:f.get("units"),language:f.get("language")};save();toast("Preferences saved in this browser.");});
function exportData(){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="fitnessworld-demo-data.json";a.click();URL.revokeObjectURL(url);toast("Export started.")}
$("#exportData").addEventListener("click",exportData);$("#downloadData").addEventListener("click",exportData);
$("#deleteData").addEventListener("click",()=>{if(confirm("Permanently clear your FitnessWorld data? This does not delete your account.")){data=defaultData();save();fillProfileForm();toast("Your data was cleared.")}});
$("#measurementForm").elements.namedItem("date").value=today();

// Gym hub tabs and marketplace demo interactions. All money labels use "platform fee".
const gymDemoProducts = [
 {id:"seed-1",title:"Custom Gym T-Shirt",category:"Products",price:499,emoji:"👕",seller:"Iron House Gym",desc:"Comfort-fit training tee with custom gym branding.",tag:"Popular"},
 {id:"seed-2",title:"Resistance Band Set",category:"Products",price:699,emoji:"💪",seller:"PowerFit Club",desc:"For warm-ups, mobility and home training.",tag:"Equipment"},
 {id:"seed-3",title:"Personal Training Session",category:"Coaching",price:799,emoji:"🏋️",seller:"Peak Performance Gym",desc:"One coaching session. Booking and qualifications must be confirmed.",tag:"Service"},
 {id:"seed-4",title:"4-Week Workout Planner",category:"Digital",price:199,emoji:"📋",seller:"Javid Fitness Club",desc:"Downloadable workout planner and tracking sheets.",tag:"Digital"},
 {id:"seed-5",title:"One-Day Gym Pass",category:"Gym passes",price:250,emoji:"🏢",seller:"Iron House Gym",desc:"One gym visit. Check location and terms with the gym.",tag:"Local"},
 {id:"seed-6",title:"Branded Shaker Bottle",category:"Products",price:299,emoji:"🥤",seller:"PowerFit Club",desc:"Reusable shaker bottle with gym branding.",tag:"Merch"}
];
let gymMarketListings = [];
let gymMarketOrders = [];
let gymMarketFilter = "All";
let gymSellerPlan = "Pro";
function gymMoney(n){return "₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2})}
function gymSafe(v){return esc(v)}
function gymAllProducts(){return [...gymMarketListings,...gymDemoProducts]}
function gymShowTab(id){
  $$(".gym-tab-panel").forEach(p=>p.classList.toggle("active",p.id===id));
  $$(".gym-hub-tabs .tab").forEach(b=>b.classList.toggle("active",b.dataset.gymtab===id));
  if(id==="gymMarketplacePanel")gymRenderMarketplace();
  if(id==="gymShopPanel")gymRenderShop();
}
$$("[data-gymtab]").forEach(b=>b.addEventListener("click",()=>gymShowTab(b.dataset.gymtab)));
document.addEventListener("click",e=>{
 const jump=e.target.closest("[data-gymjump]");
 if(jump){gymShowTab(jump.dataset.gymjump);return}
 const filter=e.target.closest("[data-market-filter]");
 if(filter){gymMarketFilter=filter.dataset.marketFilter;$$("[data-market-filter]").forEach(b=>b.classList.toggle("active",b===filter));gymRenderMarketplace();return}
 const buy=e.target.closest("[data-gym-buy]");
 if(buy){const p=gymAllProducts().find(x=>x.id===buy.dataset.gymBuy);if(!p)return;
   if(!confirm(`Create a demo order for ${p.title} (${gymMoney(p.price)})? No payment will be collected.`))return;
   gymMarketOrders.unshift({id:"order-"+Date.now(),title:p.title,price:p.price,seller:p.seller,status:"Demo order · unpaid",date:today()});
   gymRenderShop();toast("Demo order created. No money was charged.");return}
 const del=e.target.closest("[data-gym-delete]");
 if(del){gymMarketListings=gymMarketListings.filter(p=>p.id!==del.dataset.gymDelete);gymRenderMarketplace();gymRenderShop();toast("Demo listing removed.");return}
 const plan=e.target.closest("[data-plan-choice]");
 if(plan){gymSellerPlan=plan.dataset.planChoice;$("#gymMyPlanRate").textContent=gymSellerPlan==="Pro"?"1%":"5%";$("#gymFeePlan").value=gymSellerPlan==="Pro"?"1":"5";gymUpdateFeeCalculator();toast(`Demo plan preview changed to Gym ${gymSellerPlan}. No subscription was purchased.`)}
});
function gymRenderMarketplace(){
 const q=($("#gymMarketSearch")?.value||"").toLowerCase().trim();
 const items=gymAllProducts().filter(p=>(gymMarketFilter==="All"||p.category===gymMarketFilter)&&`${p.title} ${p.desc} ${p.seller} ${p.category}`.toLowerCase().includes(q));
 $("#gymMarketGrid").innerHTML=items.map(p=>`<article class="gym-market-product"><div class="gym-market-art"><span>${gymSafe(p.tag||"Gym shop")}</span>${p.emoji||"🏋️"}</div><div class="gym-market-product-body"><small class="muted">${gymSafe(p.category)}</small><h3>${gymSafe(p.title)}</h3><p>${gymSafe(p.desc)}</p><small class="muted">By ${gymSafe(p.seller)}</small><div class="gym-market-product-foot"><strong>${gymMoney(p.price)}</strong><button class="btn btn-primary" data-gym-buy="${gymSafe(p.id)}">View / order</button></div></div></article>`).join("")||'<div class="market-empty">No listings match your search. Try another category or term.</div>';
}
$("#gymMarketSearch").addEventListener("input",gymRenderMarketplace);
$("#gymMarketClear").addEventListener("click",()=>{$("#gymMarketSearch").value="";gymRenderMarketplace()});
$("#gymMarketListingForm").addEventListener("submit",e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);
 gymMarketListings.unshift({id:"user-"+Date.now(),title:String(f.get("title")).trim(),category:f.get("category"),price:Number(f.get("price")),emoji:f.get("emoji"),seller:String(f.get("seller")).trim(),desc:String(f.get("description")).trim(),availability:f.get("availability"),tag:"Demo listing"});
 e.currentTarget.reset();gymRenderMarketplace();gymRenderShop();gymShowTab("gymShopPanel");toast("Demo listing saved in this browser only.");
});
function gymRenderShop(){
 $("#gymMyListingCount").textContent=gymMarketListings.length;
 $("#gymMyOrderCount").textContent=gymMarketOrders.length;
 const rate=gymSellerPlan==="Pro"?1:5;
 $("#gymMyPlanRate").textContent=rate+"%";
 $("#gymMyPlatformFee").textContent=gymMoney(gymMarketOrders.reduce((s,o)=>s+o.price*rate/100,0));
 $("#gymMyListings").innerHTML=gymMarketListings.map(p=>`<div class="gym-demo-row"><div class="item-emoji">${p.emoji||"🏋️"}</div><div class="item-info"><strong>${gymSafe(p.title)}</strong><small>${gymSafe(p.category)} · ${gymMoney(p.price)} · Demo listing</small></div><button class="btn btn-secondary" data-gym-delete="${gymSafe(p.id)}">Delete</button></div>`).join("")||'<div class="empty-state card"><strong>No custom listings yet</strong><p>Create a product or service listing to see it here.</p></div>';
 $("#gymMyOrders").innerHTML=gymMarketOrders.map(o=>`<div class="gym-demo-row"><div class="item-emoji">🧾</div><div class="item-info"><strong>${gymSafe(o.title)}</strong><small>${gymSafe(o.seller)} · ${gymSafe(o.date)} · ${gymSafe(o.status)}</small></div><strong>${gymMoney(o.price)}</strong></div>`).join("")||'<div class="empty-state card"><strong>No demo orders yet</strong><p>Try the order button in the marketplace. It will not collect payment.</p></div>';
}
function gymUpdateFeeCalculator(){
 const amount=Math.max(0,Number($("#gymFeeSaleAmount").value)||0),rate=Number($("#gymFeePlan").value)||1;
 $("#gymFeeAmount").textContent=gymMoney(amount*rate/100);
 $("#gymSellerAmount").textContent=gymMoney(amount*(1-rate/100));
}
$("#gymFeeSaleAmount").addEventListener("input",gymUpdateFeeCalculator);
$("#gymFeePlan").addEventListener("change",gymUpdateFeeCalculator);
gymRenderMarketplace();gymRenderShop();gymUpdateFeeCalculator();

renderExercises();renderAll();fillProfileForm();

$("#logoutBtn").addEventListener("click",async()=>{try{await fetch("/api/auth/logout",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})}catch{}location.replace("/login")});
