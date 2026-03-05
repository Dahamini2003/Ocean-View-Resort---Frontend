// reception.js  ✅ (UNCHANGED your code + ONLY ADDED invoice-style display at the bottom)

protectPage(["ADMIN","RECEPTIONIST","STAFF","RECEPTIONIONIST"]); // allow old typo too
setSessionInfo();

$("btnLogout").addEventListener("click", ()=>{ auth.clear(); window.location.href="./login.html"; });

bindTabs(["tabAdd","tabList","tabBill","tabHelp","tabExit"]);

$("btnExitLogout").addEventListener("click", ()=>{ auth.clear(); window.location.href="./login.html"; });
$("btnExitTry").addEventListener("click", ()=> window.close());

$("btnGoList").addEventListener("click", ()=>{
  document.querySelector('[data-tab="tabList"]').click();
});
$("btnGoBill").addEventListener("click", ()=>{
  document.querySelector('[data-tab="tabBill"]').click();
});

let roomTypesCache = [];
let reservationsCache = [];

async function initRoomTypes(){
  try{
    const selAdd = $("roomType");
    const selFilter = $("filterRoomType");

    const list = await apiFetch("/room-types", { method:"GET", headers:{ Authorization:"" } });
    roomTypesCache = list || [];

    await loadRoomTypes(selAdd);
    selFilter.innerHTML = `<option value="">All Room Types</option>`;
    roomTypesCache.forEach(rt=>{
      const opt = document.createElement("option");
      opt.value = rt.typeName;
      opt.textContent = rt.typeName;
      selFilter.appendChild(opt);
    });
  }catch(err){
    showToast("bad", err.message);
  }
}

async function getNextNo(){
  const data = await apiFetch("/reservations/next-no", { method:"GET" });
  $("resNo").value = data.reservationNo || "";
}

$("btnNewNo").addEventListener("click", async ()=>{
  try{ await getNextNo(); showToast("ok","New reservation no created"); }
  catch(err){ showToast("bad", err.message); }
});

$("btnClearAdd").addEventListener("click", ()=>{
  ["guestName","contactNo","address"].forEach(id=> $(id).value = "");
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
    $("billNo").value = data.reservationNo || payload.reservationNo;

    // refresh next number for next entry
    await getNextNo();
    showToast("ok", data.message || "Reservation saved");
  }catch(err){
    showToast("bad", err.message);
  }
});

function renderReservationRows(list){
  const tbody = $("resTbody");
  tbody.innerHTML = "";

  if(!list.length){
    tbody.innerHTML = `<tr><td colspan="8" class="muted">No reservations found.</td></tr>`;
    return;
  }

  list.forEach(r=>{
    const st = calcStatus(r.checkIn, r.checkOut);
    const row = document.createElement("tr");

    row.innerHTML = `
      <td><span class="badge ${st.badge}">${st.label}</span></td>
      <td><b>${escapeHtml(r.reservationNo)}</b></td>
      <td>${escapeHtml(r.guestName || "-")}</td>
      <td>${escapeHtml(r.contactNumber || "-")}</td>
      <td>${escapeHtml(r.roomType || "-")}</td>
      <td>${escapeHtml(fmtDate(r.checkIn))}</td>
      <td>${escapeHtml(fmtDate(r.checkOut))}</td>
      <td>
        <button class="btn btnGhost" data-act="bill" data-no="${escapeHtml(r.reservationNo)}">Bill</button>
      </td>
    `;

    tbody.appendChild(row);
  });

  tbody.querySelectorAll("button[data-act='bill']").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const no = btn.getAttribute("data-no");
      $("billNo").value = no;
      document.querySelector('[data-tab="tabBill"]').click();
    });
  });
}

async function loadReservations(){
  const status = $("filterStatus").value;
  const roomType = $("filterRoomType").value;

  const q = new URLSearchParams();
  if(roomType) q.set("roomType", roomType);
  if(status && status !== "all") q.set("status", status);

  const list = await apiFetch(`/reservations?${q.toString()}`, { method:"GET" });
  reservationsCache = list || [];
  applySearchFilter();
}

function applySearchFilter(){
  const s = $("filterSearch").value.trim().toLowerCase();
  let list = reservationsCache;

  if(s){
    list = list.filter(r=>{
      return (r.reservationNo||"").toLowerCase().includes(s) ||
             (r.guestName||"").toLowerCase().includes(s) ||
             (r.contactNumber||"").toLowerCase().includes(s);
    });
  }
  renderReservationRows(list);
}

$("btnRefreshList").addEventListener("click", async ()=>{
  try{ await loadReservations(); showToast("ok","List refreshed"); }
  catch(err){ showToast("bad", err.message); }
});

$("filterStatus").addEventListener("change", ()=> loadReservations().catch(e=>showToast("bad", e.message)));
$("filterRoomType").addEventListener("change", ()=> loadReservations().catch(e=>showToast("bad", e.message)));
$("filterSearch").addEventListener("input", applySearchFilter);

