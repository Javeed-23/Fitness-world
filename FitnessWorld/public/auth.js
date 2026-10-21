(()=>{
const form=document.querySelector("form[data-auth]"),msg=document.getElementById("msg"),kind=form.dataset.auth;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pwProblem=p=>p.length<10?"Password must be at least 10 characters.":(!/[A-Za-z]/.test(p)||!/\d/.test(p))?"Password must include a letter and a number.":"";
document.querySelectorAll(".pw-toggle").forEach(b=>b.addEventListener("click",()=>{const i=b.previousElementSibling,s=i.type==="password";i.type=s?"text":"password";b.textContent=s?"Hide":"Show";b.setAttribute("aria-pressed",String(s))}));
const show=(t,ok)=>{msg.textContent=t;msg.className=ok?"notice":"notice auth-error";msg.hidden=false};
function check(f){
  if(f.name!==undefined&&f.name.trim().length<2)return "Enter your full name.";
  if(f.goal!==undefined&&!f.goal)return "Choose your fitness goal.";
  if(f.email!==undefined&&!EMAIL.test(f.email.trim()))return "Enter a valid email address.";
  if(kind==="login")return f.password?"":"Enter your password.";
  if(f.password!==undefined){const p=pwProblem(f.password);if(p)return p}
  if(f.confirmPassword!==undefined&&f.password!==f.confirmPassword)return "Passwords do not match.";
  return "";
}
form.addEventListener("submit",async e=>{
  e.preventDefault();msg.hidden=true;
  const f=Object.fromEntries(new FormData(form)),err=check(f);
  if(err)return show(err);
  if(kind==="reset")f.token=new URLSearchParams(location.search).get("token")||"";
  const btn=form.querySelector("button[type=submit]");btn.disabled=true;
  try{
    const r=await fetch(form.dataset.api,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(f)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)return show(d.error||"Something went wrong. Try again.");
    if(kind==="login"||kind==="register")return location.replace("/");
    if(kind==="forgot"){form.reset();return show(d.message,true)}
    show("Password updated. Taking you to log in.",true);setTimeout(()=>location.replace("/login"),1200);
  }catch{show("Can't reach the server. Check your connection.")}
  finally{btn.disabled=false}
});
})();
