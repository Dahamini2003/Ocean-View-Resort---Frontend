// ✅ Change this if your app context root is different
const API_BASE = "http://localhost:8080/oceanview/api";

const $ = (id) => document.getElementById(id);

const state = {
  token: sessionStorage.getItem("token") || "",
  role: sessionStorage.getItem("role") || "",
};

function setSession(token, role) {
  state.token = token || "";
  state.role = role || "";
  sessionStorage.setItem("token", state.token);
  sessionStorage.setItem("role", state.role);
  renderSession();
}

function clearSession() {
  state.token = "";
  state.role = "";
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("role");
  renderSession();
}

function renderSession() {
  const info = state.token
    ? `Logged in as ${state.role || "USER"} | Token saved`
    : "Not logged in";
  $("sessionInfo").textContent = info;
  $("btnLogout").hidden = !state.token;
}

function showToast(type, msg) {
  const toast = $("toast");
  toast.className = `toast ${type || ""}`.trim();
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toast.hidden = true), 3500);
}

async function apiFetch(path, options = {}) {
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    options.headers || {}
  );

  if (state.token && !headers.Authorization) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get("content-type") || "";
  let bodyText = "";
  let bodyJson = null;

  if (contentType.includes("application/json")) {
    bodyJson = await res.json().catch(() => null);
  } else {
    bodyText = await res.text().catch(() => "");
  }

  if (!res.ok) {
    const msg =
      (bodyJson && (bodyJson.message || JSON.stringify(bodyJson))) ||
      bodyText ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return bodyJson ?? bodyText;
}

// Tabs
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("isActive"));
    btn.classList.add("isActive");

    const tabId = btn.dataset.tab;
    ["tabLogin", "tabReservations", "tabPayments", "tabHelp"].forEach((id) => {
      $(id).hidden = id !== tabId;
    });
  });
});

$("apiBaseLabel").textContent = API_BASE;

// Login
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const username = $("loginUser").value.trim();
    const password = $("loginPass").value;

    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      headers: { Authorization: "" }, // avoid sending old token
    });

    setSession(data.token, data.role);
    showToast("ok", "Login success");
  } catch (err) {
    showToast("bad", err.message);
  }
});

$("btnLogout").addEventListener("click", () => {
  clearSession();
  showToast("warn", "Logged out");
});

$("btnCheckApi").addEventListener("click", async () => {
  try {
    const help = await apiFetch("/help", { method: "GET", headers: { Authorization: "" } });
    showToast("ok", "API is reachable");
    $("helpText").textContent = help || "OK";
  } catch (err) {
    showToast("bad", "API not reachable: " + err.message);
  }
});

// Room Types
async function loadRoomTypes() {
  try {
    const types = await apiFetch("/room-types", { method: "GET", headers: { Authorization: "" } });
    const sel = $("roomType");
    sel.innerHTML = `<option value="">-- select --</option>`;
    (types || []).forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.typeName;
      opt.textContent = `${t.typeName} (LKR ${t.ratePerNight})`;
      sel.appendChild(opt);
    });
    showToast("ok", "Room types loaded");
  } catch (err) {
    showToast("bad", err.message);
  }
}

$("btnLoadRoomTypes").addEventListener("click", loadRoomTypes);

// Create Reservation
$("resCreateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.token) return showToast("warn", "Please login first");

  try {
    const payload = {
      reservationNo: $("resNo").value.trim(),
      guestName: $("guestName").value.trim(),
      address: $("address").value.trim(),
      contactNumber: $("contactNo").value.trim(),
      roomType: $("roomType").value,
      checkIn: $("checkIn").value,
      checkOut: $("checkOut").value,
    };

    // if guestName empty but contact exists, backend may still accept (depending on your service rules)
    const created = await apiFetch("/reservations", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    $("createResult").hidden = false;
    $("createResult").textContent = JSON.stringify(created, null, 2);

    $("findResNo").value = created.reservationNo || payload.reservationNo;
    $("billResNo").value = created.reservationNo || payload.reservationNo;
    $("payResNo").value = created.reservationNo || payload.reservationNo;

    showToast("ok", created.message || "Reservation created");
  } catch (err) {
    showToast("bad", err.message);
  }
});