// BILL
$("btnBill").addEventListener("click", async ()=>{
  try{
    const no = $("billNo").value.trim();
    if(!no) return showToast("warn","Enter reservation no");
    const bill = await apiFetch(`/reservations/${encodeURIComponent(no)}/bill`, { method:"GET" });

    const box = $("billPrintArea");
    box.style.display = "block";
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;">
        <div>
          <div style="font-weight:900;font-size:18px;">Ocean View Resort</div>
          <div class="muted">Bill / Receipt</div>
        </div>
        <div style="text-align:right;">
          <div><b>Reservation:</b> ${escapeHtml(bill.reservationNo)}</div>
          <div><b>Nights:</b> ${bill.nights}</div>
        </div>
      </div>

      <hr class="sep" />

      <div class="cards" style="grid-template-columns:repeat(2,1fr);">
        <div class="stat"><div class="k">Rate per night</div><div class="v">${money(bill.ratePerNight)}</div></div>
        <div class="stat"><div class="k">Total cost</div><div class="v">${money(bill.totalCost)}</div></div>
        <div class="stat"><div class="k">Total paid</div><div class="v">${money(bill.totalPaid)}</div></div>
        <div class="stat"><div class="k">Balance</div><div class="v">${money(bill.balance)}</div></div>
      </div>
    `;

    $("btnPrint").disabled = false;
    showToast("ok", "Bill loaded");
  }catch(err){
    showToast("bad", err.message);
  }
});

$("btnPrint").addEventListener("click", ()=> window.print());

// HELP
$("btnHelpApi").addEventListener("click", async ()=>{
  try{
    const txt = await apiFetch("/help", { method:"GET", headers:{ Authorization:"" } });
    $("helpText").textContent = txt.message ? txt.message : txt;
    showToast("ok","Help loaded");
  }catch(err){
    showToast("bad", err.message);
  }
});

// init
(async ()=>{
  await initRoomTypes();
  try{ await getNextNo(); } catch {}
  try{ await loadReservations(); } catch {}
})();





/* ==========================================================
   ✅ ADDED (UI only): Invoice-style Bill layout
   - Labels LEFT, Prices RIGHT (like invoice)
   - Backend/API unchanged
   - Your existing bill HTML stays same
========================================================== */
(function enhanceBillInvoiceUI(){
  const box = $("billPrintArea");
  if(!box) return;

  function applyInvoiceStyles(){
    const cards = box.querySelector(".cards");
    if(!cards) return;

    // Style the receipt container (only visual)
    box.style.background = "rgba(255,255,255,.92)";
    box.style.border = "1px solid rgba(11,36,48,.10)";
    box.style.borderRadius = "20px";
    box.style.boxShadow = "0 14px 30px rgba(0,0,0,.12)";
    box.style.padding = "0";
    box.style.overflow = "hidden";

    // Style header (first div in billPrintArea)
    const head = box.querySelector(":scope > div:first-child");
    if(head){
      head.style.padding = "16px 18px";
      head.style.background = "linear-gradient(135deg, rgba(42,166,178,.14), rgba(212,171,85,.10))";
      head.style.borderBottom = "1px solid rgba(11,36,48,.10)";
    }

    // Style hr line (sep)
    const hr = box.querySelector("hr");
    if(hr){
      hr.style.margin = "0";
      hr.style.height = "1px";
      hr.style.border = "none";
      hr.style.background = "rgba(11,36,48,.10)";
    }

    // Convert the stats grid into invoice rows
    cards.style.display = "flex";
    cards.style.flexDirection = "column";
    cards.style.gap = "0";
    cards.style.padding = "14px 18px 18px";
    cards.style.marginTop = "0";

    const stats = Array.from(cards.querySelectorAll(".stat"));
    stats.forEach((stat, idx)=>{
      stat.style.display = "flex";
      stat.style.alignItems = "center";
      stat.style.justifyContent = "space-between";
      stat.style.gap = "18px";
      stat.style.padding = "10px 0";
      stat.style.background = "transparent";
      stat.style.border = "none";
      stat.style.boxShadow = "none";
      stat.style.minHeight = "unset";

      const k = stat.querySelector(".k");
      const v = stat.querySelector(".v");

      if(k){
        k.style.fontWeight = "900";
        k.style.color = "rgba(11,36,48,.72)";
        k.style.fontSize = "15px";
      }
      if(v){
        v.style.fontWeight = "900";
        v.style.color = "rgba(11,36,48,.95)";
        v.style.fontSize = "18px";
        v.style.whiteSpace = "nowrap";
        v.style.textAlign = "right";
      }

      // Row separators
      if(idx !== stats.length - 1){
        stat.style.borderBottom = "1px solid rgba(11,36,48,.08)";
      }
    });

    // Highlight Balance row like "GRAND TOTAL"
    const last = stats[stats.length - 1];
    if(last){
      last.style.borderBottom = "none";
      last.style.marginTop = "8px";
      last.style.paddingTop = "16px";
      last.style.borderTop = "1px dashed rgba(11,36,48,.18)";

      const k = last.querySelector(".k");
      const v = last.querySelector(".v");
      if(v) v.style.fontSize = "22px";
      if(k) k.style.fontSize = "16px";
    }
  }

  // Observe changes (when Get Bill sets innerHTML)
  const obs = new MutationObserver(()=> applyInvoiceStyles());
  obs.observe(box, { childList:true, subtree:true });

  // Also try once on load (if already filled)
  applyInvoiceStyles();
})();