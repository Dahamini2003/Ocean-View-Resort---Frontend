// login.js ✅ FULL UPDATED (shows "Invalid username or password" for 401)

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    const username = $("username").value.trim();
    const password = $("password").value;

    const data = await apiFetch("/auth/login", {
      method: "POST",
      headers: { Authorization: "" },
      body: JSON.stringify({ username, password }),
    });

    const role = (data.role || "").toUpperCase();
    auth.set(data.token, role);

    showToast("ok", `Login success (${role})`);

    if (role === "ADMIN") window.location.href = "./admin.html";
    else window.location.href = "./reception.html";
  } catch (err) {
    // ✅ Friendly message for wrong credentials (401)
    const msg = String(err?.message || "").toLowerCase();

    if (msg.includes("401") || msg.includes("unauthorized")) {
      showToast("bad", "Invalid username or password");
    } else {
      showToast("bad", err?.message || "Login failed");
    }
  }
});

$("btnHelp").addEventListener("click", async () => {
  try {
    const txt = await apiFetch("/help", { method: "GET", headers: { Authorization: "" } });
    $("helpBox").hidden = false;
    $("helpBox").textContent = txt.message ? txt.message : txt;
    showToast("ok", "API reachable");
  } catch (err) {
    showToast("bad", err.message);
  }
});