$("btnClearResForm").addEventListener("click", () => {
  ["resNo", "guestName", "address", "contactNo", "checkIn", "checkOut"].forEach((id) => ($(id).value = ""));
  $("roomType").value = "";
  $("createResult").hidden = true;
});

// Find Reservation
$("btnFindReservation").addEventListener("click", async () => {
  if (!state.token) return showToast("warn", "Please login first");
  const resNo = $("findResNo").value.trim();
  if (!resNo) return showToast("warn", "Enter reservation no");

  try {
    const data = await apiFetch(`/reservations/${encodeURIComponent(resNo)}`, { method: "GET" });
    $("resDetails").hidden = false;
    $("resDetails").textContent = JSON.stringify(data, null, 2);

    $("billResNo").value = data.reservationNo || resNo;
    $("payResNo").value = data.reservationNo || resNo;

    showToast("ok", "Reservation loaded");
  } catch (err) {
    showToast("bad", err.message);
  }
});

// Bill
$("btnGetBill").addEventListener("click", async () => {
  if (!state.token) return showToast("warn", "Please login first");
  const resNo = $("billResNo").value.trim();
  if (!resNo) return showToast("warn", "Enter reservation no");

  try {
    const bill = await apiFetch(`/reservations/${encodeURIComponent(resNo)}/bill`, { method: "GET" });

    const html = `
      <div style="display:flex;justify-content:space-between;gap:10px;">
        <div>
          <div style="font-weight:900;font-size:16px;">Ocean View Resort</div>
          <div style="opacity:.8;">Bill / Receipt</div>
        </div>
        <div style="text-align:right;">
          <div><b>Reservation:</b> ${bill.reservationNo}</div>
          <div><b>Nights:</b> ${bill.nights}</div>
        </div>
      </div>
      <hr class="sep" style="margin:12px 0;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><b>Rate / Night:</b> LKR ${bill.ratePerNight}</div>
        <div><b>Total Cost:</b> LKR ${bill.totalCost}</div>
        <div><b>Total Paid:</b> LKR ${bill.totalPaid}</div>
        <div><b>Balance:</b> LKR ${bill.balance}</div>
      </div>
    `;

    $("billBox").hidden = false;
    $("billBox").innerHTML = html;
    $("btnPrintBill").disabled = false;

    showToast("ok", "Bill loaded");
  } catch (err) {
    showToast("bad", err.message);
  }
});

$("btnPrintBill").addEventListener("click", () => {
  if ($("billBox").hidden) return;
  window.print();
});

// Payments
$("payForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.token) return showToast("warn", "Please login first");

  const resNo = $("payResNo").value.trim();
  if (!resNo) return showToast("warn", "Enter reservation no");

  try {
    const payload = {
      amount: Number($("payAmount").value),
      paymentMethod: $("payMethod").value,
      paymentStatus: $("payStatus").value,
      referenceNo: $("payRef").value.trim(),
      notes: $("payNotes").value.trim(),
    };

    const created = await apiFetch(`/reservations/${encodeURIComponent(resNo)}/payments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    showToast("ok", "Payment added");
    $("btnLoadPayments").click();
  } catch (err) {
    showToast("bad", err.message);
  }
});

$("btnLoadPayments").addEventListener("click", async () => {
  if (!state.token) return showToast("warn", "Please login first");

  const resNo = $("payResNo").value.trim();
  if (!resNo) return showToast("warn", "Enter reservation no");

  try {
    const list = await apiFetch(`/reservations/${encodeURIComponent(resNo)}/payments`, { method: "GET" });
    $("paymentsList").hidden = false;
    $("paymentsList").textContent = JSON.stringify(list, null, 2);
    showToast("ok", "Payments loaded");
  } catch (err) {
    showToast("bad", err.message);
  }
});

$("btnClearPayForm").addEventListener("click", () => {
  ["payAmount", "payRef", "payNotes"].forEach((id) => ($(id).value = ""));
  $("payMethod").value = "CASH";
  $("payStatus").value = "PAID";
});

// Help
$("btnLoadHelp").addEventListener("click", async () => {
  try {
    const text = await apiFetch("/help", { method: "GET", headers: { Authorization: "" } });
    $("helpText").textContent = text || "No help text";
    showToast("ok", "Help loaded");
  } catch (err) {
    showToast("bad", err.message);
  }
});

// Init
renderSession();
loadRoomTypes().catch(() => {});