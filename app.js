(() => {
"use strict";
const cfg=window.APP_CONFIG||{},ready=!!(window.supabase&&cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY);
const db=ready?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
let user=null,profile=null,properties=[],editingId=null,authMode="login",kind="";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>new Intl.NumberFormat("en-KE",{style:"currency",currency:"KES",maximumFractionDigits:0}).format(Number(n)||0);
const show=id=>$(id)?.classList.remove("hidden"),hide=id=>$(id)?.classList.add("hidden");
const toast=m=>{const t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),3500)};
const fallbackImage="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=85";
const isAdmin=()=>profile?.account_type==="admin";
function image(p){return p.image_url||fallbackImage}
function render(){
 const q=($("locationFilter").value||"").trim().toLowerCase(),type=$("typeFilter").value,price=Number($("priceFilter").value)||Infinity;
 const list=properties.filter(p=>(!kind||p.property_type===kind)&&(!type||p.property_type===type)&&(!q||String(p.location||"").toLowerCase().includes(q)||String(p.title||"").toLowerCase().includes(q))&&Number(p.price)<=price);
 $("propertyGrid").innerHTML=list.length?list.map(p=>`<article class="property-card"><div class="property-image" style="background-image:url('${esc(image(p))}')"><span class="badge">${esc(p.purpose||"For sale")}</span></div><div class="property-body"><h3>${esc(p.title)}</h3><div class="location">⌖ ${esc(p.location)} · ${esc(p.property_type)}</div><div class="price">${money(p.price)}</div><div class="meta"><span>▦ ${Number(p.bedrooms)||0} beds</span><span>◫ ${Number(p.bathrooms)||0} baths</span><span>${p.verified?"Verified":"Availability to be confirmed"}</span></div><div class="card-actions"><button class="btn primary" data-view="${esc(p.id)}">View property</button>${user&&user.id===p.user_id?'<button class="btn outline" data-edit="'+esc(p.id)+'">Edit</button>':''}</div></div></article>`).join(""):'<div class="empty">No matching properties yet. Try changing your filters.</div>';
}
async function load(){
 if(!db){$("propertyGrid").innerHTML='<div class="empty">NyumbaLink could not connect. Check Supabase configuration.</div>';return}
 const {data,error}=await db.from("nl_properties").select("id,user_id,title,property_type,purpose,location,price,bedrooms,bathrooms,description,image_url,status,verified,created_at").eq("status","available").order("created_at",{ascending:false});
 if(error){$("propertyGrid").innerHTML='<div class="empty">Listings could not load: '+esc(error.message)+'</div>';console.error(error);return}
 properties=data||[];render();
}
function updateNav(){
 $("loginBtn").classList.toggle("hidden",!!user);$("logoutBtn").classList.toggle("hidden",!user);
 $("listBtn").textContent=user?"＋ Add property":"List a property";
 $("leadsNav").classList.toggle("hidden",!isAdmin());$("leads").classList.toggle("hidden",!isAdmin());
}
async function loadProfile(u){
 profile=null;if(!u||!db)return;
 const {data,error}=await db.from("nl_profiles").select("user_id,full_name,phone,account_type").eq("user_id",u.id).maybeSingle();
 if(error)console.warn("Profile read:",error.message);profile=data||null;
}
async function ensureProfile(u){
 if(!u||!db)return;
 const {error}=await db.from("nl_profiles").upsert({user_id:u.id,full_name:u.user_metadata?.full_name||u.email?.split("@")[0]||"NyumbaLink user",account_type:"buyer"},{onConflict:"user_id",ignoreDuplicates:true});
 if(error)console.warn("Profile setup:",error.message);
}
async function applySession(u){
 user=u||null;
 if(user){await ensureProfile(user);await loadProfile(user)}else profile=null;
 updateNav();await load();if(isAdmin())await loadLeads();
}
async function session(){
 if(!db){$("propertyGrid").innerHTML='<div class="empty">Supabase is not configured.</div>';return}
 const {data,error}=await db.auth.getSession();if(error)toast(error.message);
 await applySession(data?.session?.user||null);
 db.auth.onAuthStateChange((_event,s)=>{setTimeout(()=>applySession(s?.user||null),0)});
}
function openAuth(){authMode="login";$("authTitle").textContent="Sign in";$("authSubmit").textContent="Sign in";$("authMessage").textContent="";$("authForm").reset();renderAuthSwitch();show("authModal")}
function renderAuthSwitch(){$("authSwitch").innerHTML=authMode==="login"?'New here? <button type="button" class="text-btn" id="switchAuth">Create an account</button>':'Already registered? <button type="button" class="text-btn" id="switchAuth">Sign in</button>'}
function switchAuth(){authMode=authMode==="login"?"signup":"login";$("authTitle").textContent=authMode==="login"?"Sign in":"Create your account";$("authSubmit").textContent=authMode==="login"?"Sign in":"Create account";$("authMessage").textContent="";renderAuthSwitch()}
$("authSwitch").addEventListener("click",e=>{if(e.target.closest("#switchAuth"))switchAuth()});
$("authForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!db){$("authMessage").textContent="Supabase is not configured.";return}
 const btn=$("authSubmit"),email=$("authEmail").value.trim(),password=$("authPassword").value;btn.disabled=true;btn.textContent="Please wait…";$("authMessage").textContent="";
 try{const r=authMode==="login"?await db.auth.signInWithPassword({email,password}):await db.auth.signUp({email,password,options:{data:{full_name:email.split("@")[0]}}});if(r.error)throw r.error;
 if(authMode==="signup"&&!r.data.session){$("authMessage").className="message success-message";$("authMessage").textContent="Account created. Confirm your email, then return and sign in.";return}
 await applySession(r.data.user||r.data.session?.user);hide("authModal");toast("Welcome to NyumbaLink.");
 }catch(err){$("authMessage").textContent=err.message||"Authentication failed."}finally{btn.disabled=false;btn.textContent=authMode==="login"?"Sign in":"Create account"}
});
function openListing(p){
 if(!user){openAuth();toast("Sign in to manage property listings.");return}
 editingId=p?.id||null;$("listingTitle").textContent=p?"Edit property listing":"Create a property listing";$("listingMessage").textContent="";
 const form=$("listingForm");form.reset();if(p)Object.entries(p).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v??""});
 show("listingModal");
}
$("listingForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!db||!user)return;const btn=e.submitter;if(btn){btn.disabled=true;btn.textContent="Saving…"}
 try{const payload=Object.fromEntries(new FormData(e.currentTarget).entries());["price","bedrooms","bathrooms"].forEach(k=>payload[k]=Number(payload[k])||0);
 payload.user_id=user.id;payload.status="available";payload.updated_at=new Date().toISOString();delete payload.contact_phone;
 const result=editingId?await db.from("nl_properties").update(payload).eq("id",editingId).eq("user_id",user.id):await db.from("nl_properties").insert(payload).select("id").single();
 if(result.error)throw result.error;
 hide("listingModal");toast(editingId?"Listing updated.":"Property published.");editingId=null;await load();
 }catch(err){$("listingMessage").textContent=err.message||"Could not save listing."}finally{if(btn){btn.disabled=false;btn.textContent="Save property listing"}}
});
function openInquiry(id){$("inquiryForm").reset();$("inquiryPropertyId").value=id;$("inquiryFeedback").textContent="";show("inquiryModal")}
async function detail(id){
 const p=properties.find(x=>String(x.id)===String(id));if(!p)return;
 $("detailContent").innerHTML=`<div class="detail-image" style="background-image:url('${esc(image(p))}')"></div><span class="eyebrow">${esc(p.purpose||"PROPERTY")} · ${esc(p.property_type)}</span><h2>${esc(p.title)}</h2><div class="location">⌖ ${esc(p.location)}</div><p class="detail-price">${money(p.price)}</p><p class="detail-description">${esc(p.description)}</p><p class="location">${Number(p.bedrooms)||0} bedrooms · ${Number(p.bathrooms)||0} bathrooms</p><p>Interested? Send your details to NyumbaLink. Our team will confirm availability and coordinate with the listing broker.</p><button class="btn primary" data-enquire="${esc(p.id)}">Enquire through NyumbaLink ↗</button>${user?.id===p.user_id?'<button class="btn outline" id="deleteProperty">Delete listing</button>':''}<p class="message">Always view the property and verify ownership or authority before making payment.</p>`;
 if(user?.id===p.user_id)$("deleteProperty").onclick=async()=>{if(!confirm("Permanently delete this property?"))return;const {error}=await db.from("nl_properties").delete().eq("id",p.id).eq("user_id",user.id);if(error){toast(error.message);return}hide("detailModal");toast("Listing deleted.");await load()};
 show("detailModal");
}
$("inquiryForm").addEventListener("submit",async e=>{
 e.preventDefault();const btn=$("inquirySubmit");btn.disabled=true;btn.textContent="Sending…";
 try{const row={property_id:$("inquiryPropertyId").value,customer_name:$("inquiryName").value.trim(),phone:$("inquiryPhone").value.trim(),customer_email:$("inquiryEmail").value.trim()||null,message:$("inquiryMessage").value.trim(),status:"new"};
 const {error}=await db.from("nl_inquiries").insert(row);if(error)throw error;
 $("inquiryFeedback").className="message success-message";$("inquiryFeedback").textContent="Thank you. Your enquiry has been sent to NyumbaLink. We will contact you shortly.";e.currentTarget.reset();toast("Enquiry sent successfully.");
 }catch(err){$("inquiryFeedback").textContent=err.message||"Could not send enquiry. Please try again."}finally{btn.disabled=false;btn.textContent="Send enquiry"}
});
async function loadLeads(){
 if(!isAdmin())return;const board=$("leadBoard");board.innerHTML='<div class="empty">Loading customer enquiries…</div>';
 const {data,error}=await db.from("nl_inquiries").select("*,nl_properties(title,location,price)").order("created_at",{ascending:false});
 if(error){board.innerHTML='<div class="empty">Could not load leads: '+esc(error.message)+'</div>';return}
 const rows=data||[],expected=rows.reduce((s,r)=>s+Number(r.commission_expected||0),0),received=rows.reduce((s,r)=>s+Number(r.commission_received||0),0);
 $("leadSummary").innerHTML='<div><b>'+rows.length+'</b><span>Total enquiries</span></div><div><b>'+money(expected)+'</b><span>Expected commission</span></div><div><b>'+money(received)+'</b><span>Commission received</span></div>';
 board.innerHTML=rows.length?rows.map(r=>`<article class="property-card"><div class="property-body"><span class="eyebrow">${esc(r.status.replaceAll("_"," ").toUpperCase())}</span><h3>${esc(r.customer_name||"Customer")} · ${esc(r.nl_properties?.title||"Property")}</h3><div class="location">${esc(r.nl_properties?.location||"")} · ${esc(r.phone||"")}</div><p class="detail-description">${esc(r.message)}</p><label>Lead stage<select data-lead-status="${r.id}">${["new","contacted","viewing_arranged","negotiating","closed","lost"].map(s=>'<option value="'+s+'" '+(r.status===s?'selected':'')+'>'+s.replaceAll("_"," ")+'</option>').join("")}</select></label><label>Original broker / source name<input data-source-name="${r.id}" placeholder="Broker or agency name"></label><label>Private broker phone<input data-source-phone="${r.id}" placeholder="+254..."></label><label>Source advert URL<input data-source-url="${r.id}" placeholder="https://..."></label><label>Expected commission (KES)<input type="number" min="0" data-commission-expected="${r.id}" value="${Number(r.commission_expected||0)}"></label><label>Commission received (KES)<input type="number" min="0" data-commission-received="${r.id}" value="${Number(r.commission_received||0)}"></label><button class="btn primary" data-save-lead="${r.id}">Save lead details</button></div></article>`).join(""):'<div class="empty">No customer enquiries yet.</div>';
 // Load private broker source for each associated property only inside admin workspace.
 const ids=[...new Set(rows.map(r=>r.property_id))];if(ids.length){const {data:sources}=await db.from("nl_property_sources").select("*").in("property_id",ids);(sources||[]).forEach(s=>{const name=document.querySelector('[data-source-name="'+s.property_id+'"]');const phone=document.querySelector('[data-source-phone="'+s.property_id+'"]');const url=document.querySelector('[data-source-url="'+s.property_id+'"]');if(name)name.value=s.source_name||"";if(phone)phone.value=s.source_phone||"";if(url)url.value=s.source_url||""})}
}
$("leadBoard").addEventListener("click",async e=>{
 const b=e.target.closest("[data-save-lead]");if(!b)return;const id=b.dataset.saveLead;
 try{const get=attr=>document.querySelector('['+attr+'="'+id+'"]')?.value;
 const expected=Number(get("data-commission-expected")||0),received=Number(get("data-commission-received")||0);if(received>expected)throw new Error("Commission received cannot exceed expected commission.");
 const {error}=await db.from("nl_inquiries").update({status:get("data-lead-status"),commission_expected:expected,commission_received:received,commission_status:received>=expected&&expected>0?"paid":received>0?"part_paid":expected>0?"expected":"not_agreed"}).eq("id",id);if(error)throw error;
 const row=(await db.from("nl_inquiries").select("property_id").eq("id",id).single()).data;
 if(row){const source={property_id:row.property_id,source_name:get("data-source-name")||"Unspecified broker",source_phone:get("data-source-phone")||"Not provided",source_url:get("data-source-url")||null,updated_at:new Date().toISOString()};
 const {error:se}=await db.from("nl_property_sources").upsert(source,{onConflict:"property_id"});if(se)throw se}
 toast("Lead and private broker details saved.");await loadLeads();
 }catch(err){toast(err.message||"Could not save lead.")}
});
$("propertyGrid").addEventListener("click",e=>{const v=e.target.closest("[data-view]"),ed=e.target.closest("[data-edit]");if(v)detail(v.dataset.view);if(ed)openListing(properties.find(p=>String(p.id)===ed.dataset.edit))});
$("detailModal").addEventListener("click",e=>{const b=e.target.closest("[data-enquire]");if(b){hide("detailModal");openInquiry(b.dataset.enquire)}});
$("loginBtn").onclick=openAuth;$("logoutBtn").onclick=async()=>{const {error}=await db.auth.signOut();if(error){toast(error.message);return}await applySession(null);toast("Signed out.")};
$("listBtn").onclick=()=>openListing();$("ctaList").onclick=()=>openListing();$("searchBtn").onclick=render;$("refreshBtn").onclick=load;$("reloadLeads").onclick=loadLeads;
["typeFilter","locationFilter","priceFilter"].forEach(id=>$(id).addEventListener("input",render));
document.querySelectorAll("[data-kind]").forEach(b=>b.onclick=()=>{kind=b.dataset.kind;document.querySelectorAll("[data-kind]").forEach(x=>x.classList.toggle("active",x===b));render()});
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>hide(b.dataset.close));
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)hide(m.id)}));
$("year").textContent=new Date().getFullYear();session();
})();