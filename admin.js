protectPage(["ADMIN"]);
setSessionInfo();

// ✅ logout back to /oceanview-ui/
$("btnLogout").addEventListener("click", ()=>{ auth.clear(); window.location.href="./"; });

// ✅ include tabUsers
bindTabs(["tabDash","tabAdd","tabManage","tabGuests","tabRooms","tabUsers","tabHelp"]);

$("btnGoManage").addEventListener("click", ()=> document.querySelector('[data-tab="tabManage"]').click());

let roomTypesCache = [];
let manageCache = [];

// =====================
// ROOM TYPES (for selects)
// =====================
async function initRoomTypes(){
  const list = await apiFetch("/room-types", { method:"GET", headers:{ Authorization:"" } });
  roomTypesCache = list || [];

  // Add page select
  await loadRoomTypes($("roomType"));

  // Manage filters select
  const selFilter = $("filterRoomType");
  selFilter.innerHTML = `<option value="">All Room Types</option>`;
  roomTypesCache.forEach(rt=>{
    const opt = document.createElement("option");
    opt.value = rt.typeName;
    opt.textContent = rt.typeName;
    selFilter.appendChild(opt);
  });

  // Modal select (keep same + options)
  const mSel = $("mRoomType");
  mSel.innerHTML = `<option value="">-- keep same --</option>`;
  roomTypesCache.forEach(rt=>{
    const opt = document.createElement("option");
    opt.value = rt.typeName;
    opt.textContent = rt.typeName;
    mSel.appendChild(opt);
  });
}

// =====================
// ADD RESERVATION (admin)
// =====================
async function getNextNo(){
  const data = await apiFetch("/reservations/next-no", { method:"GET" });
  $("resNo").value = data.reservationNo || "";
}

$("btnNewNo").addEventListener("click", async ()=>{
  try{ await getNextNo(); showToast("ok","New reservation no created"); }
  catch(err){ showToast("bad", err.message); }
});

$("btnClearAdd").addEventListener("click", ()=>{
  ["guestName","contactNo","address"].forEach(id=> $(id).value="");
  $("roomType").value = "";
  $("checkIn").value = "";
  $("checkOut").value = "";
  $("addMsg").textContent = "Form cleared.";
});

$("formAdd").addEventListener("submit", async (e)=>{
  e.preventDefault();
  try{
    const payload = {
      reservationNo: $("resNo").value.trim(), // can be empty -> backend auto
      guestName: $("guestName").value.trim(),
      address: $("address").value.trim(),
      contactNumber: $("contactNo").value.trim(),
      roomType: $("roomType").value,
      checkIn: $("checkIn").value,
      checkOut: $("checkOut").value,
    };

    const data = await apiFetch("/reservations", { method:"POST", body: JSON.stringify(payload) });
    $("addMsg").textContent = data.message || "Reservation created.";
    await getNextNo();
    showToast("ok", data.message || "Reservation saved");

    // refresh dashboard + manage list
    refreshDashboard().catch(()=>{});
    loadManage().catch(()=>{});
  }catch(err){
    showToast("bad", err.message);
  }
});

// =====================
// DASHBOARD (simple analysis)
// =====================
function renderDashboard(resList){
  const total = resList.length;
  let a=0,u=0,c=0;

  const byType = new Map();

  resList.forEach(r=>{
    const st = calcStatus(r.checkIn, r.checkOut).key;
    if(st==="active") a++;
    else if(st==="upcoming") u++;
    else if(st==="completed") c++;

    const t = r.roomType || "Unknown";
    byType.set(t, (byType.get(t)||0) + 1);
  });

  $("kTotal").textContent = total;
  $("kActive").textContent = a;
  $("kUpcoming").textContent = u;
  $("kCompleted").textContent = c;

  const rows = [...byType.entries()]
    .sort((x,y)=> y[1]-x[1])
    .map(([k,v])=> `<span class="badge btnGhost" style="margin:6px 6px 0 0;">${escapeHtml(k)}: <b>${v}</b></span>`)
    .join("");

  $("byRoomType").innerHTML = rows || `<span class="muted">No data</span>`;
}

