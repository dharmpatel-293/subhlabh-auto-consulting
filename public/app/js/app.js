(() => {
  const cfg = window.APP_CONFIG || {};
  const configured = cfg.supabaseUrl && cfg.supabasePublishableKey &&
    !cfg.supabaseUrl.includes("YOUR_") && !cfg.supabasePublishableKey.includes("YOUR_");
  const supabase = configured && window.supabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)
    : null;

  const $ = (id) => document.getElementById(id);
  const state = { user:null, businessId:null, members:[], cars:[], costs:[], contributions:[], sales:[], allocations:[], language:localStorage.getItem("autoledger-language") || "en", activeCarId:null };
  const modals = {};
  ["carModal","costModal","detailModal","saleModal","profitModal","deleteCarModal"].forEach(id => modals[id] = null);
  document.addEventListener("DOMContentLoaded", init);

  function t(key){ return (window.I18N[state.language] || window.I18N.en)[key] || window.I18N.en[key] || key; }
  function money(n){ return new Intl.NumberFormat(state.language === "gu" ? "gu-IN" : "en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n||0)); }
  function dateLabel(s){ if(!s) return "—"; return new Intl.DateTimeFormat(state.language==="gu"?"gu-IN":"en-IN",{dateStyle:"medium"}).format(new Date(s+"T00:00:00")); }
  function esc(s){ return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function toast(message, type="success"){ const el=document.createElement("div"); el.className=`toast align-items-center text-bg-${type} border-0`; el.role="status"; el.innerHTML=`<div class="d-flex"><div class="toast-body">${esc(message)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`; $("toastHost").appendChild(el); const toastObj=new bootstrap.Toast(el,{delay:3500}); toastObj.show(); el.addEventListener("hidden.bs.toast",()=>el.remove()); }
  function showModal(id){ if(!modals[id]) modals[id]=new bootstrap.Modal($(id)); modals[id].show(); }
  function hideModal(id){ if(modals[id]) modals[id].hide(); }
  function setBusy(btn,busy){ if(!btn)return; btn.disabled=busy; btn.dataset.oldText ||= btn.innerHTML; btn.innerHTML=busy?'<span class="spinner-border spinner-border-sm me-2"></span>Saving…':btn.dataset.oldText; }
  function setLanguage(lang){ state.language=lang; localStorage.setItem("autoledger-language",lang); $("authLanguage").value=lang; $("appLanguage").value=lang; document.documentElement.lang=lang==="gu"?"gu":"en"; document.querySelectorAll("[data-i18n]").forEach(el=>{const key=el.dataset.i18n;if(t(key))el.textContent=t(key);}); document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>el.placeholder=t(el.dataset.i18nPlaceholder)); renderAll(); }
  function init(){
    Object.keys(modals).forEach(id=>{const el=$(id); if(el)modals[id]=new bootstrap.Modal(el);});
    $("authLanguage").value=state.language; $("appLanguage").value=state.language;
    $("authLanguage").addEventListener("change",e=>setLanguage(e.target.value));
    $("appLanguage").addEventListener("change",e=>setLanguage(e.target.value));
    $("loginForm").addEventListener("submit",signIn);
    $("forgotPassword").addEventListener("click",resetPassword);
    $("signOut").addEventListener("click",signOut);
    $("mainNav").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)showPage(b.dataset.page);});
    document.body.addEventListener("click",e=>{
      const action=e.target.closest("[data-action]")?.dataset.action;
      if(action==="add-car")openCarForm();
      if(action==="add-cost")openCostForm();
      const link=e.target.closest("[data-page-link]")?.dataset.pageLink;if(link)showPage(link);
      const detail=e.target.closest("[data-car-detail]")?.dataset.carDetail;if(detail)openDetails(detail);
      const edit=e.target.closest("[data-car-edit]")?.dataset.carEdit;if(edit)openCarForm(edit);
      const del=e.target.closest("[data-car-delete]")?.dataset.carDelete;if(del)deleteCar(del);
      const delCost=e.target.closest("[data-cost-delete]")?.dataset.costDelete;if(delCost)deleteCost(delCost);
    });
    $("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
    $("carForm").addEventListener("submit",saveCar);
    $("deleteCarForm").addEventListener("submit",confirmDeleteCar);
    $("costForm").addEventListener("submit",saveCost);
    $("saleForm").addEventListener("submit",saveSale);
    $("profitForm").addEventListener("submit",saveProfitAgreement);
    $("carSearch").addEventListener("input",renderCars);
    $("statusFilter").addEventListener("change",renderCars);
    $("recordSale").addEventListener("click",()=>{hideModal("detailModal");openSaleForm(state.activeCarId);});
    $("manageProfit").addEventListener("click",()=>{hideModal("detailModal");openProfitForm(state.activeCarId);});
    $("editDetailCar").addEventListener("click",()=>{hideModal("detailModal");openCarForm(state.activeCarId);});
    $("splitMethod").addEventListener("change",updateProfitLabels);
    $("profitValue1").addEventListener("input",updateProfitPreview);
    $("profitValue2").addEventListener("input",updateProfitPreview);
    $("exportCsv").addEventListener("click",exportCars);
    setLanguage(state.language);
    if(!supabase){$("authView").classList.remove("d-none");$("appView").classList.add("d-none");$("loginForm").querySelector("button[type=submit]").disabled=true;toast(t("setupNeeded"),"warning");return;}
    supabase.auth.getSession().then(({data})=>{if(data.session){state.user=data.session.user;enterApp();}});
    supabase.auth.onAuthStateChange((_event,session)=>{if(session && !state.user){state.user=session.user;enterApp();} else if(!session && state.user){state.user=null;state.businessId=null;showAuth();}});
  }
  async function signIn(e){e.preventDefault();if(!supabase){toast(t("invalidConfig"),"warning");return;}const btn=e.submitter;setBusy(btn,true);const {error}=await supabase.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});setBusy(btn,false);if(error)toast(error.message,"danger");}
  async function resetPassword(){if(!supabase)return toast(t("invalidConfig"),"warning");const email=$("email").value.trim();if(!email)return toast(t("email")+": enter your email first","warning");const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin});if(error)toast(error.message,"danger");else toast(t("emailSent"));}
  async function signOut(){if(supabase)await supabase.auth.signOut();state.user=null;showAuth();}
  function showAuth(){$("authView").classList.remove("d-none");$("appView").classList.add("d-none");}
  async function enterApp(){$("authView").classList.add("d-none");$("appView").classList.remove("d-none");$("sidebarUser").textContent=state.user.email||"Account";$("userAvatar").textContent=(state.user.email||"A").slice(0,1).toUpperCase();await loadBusiness();}
  async function loadBusiness(){
    try{
      const {data:members,error}=await supabase.from("business_members").select("business_id,user_id,role,profiles(id,full_name,preferred_language)").eq("user_id",state.user.id);
      if(error)throw error;
      if(!members?.length){state.businessId=null;toast(t("noBusiness"),"warning");return;}
      state.businessId=members[0].business_id;
      const {data:allMembers,error:memErr}=await supabase.from("business_members").select("business_id,user_id,role,joined_at,profiles(id,full_name,preferred_language)").eq("business_id",state.businessId).order("joined_at",{ascending:true}).order("user_id",{ascending:true});
      if(memErr)throw memErr;state.members=allMembers||[];
      const own=state.members.find(m=>m.user_id===state.user.id);if(own?.profiles?.preferred_language){state.language=own.profiles.preferred_language;localStorage.setItem("autoledger-language",state.language);$("authLanguage").value=state.language;$("appLanguage").value=state.language;}
      await loadData();setLanguage(state.language);
    }catch(err){console.error(err);toast(t("loadError"),"danger");}
  }
  async function loadData(){
    if(!state.businessId)return;
    const [cars,costs,contributions,sales,allocs]=await Promise.all([
      supabase.from("cars").select("*").eq("business_id",state.businessId).order("created_at",{ascending:false}),
      supabase.from("car_costs").select("*").eq("business_id",state.businessId).order("cost_date",{ascending:false}),
      supabase.from("cost_contributions").select("*").eq("business_id",state.businessId),
      supabase.from("car_sales").select("*").eq("business_id",state.businessId),
      supabase.from("profit_allocations").select("*").eq("business_id",state.businessId)
    ]);
    for(const r of [cars,costs,contributions,sales,allocs])if(r.error)throw r.error;
    state.cars=cars.data||[];state.costs=costs.data||[];state.contributions=contributions.data||[];state.sales=sales.data||[];state.allocations=allocs.data||[];renderAll();
  }
  function showPage(page){document.querySelectorAll(".page-panel").forEach(el=>el.classList.add("d-none"));$(`${page}Page`)?.classList.remove("d-none");document.querySelectorAll("#mainNav [data-page]").forEach(el=>el.classList.toggle("active",el.dataset.page===page));$("pageTitle").textContent=t(page==="dashboard"?"dashboard":page);$("sidebar").classList.remove("open");}
  function totalCost(carId){return state.costs.filter(c=>c.car_id===carId).reduce((s,c)=>s+Number(c.amount),0);}
  function saleFor(carId){return state.sales.find(s=>s.car_id===carId);}
  function carProfit(carId){const sale=saleFor(carId);return sale?Number(sale.sale_price)-totalCost(carId):null;}
  function renderAll(){renderDashboard();renderCars();renderCosts();renderPartners();renderReports();}
  function statusBadge(status){const key={available:"statusAvailable",repairing:"statusRepairing",sold:"statusSold",archived:"statusArchived"}[status]||status;return `<span class="badge-status status-${esc(status)}">${esc(t(key))}</span>`;}
  function carName(car){return `${car.brand} ${car.model}`;}
  function renderDashboard(){
    $("metricCars").textContent=state.cars.length;$("metricStock").textContent=state.cars.filter(c=>["available","repairing"].includes(c.status)).length;
    $("metricCosts").textContent=money(state.costs.reduce((s,c)=>s+Number(c.amount),0));
    $("metricProfit").textContent=money(state.sales.reduce((s,sale)=>s+Number(sale.sale_price)-totalCost(sale.car_id),0));
    const rows=state.cars.slice(0,5);$("recentCarsBody").innerHTML=rows.length?rows.map(c=>`<tr><td><div class="vehicle-name">${esc(carName(c))}</div><div class="vehicle-meta">${esc(c.fuel_type||"—")} · ${esc(c.transmission||"—")}</div></td><td>${esc(c.registration_number||"—")}</td><td>${statusBadge(c.status)}</td><td>${dateLabel(c.purchase_date)}</td><td class="text-end"><button class="btn btn-light btn-sm" data-car-detail="${c.id}">${esc(t("viewDetails"))}</button></td></tr>`).join(""):`<tr><td colspan="5"><div class="empty-state"><i class="bi bi-car-front"></i>${esc(t("noCars"))}<div>${esc(t("addFirstCar"))}</div></div></td></tr>`;
  }
  function renderCars(){
    const q=($("carSearch")?.value||"").toLowerCase();const status=$("statusFilter")?.value||"";
    const cars=state.cars.filter(c=>(!status||c.status===status)&&`${c.brand} ${c.model} ${c.registration_number||""}`.toLowerCase().includes(q));
    $("carsBody").innerHTML=cars.length?cars.map(c=>`<tr><td><div class="vehicle-name">${esc(carName(c))}</div><div class="vehicle-meta">${esc(c.fuel_type||"—")} · ${esc(c.transmission||"—")}</div></td><td>${esc(c.registration_number||"—")}</td><td>${esc(c.year||"—")}</td><td>${statusBadge(c.status)}</td><td>${dateLabel(c.purchase_date)}</td><td class="text-end text-nowrap"><button class="btn btn-light btn-sm" data-car-detail="${c.id}" aria-label="${esc(t("viewDetails"))}"><i class="bi bi-eye"></i></button> <button class="btn btn-light btn-sm" data-car-edit="${c.id}" aria-label="${esc(t("editCar"))}"><i class="bi bi-pencil"></i></button> <button class="btn btn-light btn-sm text-danger" data-car-delete="${c.id}" aria-label="${esc(t("delete"))}"><i class="bi bi-trash"></i></button></td></tr>`).join(""):`<tr><td colspan="6"><div class="empty-state"><i class="bi bi-car-front"></i>${esc(t("noCars"))}<div>${esc(t("addFirstCar"))}</div></div></td></tr>`;
  }
  function renderCosts(){
    $("costsBody").innerHTML=state.costs.length?state.costs.map(c=>{const car=state.cars.find(x=>x.id===c.car_id);return `<tr><td>${dateLabel(c.cost_date)}</td><td>${esc(car?carName(car):"—")}</td><td>${esc(t(c.category)||c.category)}</td><td>${esc(c.description)}</td><td class="fw-bold">${money(c.amount)}</td><td class="text-end"><button class="btn btn-light btn-sm text-danger" data-cost-delete="${c.id}"><i class="bi bi-trash"></i></button></td></tr>`}).join(""):`<tr><td colspan="6"><div class="empty-state"><i class="bi bi-receipt"></i>${esc(t("noCosts"))}</div></td></tr>`;
  }
  function renderPartners(){
    $("partnersBody").innerHTML=state.members.length?sortedMembers().map((m,i)=>{
      const total=state.contributions.filter(c=>c.member_id===m.user_id).reduce((sum,c)=>sum+Number(c.amount),0);
      const fallback=i===0?"Jitendra":"Pratik";
      const name=fallback;
      return `<tr><td class="fw-semibold">${esc(name)}${i===myIndex()?' <span class="badge text-bg-warning ms-1">You</span>':""}</td><td>${esc(m.role)}</td><td>${money(total)}</td></tr>`;
    }).join(""):`<tr><td colspan="3" class="text-secondary">${esc(t("noPartners"))}</td></tr>`;
  }
  const JITENDRA_EMAILS=["jitupatel7575@gmail.com","jitendrapatel7575@gmail.com"];
  function sortedMembers(){return state.members.slice().sort((a,b)=>new Date(a.joined_at||0)-new Date(b.joined_at||0)||String(a.user_id).localeCompare(String(b.user_id)));}
  function partnerName(i){return i===0?"Jitendra":"Pratik";}
  function myIndex(){return JITENDRA_EMAILS.includes((state.user?.email||"").trim().toLowerCase())?0:1;}
  function memberIndex(id){return sortedMembers().findIndex(m=>m.user_id===id);}
  function contribOf(costId,memberId){return state.contributions.filter(c=>c.cost_id===costId&&c.member_id===memberId).reduce((s,c)=>s+Number(c.amount),0);}
  function shareFor(carId,memberId){const a=state.allocations.find(x=>x.car_id===carId&&x.member_id===memberId);return a?Number(a.share_percent):null;}
  function renderReports(){
    const me=sortedMembers()[myIndex()];const name=partnerName(myIndex());const box=$("myReport");if(!box)return;
    if(!me){box.innerHTML=`<div class="content-card text-secondary">${esc(t("noPartners"))}</div>`;return;}
    let invested=0,earned=0,pending=0;
    const rows=state.cars.map(car=>{const costs=state.costs.filter(c=>c.car_id===car.id);const mine=costs.reduce((s,c)=>s+contribOf(c.id,me.user_id),0);invested+=mine;const profit=carProfit(car.id);const pct=shareFor(car.id,me.user_id);let share=null;if(profit!==null&&pct!==null){share=profit*pct/100;earned+=share;}else if(profit!==null)pending++;return {car,mine,profit,pct,share};}).filter(r=>r.mine>0||r.share!==null);
    const recv=n=>`<div class="col-sm-6 col-lg-3"><div class="metric-card">${n}</div></div>`;
    box.innerHTML=`<div class="d-flex align-items-center gap-2 mt-3 mb-2"><span class="avatar" style="display:grid">${esc(name[0])}</span><h3 class="h5 fw-bold mb-0">${esc(name)}'s report</h3></div>
    <div class="row g-3">${recv(`<div class="metric-label">Money invested</div><div class="metric-value">${money(invested)}</div><div class="metric-foot">Your share of all car costs</div>`)}${recv(`<div class="metric-label">Your profit share</div><div class="metric-value ${earned<0?"text-danger":""}">${money(earned)}</div><div class="metric-foot">From sold cars with a split set</div>`)}${recv(`<div class="metric-label">Cars involved</div><div class="metric-value">${rows.length}</div><div class="metric-foot">${rows.filter(r=>r.profit!==null).length} sold</div>`)}${recv(`<div class="metric-label">Split not set</div><div class="metric-value">${pending}</div><div class="metric-foot">Sold cars awaiting profit split</div>`)}</div>
    <div class="content-card mt-4"><h2 class="section-title">Car-wise breakdown</h2><div class="table-responsive mt-2"><table class="table align-middle mb-0"><thead><tr><th>Car</th><th>Status</th><th class="text-end">You invested</th><th class="text-end">Car profit</th><th class="text-end">Your share</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td><div class="vehicle-name">${esc(carName(r.car))}</div><div class="vehicle-meta">${esc(r.car.registration_number||"—")}</div></td><td>${statusBadge(r.car.status)}</td><td class="text-end">${money(r.mine)}</td><td class="text-end">${r.profit===null?"—":money(r.profit)}</td><td class="text-end fw-semibold">${r.share!==null?`${money(r.share)} <span class="text-secondary small">(${r.pct}%)</span>`:r.profit===null?"—":'<span class="text-secondary small">Not set</span>'}</td></tr>`).join(""):`<tr><td colspan="5"><div class="empty-state"><i class="bi bi-graph-up"></i>No records yet</div></td></tr>`}</tbody></table></div></div>`;
  }
  function openCarForm(id=null){
    if(!state.businessId)return toast(t("noBusiness"),"warning");
    $("carForm").reset();$("carId").value="";$("carModalTitle").textContent=t("addCar");
    const purchaseIds=["purchaseEntrySection","purchasePriceField","purchaseContribution1Field","purchaseContribution2Field"];
    purchaseIds.forEach(x=>$(x).classList.remove("d-none"));
    ["carPurchasePrice","carPurchaseContribution1","carPurchaseContribution2"].forEach(x=>$(x).required=true);
    $("carPurchaseContribution1Label").textContent="Jitendra contribution (₹) *";$("carPurchaseContribution2Label").textContent="Pratik contribution (₹) *";
    if(id){const c=state.cars.find(x=>x.id===id);if(!c)return;$("carId").value=id;$("carModalTitle").textContent=t("editCar");$("carBrand").value=c.brand||"";$("carModel").value=c.model||"";$("carYear").value=c.year||"";$("carReg").value=c.registration_number||"";$("carStatus").value=c.status||"available";$("carFuel").value=c.fuel_type||"";$("carTransmission").value=c.transmission||"";$("carOwnership").value=c.ownership||"";$("carColor").value=c.color||"";$("carOdometer").value=c.odometer_km??"";$("carPurchaseDate").value=c.purchase_date||"";$("carNotes").value=c.notes||"";purchaseIds.forEach(x=>$(x).classList.add("d-none"));["carPurchasePrice","carPurchaseContribution1","carPurchaseContribution2"].forEach(x=>$(x).required=false);}
    else{$("carPurchaseDate").value=new Date().toISOString().slice(0,10);$("carPurchaseContribution1").value="0";$("carPurchaseContribution2").value="0";}
    showModal("carModal");
  }
  async function saveCar(e){
    e.preventDefault();const btn=e.submitter;const id=$("carId").value;
    const purchasePrice=Math.round(Number($("carPurchasePrice").value||0)*100)/100,contribution1=Math.round(Number($("carPurchaseContribution1").value||0)*100)/100,contribution2=Math.round(Number($("carPurchaseContribution2").value||0)*100)/100;
    if(!id){if(purchasePrice<=0){toast("Enter the purchase price.","warning");return;}if(contribution1<0||contribution2<0||Math.round((contribution1+contribution2)*100)!==Math.round(purchasePrice*100)){toast("Jitendra and Pratik contributions must add up exactly to the purchase price.","warning");return;}if(state.members.length!==2){toast("Exactly two business members are required.","warning");return;}}
    const payload={business_id:state.businessId,brand:$("carBrand").value.trim(),model:$("carModel").value.trim(),year:$("carYear").value?Number($("carYear").value):null,registration_number:$("carReg").value.trim()||null,status:$("carStatus").value,fuel_type:$("carFuel").value||null,transmission:$("carTransmission").value||null,ownership:$("carOwnership").value||null,color:$("carColor").value.trim()||null,odometer_km:$("carOdometer").value?Number($("carOdometer").value):null,purchase_date:$("carPurchaseDate").value||null,notes:$("carNotes").value.trim()||null,updated_at:new Date().toISOString()};if(!id)payload.created_by=state.user.id;setBusy(btn,true);
    const res=id?await supabase.from("cars").update(payload).eq("id",id).eq("business_id",state.businessId):await supabase.from("cars").insert(payload).select("id").single();
    if(res.error){setBusy(btn,false);console.error(res.error);toast(res.error.message||t("saveError"),"danger");return;}
    if(!id){const carId=res.data.id;const cost=await supabase.from("car_costs").insert({business_id:state.businessId,car_id:carId,category:"purchase",description:"Vehicle purchase price",amount:purchasePrice,cost_date:$("carPurchaseDate").value||new Date().toISOString().slice(0,10),created_by:state.user.id}).select("id").single();
      if(cost.error){await supabase.from("cars").delete().eq("id",carId).eq("business_id",state.businessId);setBusy(btn,false);toast("Car purchase record could not be saved: "+cost.error.message,"danger");return;}
      const members=state.members.slice().sort((a,b)=>new Date(a.joined_at||0)-new Date(b.joined_at||0)||String(a.user_id).localeCompare(String(b.user_id)));const rows=[];if(contribution1>0)rows.push({cost_id:cost.data.id,business_id:state.businessId,member_id:members[0].user_id,amount:contribution1});if(contribution2>0)rows.push({cost_id:cost.data.id,business_id:state.businessId,member_id:members[1].user_id,amount:contribution2});
      if(rows.length){const contrib=await supabase.from("cost_contributions").insert(rows);if(contrib.error){await supabase.from("car_costs").delete().eq("id",cost.data.id).eq("business_id",state.businessId);await supabase.from("cars").delete().eq("id",carId).eq("business_id",state.businessId);setBusy(btn,false);toast("Purchase contributions could not be saved: "+contrib.error.message,"danger");return;}}
    }
    setBusy(btn,false);hideModal("carModal");toast(id?t("carSaved"):"Car and purchase contributions saved.");await loadData();
  }
  function openCostForm(){
    if(!state.businessId)return toast(t("noBusiness"),"warning");
    if(!state.cars.length)return toast(t("addFirstCar"),"warning");
    if(state.members.length!==2)return toast("Exactly two business members are required for split contributions.","warning");
    $("costForm").reset();
    $("costCar").innerHTML=state.cars.filter(c=>c.status!=="archived").map(c=>`<option value="${c.id}">${esc(carName(c))} — ${esc(c.registration_number||"")}</option>`).join("");
    const members=state.members.slice().sort((a,b)=>new Date(a.joined_at||0)-new Date(b.joined_at||0)||String(a.user_id).localeCompare(String(b.user_id)));
    $("costPayer1Label").textContent="Jitendra contribution (₹)";
    $("costPayer2Label").textContent="Pratik contribution (₹)";
    $("costDate").value=new Date().toISOString().slice(0,10);
    showModal("costModal");
  }
  async function saveCost(e){
    e.preventDefault();
    const btn=e.submitter;
    const carId=$("costCar").value;
    const amount=Math.round(Number($("costAmount").value)*100)/100;
    const a=Math.round(Number($("costContribution1").value||0)*100)/100;
    const b=Math.round(Number($("costContribution2").value||0)*100)/100;
    if(Math.round((a+b)*100)!==Math.round(amount*100)){
      toast("Partner contributions must add up exactly to the total cost.","warning");return;
    }
    if(a<0||b<0||a+b<=0){toast("Enter valid partner contribution amounts.","warning");return;}
    const payload={business_id:state.businessId,car_id:carId,category:$("costCategory").value,description:$("costDescription").value.trim(),amount,cost_date:$("costDate").value,created_by:state.user.id};
    setBusy(btn,true);
    const res=await supabase.from("car_costs").insert(payload).select("id").single();
    if(res.error){setBusy(btn,false);toast(res.error.message||t("saveError"),"danger");return;}
    const members=state.members.slice().sort((a,b)=>new Date(a.joined_at||0)-new Date(b.joined_at||0)||String(a.user_id).localeCompare(String(b.user_id)));
    const rows=[];
    if(a>0)rows.push({cost_id:res.data.id,business_id:state.businessId,member_id:members[0].user_id,amount:a});
    if(b>0)rows.push({cost_id:res.data.id,business_id:state.businessId,member_id:members[1].user_id,amount:b});
    const contribution=await supabase.from("cost_contributions").insert(rows);
    setBusy(btn,false);
    if(contribution.error){
      console.error(contribution.error);
      await supabase.from("car_costs").delete().eq("id",res.data.id).eq("business_id",state.businessId);
      toast(contribution.error.message||t("saveError"),"danger");return;
    }
    hideModal("costModal");toast(t("costSaved"));await loadData();
  }
  async function deleteCost(id){if(!confirm(t("deleteCost")))return;const {error}=await supabase.from("car_costs").delete().eq("id",id).eq("business_id",state.businessId);if(error){toast(error.message,"danger");return;}toast(t("deleted"));await loadData();}
  async function deleteCar(id){if(!state.cars.some(c=>c.id===id))return;$("deleteCarId").value=id;$("deleteCarPassword").value="";showModal("deleteCarModal");}
  async function confirmDeleteCar(e){e.preventDefault();const btn=e.submitter,password=$("deleteCarPassword").value,id=$("deleteCarId").value;if(!state.user?.email||!password)return;setBusy(btn,true);const verify=await supabase.auth.signInWithPassword({email:state.user.email,password});if(verify.error){setBusy(btn,false);toast("Password verification failed. Car was not deleted.","danger");return;}const {error}=await supabase.rpc("delete_car_with_records",{p_car_id:id});setBusy(btn,false);if(error){console.error(error);toast("Password verified, but deletion failed: "+error.message,"danger");return;}hideModal("deleteCarModal");toast("Car and its related records deleted.");await loadData();}
  function detailExtras(id){
    const ms=sortedMembers();const costs=state.costs.filter(c=>c.car_id===id).slice().sort((a,b)=>String(a.cost_date).localeCompare(String(b.cost_date)));const profit=carProfit(id);
    const tot=ms.map(m=>costs.reduce((s,c)=>s+contribOf(c.id,m.user_id),0));
    const tx=`<div class="content-card mb-3"><h3 class="section-title">Transactions (${costs.length})</h3>${costs.length?`<div class="table-responsive mt-2"><table class="table table-sm align-middle mb-0"><thead><tr><th>${esc(t("date"))}</th><th>Details</th><th class="text-end">Amount</th>${ms.map((m,i)=>`<th class="text-end">${partnerName(i)}</th>`).join("")}</tr></thead><tbody>${costs.map(c=>`<tr><td class="text-nowrap">${dateLabel(c.cost_date)}</td><td><div class="fw-semibold">${esc(t(c.category)||c.category)}</div><div class="vehicle-meta">${esc(c.description)}</div></td><td class="text-end fw-semibold">${money(c.amount)}</td>${ms.map(m=>`<td class="text-end">${money(contribOf(c.id,m.user_id))}</td>`).join("")}</tr>`).join("")}</tbody><tfoot><tr class="fw-bold"><td colspan="2">Total</td><td class="text-end">${money(totalCost(id))}</td>${tot.map(v=>`<td class="text-end">${money(v)}</td>`).join("")}</tr></tfoot></table></div>`:`<p class="text-secondary mb-0 mt-2">No transactions yet.</p>`}</div>`;
    const pr=`<div class="content-card mb-3"><h3 class="section-title">Profit</h3>${profit===null?`<p class="text-secondary mb-0 mt-2">${esc(t("notSold"))}</p>`:`<div class="d-flex justify-content-between mt-2"><span>${esc(t("netProfit"))}</span><strong class="${profit<0?"text-danger":"text-success"}">${money(profit)}</strong></div>${ms.map((m,i)=>{const p=shareFor(id,m.user_id);return `<div class="d-flex justify-content-between mt-2"><span>${partnerName(i)}${i===myIndex()?' <span class="badge text-bg-warning ms-1">You</span>':""}</span><strong>${p===null?'<span class="text-secondary small fw-normal">Split not set</span>':`${money(profit*p/100)} <span class="text-secondary small fw-normal">(${p}%)</span>`}</strong></div>`}).join("")}`}</div>`;
    return tx+pr;
  }
  function openDetails(id){const c=state.cars.find(x=>x.id===id);if(!c)return;state.activeCarId=id;const sale=saleFor(id),cost=totalCost(id),profit=carProfit(id);$("detailTitle").textContent=carName(c);$("detailSubtitle").textContent=c.registration_number||"—";$("detailBody").innerHTML=`<div class="row g-3 mb-3"><div class="col-6"><div class="metric-card"><div class="metric-label">${esc(t("totalCost"))}</div><div class="metric-value">${money(cost)}</div></div></div><div class="col-6"><div class="metric-card"><div class="metric-label">${esc(t("netProfit"))}</div><div class="metric-value">${profit===null?"—":money(profit)}</div><div class="metric-foot">${profit===null?esc(t("notSold")):profit<0?esc(t("loss")):esc(t("realizedProfit"))}</div></div></div></div><div class="content-card mb-3"><h3 class="section-title">${esc(t("carDetails"))}</h3><div class="row g-2 mt-1"><div class="col-6"><span class="text-secondary">${esc(t("year"))}</span><div class="fw-semibold">${esc(c.year||"—")}</div></div><div class="col-6"><span class="text-secondary">${esc(t("status"))}</span><div>${statusBadge(c.status)}</div></div><div class="col-6"><span class="text-secondary">${esc(t("fuel"))}</span><div class="fw-semibold">${esc(c.fuel_type||"—")}</div></div><div class="col-6"><span class="text-secondary">${esc(t("transmission"))}</span><div class="fw-semibold">${esc(c.transmission||"—")}</div></div><div class="col-6"><span class="text-secondary">${esc(t("ownership"))}</span><div class="fw-semibold">${esc(c.ownership||"—")}</div></div><div class="col-6"><span class="text-secondary">${esc(t("purchaseDate"))}</span><div class="fw-semibold">${dateLabel(c.purchase_date)}</div></div></div></div>${detailExtras(id)}<div class="content-card"><h3 class="section-title">${esc(t("sale"))}</h3>${sale?`<div class="d-flex justify-content-between mt-2"><span>${esc(t("sellingPrice"))}</span><strong>${money(sale.sale_price)}</strong></div><div class="d-flex justify-content-between mt-2"><span>${esc(t("date"))}</span><strong>${dateLabel(sale.sale_date)}</strong></div>`:`<p class="text-secondary mb-0 mt-2">${esc(t("noSale"))}</p>`}</div>`;
    $("recordSale").classList.toggle("d-none",!!sale);showModal("detailModal");}
  function openSaleForm(id){const c=state.cars.find(x=>x.id===id);if(!c)return;if(saleFor(id))return toast("A sale is already recorded for this car.","warning");$("saleForm").reset();$("saleCarId").value=id;$("saleDate").value=new Date().toISOString().slice(0,10);showModal("saleModal");}
  async function saveSale(e){e.preventDefault();const btn=e.submitter;const carId=$("saleCarId").value;const salePrice=Number($("salePrice").value);const payload={business_id:state.businessId,car_id:carId,sale_price:salePrice,sale_date:$("saleDate").value,buyer_name:$("saleBuyer").value.trim()||null,created_by:state.user.id};setBusy(btn,true);const {error}=await supabase.from("car_sales").insert(payload);if(error){setBusy(btn,false);toast(error.message,"danger");return;}const upd=await supabase.from("cars").update({status:"sold",updated_at:new Date().toISOString()}).eq("id",carId).eq("business_id",state.businessId);setBusy(btn,false);if(upd.error){toast("Sale saved but car status could not be updated.","warning");}else toast(t("saleSaved"));hideModal("saleModal");await loadData();openProfitForm(carId);}
  function openProfitForm(carId){const sale=saleFor(carId);if(!sale){toast(t("recordCostsFirst"),"warning");return;}state.activeCarId=carId;$("profitCarId").value=carId;const net=carProfit(carId);$("splitMethod").value="percentage";const members=state.members.filter(m=>m.role==="partner"||m.role==="admin");$("profitLabel1").textContent="Jitendra";$("profitLabel2").textContent="Pratik";const old=state.allocations.filter(a=>a.car_id===carId);$("profitValue1").value=old[0]?.share_percent??50;$("profitValue2").value=old[1]?.share_percent??50;updateProfitLabels();$("profitPreview").textContent=`${t("netProfit")}: ${money(net)}`;showModal("profitModal");}
  function updateProfitLabels(){const method=$("splitMethod").value;$("profitLabel1").textContent="Jitendra";$("profitLabel2").textContent="Pratik";if(method==="percentage"){$("profitLabel1").textContent+=" (%)";$("profitLabel2").textContent+=" (%)";}else{$("profitLabel1").textContent+=" (₹)";$("profitLabel2").textContent+=" (₹)";}updateProfitPreview();}
  function updateProfitPreview(){const method=$("splitMethod").value;const a=Number($("profitValue1").value||0),b=Number($("profitValue2").value||0);const net=carProfit($("profitCarId").value)||0;let message=`${t("netProfit")}: ${money(net)} · `;message+=method==="percentage"?`${t("share")}: ${a+b}%`:`${t("share")}: ${money(a+b)} / ${money(net)}`;$("profitPreview").textContent=message;}
  async function saveProfitAgreement(e){e.preventDefault();const btn=e.submitter;const carId=$("profitCarId").value;const method=$("splitMethod").value;const a=Number($("profitValue1").value),b=Number($("profitValue2").value);const net=carProfit(carId);if(net===null){toast(t("recordCostsFirst"),"warning");return;}if(method==="percentage"&&Math.round((a+b)*100)!==10000){toast(t("percentMustTotal"),"warning");return;}if(method==="amount"&&Math.round((a+b)*100)!==Math.round(net*100)){toast(t("fixedAmountsMustMatch"),"warning");return;}if(method==="amount"&&net<0){toast("For a loss, agree and record a separate loss-allocation rule. Fixed profit amounts cannot be negative.","warning");return;}const members=state.members.slice(0,2);if(members.length!==2){toast("Two business members are required to set a sharing agreement.","warning");return;}setBusy(btn,true);const del=await supabase.from("profit_allocations").delete().eq("business_id",state.businessId).eq("car_id",carId);if(del.error){setBusy(btn,false);toast(del.error.message,"danger");return;}const rows=members.map((m,i)=>({business_id:state.businessId,car_id:carId,member_id:m.user_id,share_percent:method==="percentage"?(i===0?a:b):(net===0?0:(i===0?a/net*100:b/net*100))}));const {error}=await supabase.from("profit_allocations").insert(rows);setBusy(btn,false);if(error){toast(error.message,"danger");return;}hideModal("profitModal");toast(t("agreementSaved"));await loadData();}
  function exportCars(){const header=["Brand","Model","Registration","Year","Fuel","Transmission","Ownership","Status","Purchase date","Total cost","Sale price","Profit/Loss"];const rows=state.cars.map(c=>{const sale=saleFor(c.id);return [c.brand,c.model,c.registration_number||"",c.year||"",c.fuel_type||"",c.transmission||"",c.ownership||"",c.status,c.purchase_date||"",totalCost(c.id),sale?.sale_price??"",sale?carProfit(c.id):""];});const csv=[header,...rows].map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="autoledger-cars.csv";a.click();URL.revokeObjectURL(url);}
})();