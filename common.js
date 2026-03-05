// ✅ Change if your API base is different
const API_BASE = "http://localhost:8080/oceanview/api";
const $ = (id) => document.getElementById(id);

const auth = {
  get token(){ return sessionStorage.getItem("token") || ""; },
  get role(){ return sessionStorage.getItem("role") || ""; },
  set(token, role){
    sessionStorage.setItem("token", token || "");
    sessionStorage.setItem("role", role || "");
  },
  clear(){
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("role");
  }
};

function showToast(type, msg){
  const t = $("toast");
  if(!t) return;
  t.className = `toast ${type||""}`.trim();
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> t.hidden = true, 3500);
}

async function apiFetch(path, options = {}){
  const headers = Object.assign({ "Content-Type":"application/json" }, options.headers || {});
  if(auth.token && !headers.Authorization){
    headers.Authorization = `Bearer ${auth.token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const ct = res.headers.get("content-type") || "";

  let data = null;
  if(ct.includes("application/json")){
    data = await res.json().catch(()=> null);
  }else{
    const text = await res.text().catch(()=> "");
    data = { message: text || `Request failed (${res.status})`, raw: text };
  }

  if(!res.ok){
    const msg = (data && data.message) ? data.message : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function protectPage(allowed){
  if(!auth.token){
    window.location.href = "./login.html";
    return;
  }
  if(allowed && allowed.length){
    const r = (auth.role || "").toUpperCase();
    if(!allowed.includes(r)){
      window.location.href = "./login.html";
    }
  }
}

function bindTabs(tabIds){
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".tab").forEach(b=> b.classList.remove("isActive"));
      btn.classList.add("isActive");
      const show = btn.dataset.tab;
      tabIds.forEach(id => $(id).hidden = (id !== show));
    });
  });
}

function fmtDate(iso){
  if(!iso) return "-";
  return iso;
}

function calcStatus(checkIn, checkOut){
  // completed: checkOut < today
  // active: checkIn <= today < checkOut
  // upcoming: checkIn > today
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const ci = new Date(checkIn);
  const co = new Date(checkOut);

  if(co < t) return { key:"completed", label:"Completed", badge:"ok" };
  if(ci > t) return { key:"upcoming", label:"Upcoming", badge:"warn" };
  return { key:"active", label:"Active", badge:"bad" };
}

function escapeHtml(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function setSessionInfo(){
  const el = $("sessionInfo");
  if(!el) return;
  el.textContent = auth.token ? `Role: ${auth.role}` : "Not logged in";
}

async function loadRoomTypes(selectEl){
  const list = await apiFetch("/room-types", { method:"GET", headers:{ Authorization:"" } });
  selectEl.innerHTML = `<option value="">-- select --</option>`;
  (list || []).forEach(rt=>{
    const opt = document.createElement("option");
    opt.value = rt.typeName;
    opt.textContent = `${rt.typeName} (LKR ${rt.ratePerNight})`;
    selectEl.appendChild(opt);
  });
}

function money(v){
  if(v === null || v === undefined) return "-";
  return `LKR ${v}`;
}