async function refreshDashboard(){
  const list = await apiFetch("/reservations", { method:"GET" }); // all
  renderDashboard(list || []);
}

$("btnDashRefresh").addEventListener("click", async ()=>{
  try{ await refreshDashboard(); showToast("ok","Dashboard refreshed"); }
  catch(err){ showToast("bad", err.message); }
});

// =====================
// MANAGE RESERVATIONS (update/delete table)
// =====================
function renderManageRows(list){
  const tbody = $("manageTbody");
  tbody.innerHTML = "";

  if(!list.length){
    tbody.innerHTML = `<tr><td colspan="8" class="muted">No reservations found.</td></tr>`;
    return;
  }

  list.forEach(r=>{
    const st = calcStatus(r.checkIn, r.checkOut);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge ${st.badge}">${st.label}</span></td>
      <td><b>${escapeHtml(r.reservationNo)}</b></td>
      <td>${escapeHtml(r.guestName || "-")}</td>
      <td>${escapeHtml(r.contactNumber || "-")}</td>
      <td>${escapeHtml(r.roomType || "-")}</td>
      <td>${escapeHtml(r.checkIn)}</td>
      <td>${escapeHtml(r.checkOut)}</td>
      <td>
        <button class="btn btnGhost" data-act="edit" data-no="${escapeHtml(r.reservationNo)}">Edit</button>
        <button class="btn btnDanger" data-act="del" data-no="${escapeHtml(r.reservationNo)}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-act='edit']").forEach(btn=>{
    btn.addEventListener("click", ()=> openEditModal(btn.getAttribute("data-no")));
  });

  tbody.querySelectorAll("button[data-act='del']").forEach(btn=>{
    btn.addEventListener("click", ()=> deleteReservation(btn.getAttribute("data-no")));
  });
}

async function loadManage(){
  const status = $("filterStatus").value;
  const roomType = $("filterRoomType").value;

  const q = new URLSearchParams();
  if(roomType) q.set("roomType", roomType);
  if(status && status !== "all") q.set("status", status);

  const list = await apiFetch(`/reservations?${q.toString()}`, { method:"GET" });
  manageCache = list || [];
  applyManageSearch();
}

function applyManageSearch(){
  const s = $("filterSearch").value.trim().toLowerCase();
  let list = manageCache;

  if(s){
    list = list.filter(r =>
      (r.reservationNo||"").toLowerCase().includes(s) ||
      (r.guestName||"").toLowerCase().includes(s) ||
      (r.contactNumber||"").toLowerCase().includes(s)
    );
  }
  renderManageRows(list);
}

$("btnManageRefresh").addEventListener("click", async ()=>{
  try{ await loadManage(); showToast("ok","Manage list refreshed"); }
  catch(err){ showToast("bad", err.message); }
});

$("filterStatus").addEventListener("change", ()=> loadManage().catch(e=>showToast("bad", e.message)));
$("filterRoomType").addEventListener("change", ()=> loadManage().catch(e=>showToast("bad", e.message)));
$("filterSearch").addEventListener("input", applyManageSearch);

// =====================
// MODAL (Edit/Delete reservation)
// =====================

// ✅ FIX: CSS uses .isOpen, previous JS used .show.
// Now we support BOTH to avoid any mismatch.
function showModal(show){
  const el = $("modalBackdrop");
  el.classList.toggle("isOpen", !!show);
  el.classList.toggle("show", !!show); // fallback support
}

$("btnModalClose").addEventListener("click", ()=> showModal(false));
$("modalBackdrop").addEventListener("click", (e)=>{
  if(e.target === $("modalBackdrop")) showModal(false);
});

async function openEditModal(resNo){
  try{
    const r = await apiFetch(`/reservations/${encodeURIComponent(resNo)}`, { method:"GET" });

    $("mResNo").value = r.reservationNo || resNo;

    // ✅ date inputs need YYYY-MM-DD
    $("mCheckIn").value  = (r.checkIn  || "").slice(0,10);
    $("mCheckOut").value = (r.checkOut || "").slice(0,10);

    $("mGuestName").value = r.guestName || "";
    $("mContact").value = r.contactNumber || "";
    $("mAddress").value = r.address || "";
    $("mGuestId").value = "";    // optional
    $("mRoomType").value = "";   // keep same default

    showModal(true);
  }catch(err){
    showToast("bad", err.message);
  }
}

async function deleteReservation(resNo){
  if(!confirm(`Delete reservation ${resNo}?`)) return;
  try{
    await apiFetch(`/reservations/${encodeURIComponent(resNo)}`, { method:"DELETE" });
    showToast("ok","Reservation deleted");
    showModal(false);
    await loadManage();
    await refreshDashboard();
  }catch(err){
    showToast("bad", err.message);
  }
}

$("btnModalDelete").addEventListener("click", async ()=>{
  const resNo = $("mResNo").value.trim();
  await deleteReservation(resNo);
});

$("btnModalSave").addEventListener("click", async ()=>{
  try{
    const resNo = $("mResNo").value.trim();
    const guestIdRaw = $("mGuestId").value.trim();

    const payload = {
      roomType: $("mRoomType").value || undefined,
      guestId: guestIdRaw ? Number(guestIdRaw) : undefined,
      checkIn: $("mCheckIn").value || undefined,
      checkOut: $("mCheckOut").value || undefined,
      guestName: $("mGuestName").value.trim() || undefined,
      contactNumber: $("mContact").value.trim() || undefined,
      address: $("mAddress").value.trim() || undefined,
    };

    const updated = await apiFetch(`/reservations/${encodeURIComponent(resNo)}`, {
      method:"PUT",
      body: JSON.stringify(payload)
    });

    showToast("ok", updated.message || "Reservation updated");
    showModal(false);
    await loadManage();
    await refreshDashboard();
  }catch(err){
    showToast("bad", err.message);
  }
});

// =====================
// GUESTS (search by contact number)
// =====================
$("btnLoadGuest").addEventListener("click", async ()=>{
  try{
    const contact = ($("guestContactSearch").value || "").trim();
    if(!contact) return showToast("warn","Enter contact number");

    const g = await apiFetch(`/guests/by-contact/${encodeURIComponent(contact)}`, { method:"GET" });

    $("guestId").value = g.guestId; // store id internally
    $("gName").value = g.guestName || "";
    $("gContact").value = g.contactNumber || "";
    $("gAddress").value = g.address || "";
    $("guestMsg").textContent = `Loaded guest: ${g.guestName} (ID ${g.guestId})`;

    showToast("ok","Guest loaded");
  }catch(err){
    showToast("bad", err.message);
  }
});

$("btnUpdateGuest").addEventListener("click", async ()=>{
  try{
    const id = ($("guestId").value || "").trim();
    if(!id) return showToast("warn","Load a guest first");

    const payload = {
      guestName: $("gName").value.trim(),
      contactNumber: $("gContact").value.trim(),
      address: $("gAddress").value.trim(),
    };

    const g = await apiFetch(`/guests/${encodeURIComponent(id)}`, {
      method:"PUT",
      body: JSON.stringify(payload)
    });

    $("guestMsg").textContent = `Updated guest: ${g.guestName} (ID ${g.guestId})`;
    showToast("ok","Guest updated");
  }catch(err){
    showToast("bad", err.message);
  }
});

$("btnDeleteGuest").addEventListener("click", async ()=>{
  try{
    const id = ($("guestId").value || "").trim();
    if(!id) return showToast("warn","Load a guest first");
    if(!confirm("Delete guest? (Works only if guest has NO reservations)")) return;

    await apiFetch(`/guests/${encodeURIComponent(id)}`, { method:"DELETE" });

    $("guestId").value = "";
    $("guestContactSearch").value = "";
    $("gName").value = "";
    $("gContact").value = "";
    $("gAddress").value = "";
    $("guestMsg").textContent = "Guest deleted.";

    showToast("ok","Guest deleted");
  }catch(err){
    showToast("bad", err.message);
  }
});

$("btnForceDeleteGuest").addEventListener("click", async ()=>{
  try{
    const id = ($("guestId").value || "").trim();
    if(!id) return showToast("warn","Load a guest first");
    if(!confirm("Force delete guest + their reservations?")) return;

    await apiFetch(`/guests/${encodeURIComponent(id)}?force=true`, { method:"DELETE" });

    $("guestId").value = "";
    $("guestContactSearch").value = "";
    $("gName").value = "";
    $("gContact").value = "";
    $("gAddress").value = "";
    $("guestMsg").textContent = "Guest force deleted.";

    showToast("ok","Guest force deleted");
  }catch(err){
    showToast("bad", err.message);
  }
});

// =====================
// ROOM TYPES CRUD
// =====================
async function loadRoomTypesTable(){
  const list = await apiFetch("/room-types", { method:"GET", headers:{ Authorization:"" } });
  roomTypesCache = list || [];
  const tb = $("roomsTbody");
  tb.innerHTML = "";

  if(!roomTypesCache.length){
    tb.innerHTML = `<tr><td colspan="3" class="muted">No room types found.</td></tr>`;
    return;
  }

  roomTypesCache.forEach(rt=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${escapeHtml(rt.typeName)}</b></td>
      <td>${escapeHtml(rt.ratePerNight)}</td>
      <td><button class="btn btnDanger" data-del="${escapeHtml(rt.typeName)}">Delete</button></td>
    `;
    tr.addEventListener("click", ()=>{
      $("rtName").value = rt.typeName;
      $("rtRate").value = rt.ratePerNight;
    });
    tb.appendChild(tr);
  });

  tb.querySelectorAll("button[data-del]").forEach(btn=>{
    btn.addEventListener("click", async (e)=>{
      e.stopPropagation();
      const name = btn.getAttribute("data-del");
      if(!confirm(`Delete room type ${name}?`)) return;
      try{
        await apiFetch(`/room-types/${encodeURIComponent(name)}`, { method:"DELETE" });
        showToast("ok","Room type deleted");
        await loadRoomTypesTable();
        await initRoomTypes();
      }catch(err){
        showToast("bad", err.message);
      }
    });
  });
}

$("btnRoomsRefresh").addEventListener("click", async ()=>{
  try{ await loadRoomTypesTable(); showToast("ok","Room types refreshed"); }
  catch(err){ showToast("bad", err.message); }
});

$("btnRoomSave").addEventListener("click", async ()=>{
  try{
    const typeName = $("rtName").value.trim();
    const ratePerNight = Number($("rtRate").value);
    if(!typeName) return showToast("warn","Type name required");
    if(!ratePerNight && ratePerNight !== 0) return showToast("warn","Rate required");

    await apiFetch("/room-types", {
      method:"POST",
      body: JSON.stringify({ typeName, ratePerNight })
    });

    showToast("ok","Room type saved");
    await loadRoomTypesTable();
    await initRoomTypes();
  }catch(err){
    showToast("bad", err.message);
  }
});

$("btnRoomClear").addEventListener("click", ()=>{
  $("rtName").value = "";
  $("rtRate").value = "";
});

// =====================
// USERS CRUD (Admin)
// =====================
let usersCache = [];
let selectedUsername = "";
const usersTbody = $("usersTbody");

function clearUserForm(){
  selectedUsername = "";
  $("uUsername").value = "";
  $("uPassword").value = "";
  $("uRole").value = "RECEPTIONIST";
  $("usersMsg").textContent = "No user selected.";
}

function renderUsersTable(list){
  usersTbody.innerHTML = "";

  if(!list.length){
    usersTbody.innerHTML = `<tr><td colspan="3" class="muted">No users found.</td></tr>`;
    return;
  }

  list.forEach(u=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${escapeHtml(u.username)}</b></td>
      <td><span class="badge btnGhost">${escapeHtml((u.role||"").toUpperCase())}</span></td>
      <td>
        <button class="btn btnGhost" data-act="select" data-u="${escapeHtml(u.username)}">Select</button>
        <button class="btn btnDanger" data-act="delete" data-u="${escapeHtml(u.username)}">Delete</button>
      </td>
    `;
    usersTbody.appendChild(tr);
  });

  usersTbody.querySelectorAll("button[data-act='select']").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const uname = btn.getAttribute("data-u");
      const u = usersCache.find(x => x.username === uname);
      if(!u) return;

      selectedUsername = uname;
      $("uUsername").value = u.username;
      $("uRole").value = (u.role || "RECEPTIONIST").toUpperCase();
      $("uPassword").value = "";
      $("usersMsg").textContent = `Selected: ${u.username} (${(u.role||"").toUpperCase()})`;
    });
  });

  usersTbody.querySelectorAll("button[data-act='delete']").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const uname = btn.getAttribute("data-u");
      await deleteUser(uname);
    });
  });
}

