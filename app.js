(() => {
"use strict";
const cfg=window.APP_CONFIG||{};
const ready=!!(window.supabase&&cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY);
const db=ready?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
let user=null,properties=[],editingId=null,authMode="login",kind="";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>new Intl.NumberFormat("en-KE",{style:"currency",currency:"KES",maximumFractionDigits:0}).format(Number(n)||0);
const show=id=>$(id)?.classList.remove("hidden"),hide=id=>$(id)?.classList.add("hidden");
const toast=m=>{const t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),3500)};
const fallbackImage="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=85";
function image(p){return p.image_url||fallbackImage}
function configNotice(){if(!db)$("propertyGrid").innerHTML='<div class="empty">NyumbaLink could not connect. Check config.js and ensure Supabase JS loaded.</div>'}
function render(){
 const q=($("locationFilter").value||"").trim().toLowerCase(),type=$("typeFilter").value,price=Number($("priceFilter").value)||Infinity;
 const list=properties.filter(p=>(!kind||p.property_type===kind)&&(!type||p.property_type===type)&&(!q||String(p.location||"").toLowerCase().includes(q)||String(p.title||"").toLowerCase().includes(q))&&Number(p.price)<=price);
 $("propertyGrid").innerHTML=list.length?list.map(p=>`<article class="property-card"><div class="property-image" style="background-image:url('${esc(image(p))}')"><span class="badge">${esc(p.purpose||"For sale")}</span></div><div class="property-body"><h3>${esc(p.title)}</h3><div class="location">⌖ ${esc(p.location)} · ${esc(p.property_type)}</div><div class="price">${money(p.price)}</div><div class="meta"><span>▦ ${Number(p.bedrooms)||0} beds</span><span>◫ ${Number(p.bathrooms)||0} baths</span><span>${esc(p.status||"Available")}</span></div><div class="card-actions"><button class="btn primary" data-view="${esc(p.id)}">View property</button>${user&&user.id===p.user_id?'<button class="btn outline" data-edit="'+esc(p.id)+'">Edit</button>':''}</div></div></article>`).join(""):'<div class="empty">No matching properties yet. Try changing your filters.</div>';
}
async function load(){
 if(!db){configNotice();return}
 const {data,error}=await db.from("nl_properties").select("*").eq("status","available").order("created_at",{ascending:false});
 if(error){$("propertyGrid").innerHTML='<div class="empty">Listings could not load: '+esc(error.message)+'</div>';console.error(error);return}
 properties=data||[];render();
}
function updateNav(){
 $("loginBtn").classList.toggle("hidden",!!user);$("logoutBtn").classList.toggle("hidden",!user);
 $("listBtn").textContent=user?"＋ Add property":"List a property";
}
async function ensureProfile(u){
 if(!u||!db)return;
 const profile={user_id:u.id,full_name:u.user_metadata?.full_name||u.email?.split("@")[0]||"NyumbaLink user",phone:u.user_metadata?.phone||"",account_type:"buyer"};
 const {error}=await db.from("nl_profiles").upsert(profile,{onConflict:"user_id",ignoreDuplicates:true});
 if(error)console.warn("Profile setup:",error.message);
}
async function applySession(u){
 user=u||null;updateNav();
 if(user)await ensureProfile(user);
 await load();
}
async function session(){
 if(!db){configNotice();return}
 const {data,error}=await db.auth.getSession();
 if(error)toast(error.message);
 await applySession(data?.session?.user||null);
 db.auth.onAuthStateChange((_event,s)=>{setTimeout(()=>applySession(s?.user||null),0)});
}
function openAuth(){
 authMode="login";$("authTitle").textContent="Sign in";$("authSubmit").textContent="Sign in";
 $("authMessage").textContent="";$("authForm").reset();renderAuthSwitch();show("authModal");
}
function renderAuthSwitch(){
 $("authSwitch").innerHTML=authMode==="login"?'New here? <button type="button" class="text-btn" id="switchAuth">Create an account</button>':'Already registered? <button type="button" class="text-btn" id="switchAuth">Sign in</button>';
}
function switchAuth(){
 authMode=authMode==="login"?"signup":"login";
 $("authTitle").textContent=authMode==="login"?"Sign in":"Create your account";
 $("authSubmit").textContent=authMode==="login"?"Sign in":"Create account";
 $("authMessage").textContent="";renderAuthSwitch();
}
$("authSwitch").addEventListener("click",e=>{if(e.target.closest("#switchAuth"))switchAuth()});
$("authForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!db){$("authMessage").textContent="Supabase is not configured.";return}
 const btn=$("authSubmit"),email=$("authEmail").value.trim(),password=$("authPassword").value;
 btn.disabled=true;btn.textContent="Please wait…";$("authMessage").textContent="";
 try{
  const r=authMode==="login"?await db.auth.signInWithPassword({email,password}):await db.auth.signUp({email,password,options:{data:{full_name:email.split("@")[0]}}});
  if(r.error)throw r.error;
  if(authMode==="signup"&&!r.data.session){
   $("authMessage").className="message success-message";
   $("authMessage").textContent="Account created. Check your email for the confirmation link. After confirming, return here and sign in.";
   return;
  }
  await applySession(r.data.user||r.data.session?.user);hide("authModal");toast(authMode==="signup"?"Your account is ready.":"Welcome back."); 
 }catch(err){$("authMessage").textContent=err.message||"Authentication failed."}
 finally{btn.disabled=false;btn.textContent=authMode==="login"?"Sign in":"Create account"}
});
function openListing(p){
 if(!user){openAuth();toast("Sign in to create a property listing.");return}
 editingId=p?.id||null;$("listingTitle").textContent=p?"Edit property listing":"Create a property listing";
 $("listingMessage").textContent="";const form=$("listingForm");form.reset();
 if(p)Object.entries(p).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v??""});
 show("listingModal");
}
$("listingForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!db||!user)return;
 const btn=e.submitter; if(btn){btn.disabled=true;btn.textContent="Saving…"}
 try{
  const payload=Object.fromEntries(new FormData(e.currentTarget).entries());
  ["price","bedrooms","bathrooms"].forEach(k=>payload[k]=Number(payload[k])||0);
  payload.user_id=user.id;payload.status="available";payload.updated_at=new Date().toISOString();
  let query=editingId?db.from("nl_properties").update(payload).eq("id",editingId).eq("user_id",user.id):db.from("nl_properties").insert(payload);
  const {error}=await query;if(error)throw error;
  hide("listingModal");toast(editingId?"Listing updated.":"Property listing published.");editingId=null;await load();
 }catch(err){$("listingMessage").textContent=err.message||"Could not save listing."}
 finally{if(btn){btn.disabled=false;btn.textContent="Save property listing"}}
});
async function detail(id){
 const p=properties.find(x=>String(x.id)===String(id));if(!p)return;
 $("detailContent").innerHTML=`<div class="detail-image" style="background-image:url('${esc(image(p))}')"></div><span class="eyebrow">${esc(p.purpose||"PROPERTY")} · ${esc(p.property_type)}</span><h2>${esc(p.title)}</h2><div class="location">⌖ ${esc(p.location)}</div><p class="detail-price">${money(p.price)}</p><p class="detail-description">${esc(p.description)}</p><p class="location">${Number(p.bedrooms)||0} bedrooms · ${Number(p.bathrooms)||0} bathrooms</p><p><b>Contact the lister</b><br>${esc(p.contact_phone||"Contact details not provided")}</p><a class="btn primary" href="https://wa.me/${String(p.contact_phone||"").replace(/\D/g,"")}?text=${encodeURIComponent("Hello, I saw your property listing on NyumbaLink: "+p.title)}" target="_blank" rel="noopener">WhatsApp lister ↗</a>${user?.id===p.user_id?'<button class="btn outline" id="deleteProperty">Delete listing</button>':''}<p class="message">Arrange a physical viewing and independently verify ownership documents before sending money.</p>`;
 if(user?.id===p.user_id)$("deleteProperty").onclick=async()=>{
  if(!confirm("Permanently delete this property listing?"))return;
  const {error}=await db.from("nl_properties").delete().eq("id",p.id).eq("user_id",user.id);
  if(error){toast(error.message);return}
  hide("detailModal");toast("Listing deleted.");await load();
 };
 show("detailModal");
}
$("propertyGrid").addEventListener("click",e=>{
 const view=e.target.closest("[data-view]"),edit=e.target.closest("[data-edit]");
 if(view)detail(view.dataset.view);
 if(edit)openListing(properties.find(p=>String(p.id)===edit.dataset.edit));
});
$("loginBtn").onclick=openAuth;
$("logoutBtn").onclick=async()=>{const {error}=await db.auth.signOut();if(error){toast(error.message);return}await applySession(null);toast("Signed out.")};
$("listBtn").onclick=()=>openListing();$("ctaList").onclick=()=>openListing();
$("searchBtn").onclick=render;$("refreshBtn").onclick=load;
["typeFilter","locationFilter","priceFilter"].forEach(id=>$(id).addEventListener("input",render));
document.querySelectorAll("[data-kind]").forEach(b=>b.onclick=()=>{kind=b.dataset.kind;document.querySelectorAll("[data-kind]").forEach(x=>x.classList.toggle("active",x===b));render()});
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>hide(b.dataset.close));
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)hide(m.id)}));
$("year").textContent=new Date().getFullYear();
session();
})();