function applyUserSearch(){
  const s = $("userSearch").value.trim().toLowerCase();
  let list = usersCache;
  if(s){
    list = list.filter(u => (u.username || "").toLowerCase().includes(s));
  }
  renderUsersTable(list);
}

async function loadUsers(){
  const list = await apiFetch("/users", { method:"GET" });
  usersCache = list || [];
  applyUserSearch();
}

async function createUser(){
  const username = $("uUsername").value.trim();
  const password = $("uPassword").value;
  const role = $("uRole").value;

  if(!username) return showToast("warn","Username required");
  if(!password) return showToast("warn","Password required for create");

  await apiFetch("/users", {
    method:"POST",
    body: JSON.stringify({ username, password, role })
  });

  showToast("ok","User created");
  clearUserForm();
  await loadUsers();
}

async function updateUserRole(){
  const username = (selectedUsername || $("uUsername").value.trim());
  const role = $("uRole").value;
  if(!username) return showToast("warn","Select a user first");

  await apiFetch(`/users/${encodeURIComponent(username)}`, {
    method:"PUT",
    body: JSON.stringify({ role })
  });

  showToast("ok","Role updated");
  await loadUsers();
}

async function resetUserPassword(){
  const username = (selectedUsername || $("uUsername").value.trim());
  const password = $("uPassword").value;

  if(!username) return showToast("warn","Select a user first");
  if(!password) return showToast("warn","Enter new password");

  await apiFetch(`/users/${encodeURIComponent(username)}`, {
    method:"PUT",
    body: JSON.stringify({ password })
  });

  $("uPassword").value = "";
  showToast("ok","Password reset done");
}

async function deleteUser(username){
  const uname = username || selectedUsername || $("uUsername").value.trim();
  if(!uname) return showToast("warn","Select a user first");
  if(!confirm(`Delete user "${uname}"?`)) return;

  await apiFetch(`/users/${encodeURIComponent(uname)}`, { method:"DELETE" });

  showToast("ok","User deleted");
  clearUserForm();
  await loadUsers();
}

// bind user events
$("btnUsersRefresh").addEventListener("click", async ()=>{
  try{ await loadUsers(); showToast("ok","Users refreshed"); }
  catch(err){ showToast("bad", err.message); }
});
$("userSearch").addEventListener("input", applyUserSearch);

$("btnUserCreate").addEventListener("click", async ()=>{
  try{ await createUser(); } catch(err){ showToast("bad", err.message); }
});
$("btnUserUpdateRole").addEventListener("click", async ()=>{
  try{ await updateUserRole(); } catch(err){ showToast("bad", err.message); }
});
$("btnUserResetPw").addEventListener("click", async ()=>{
  try{ await resetUserPassword(); } catch(err){ showToast("bad", err.message); }
});
$("btnUserDelete").addEventListener("click", async ()=>{
  try{ await deleteUser(); } catch(err){ showToast("bad", err.message); }
});
$("btnUserClear").addEventListener("click", clearUserForm);

// =====================
// HELP
// =====================
$("btnHelpApi").addEventListener("click", async ()=>{
  try{
    const txt = await apiFetch("/help", { method:"GET", headers:{ Authorization:"" } });
    $("helpText").textContent = txt.message ? txt.message : txt;
    showToast("ok","Help loaded");
  }catch(err){
    showToast("bad", err.message);
  }
});

// =====================
// INIT
// =====================
(async ()=>{
  try{
    await initRoomTypes();
    await getNextNo();
    await refreshDashboard();
    await loadManage();
    await loadRoomTypesTable();
    await loadUsers();        // ✅ NEW (Users tab)
    clearUserForm();          // ✅ reset form
  }catch(err){
    showToast("bad", err.message);
  }
})();