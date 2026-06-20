/* js/comp/ConfirmPopup.js
   PvZClassic — Reusable Confirm/Purchase Popup
   Usage:
     ConfirmPopup.show({
       title: 'Unlock Slot 7',
       body: 'Cost: 500 🪙 coins',
       confirmText: 'Unlock',
       cancelText: 'Cancel',
       type: 'purchase',        // 'purchase' | 'danger' | 'info'
       onConfirm: () => { ... },
       onCancel: () => { ... }, // optional
     });
*/

const ConfirmPopup = (() => {
  let _el = null;

  // Inject styles once
  function _injectStyles() {
    if (document.getElementById('confirm-popup-styles')) return;
    const style = document.createElement('style');
    style.id = 'confirm-popup-styles';
    style.textContent = `
      .cp-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.72);
        z-index: 9000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.18s ease;
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
        padding: 16px;
        box-sizing: border-box;
      }
      .cp-backdrop.cp-visible { opacity: 1; }

      .cp-box {
        background: linear-gradient(160deg, #130828 0%, #0a0018 100%);
        border: 1px solid rgba(168,85,247,0.35);
        border-radius: 18px;
        padding: 24px 20px 18px;
        width: 100%;
        max-width: 320px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(168,85,247,0.1);
        transform: scale(0.88);
        transition: transform 0.22s cubic-bezier(0.34,1.3,0.64,1);
      }
      .cp-backdrop.cp-visible .cp-box { transform: scale(1); }

      .cp-icon {
        font-size: 36px;
        line-height: 1;
        margin-bottom: 2px;
      }
      .cp-title {
        font-family: var(--font-display, sans-serif);
        font-size: 16px;
        font-weight: 700;
        color: #fff;
        letter-spacing: 1px;
        text-align: center;
      }
      .cp-body {
        font-size: 13px;
        color: rgba(255,255,255,0.65);
        text-align: center;
        line-height: 1.5;
      }
      .cp-cost-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        padding: 10px 20px;
        margin: 4px 0;
        width: 100%;
        box-sizing: border-box;
      }
      .cp-cost-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 15px;
        font-weight: 800;
        color: #fbbf24;
      }
      .cp-cost-item.cp-cost-loom { color: #a78bfa; }

      .cp-btns {
        display: flex;
        gap: 10px;
        width: 100%;
        margin-top: 4px;
      }
      .cp-btn {
        flex: 1;
        padding: 11px 8px;
        border-radius: 10px;
        border: none;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.1s, opacity 0.1s;
        letter-spacing: 0.5px;
        user-select: none;
        -webkit-user-select: none;
      }
      .cp-btn:active { transform: scale(0.95); opacity: 0.85; }
      .cp-btn-cancel {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        color: rgba(255,255,255,0.6);
      }
      .cp-btn-confirm {
        background: linear-gradient(135deg, #16a34a, #15803d);
        color: #fff;
        box-shadow: 0 4px 14px rgba(22,163,74,0.4);
      }
      .cp-btn-confirm.cp-danger {
        background: linear-gradient(135deg, #dc2626, #b91c1c);
        box-shadow: 0 4px 14px rgba(220,38,38,0.4);
      }
      .cp-btn-confirm.cp-purchase {
        background: linear-gradient(135deg, #d97706, #b45309);
        box-shadow: 0 4px 14px rgba(217,119,6,0.4);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * show(options)
   * options: {
   *   icon      : string (emoji),   default: '❓'
   *   title     : string,
   *   body      : string (html ok),
   *   costs     : [{ label, icon, amount, type }]  optional cost rows
   *   confirmText: string,           default: 'Confirm'
   *   cancelText : string,           default: 'Cancel'
   *   type      : 'purchase'|'danger'|'info', default: 'info'
   *   onConfirm : function,
   *   onCancel  : function,
   * }
   */
  function show(options = {}) {
    _injectStyles();

    const {
      icon        = options.type === 'purchase' ? '🛒' : options.type === 'danger' ? '⚠️' : '❓',
      title       = 'Confirm',
      body        = '',
      costs       = [],
      confirmText = 'Confirm',
      cancelText  = 'Cancel',
      type        = 'info',
      onConfirm   = null,
      onCancel    = null,
    } = options;

    // Remove any existing popup
    if (_el) _el.remove();

    const costsHTML = costs.length
      ? `<div class="cp-cost-row">${costs.map(c =>
          `<div class="cp-cost-item ${c.type === 'loom' ? 'cp-cost-loom' : ''}">
            <span>${c.icon || ''}</span>
            <span>${c.amount}</span>
            ${c.label ? `<span style="font-size:11px;opacity:0.7">${c.label}</span>` : ''}
          </div>`
        ).join('<span style="color:rgba(255,255,255,0.2)">+</span>')}</div>`
      : '';

    _el = document.createElement('div');
    _el.className = 'cp-backdrop';
    _el.innerHTML = `
      <div class="cp-box">
        <div class="cp-icon">${icon}</div>
        <div class="cp-title">${title}</div>
        ${body ? `<div class="cp-body">${body}</div>` : ''}
        ${costsHTML}
        <div class="cp-btns">
          <button class="cp-btn cp-btn-cancel" id="cp-cancel">${cancelText}</button>
          <button class="cp-btn cp-btn-confirm ${type === 'danger' ? 'cp-danger' : type === 'purchase' ? 'cp-purchase' : ''}" id="cp-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(_el);
    requestAnimationFrame(() => _el.classList.add('cp-visible'));

    const confirmBtn = _el.querySelector('#cp-confirm');
    const cancelBtn  = _el.querySelector('#cp-cancel');

    function _close() {
      _el.classList.remove('cp-visible');
      setTimeout(() => { if (_el) { _el.remove(); _el = null; } }, 200);
    }

    confirmBtn.addEventListener('click', () => {
      _close();
      if (onConfirm) onConfirm();
    });

    cancelBtn.addEventListener('click', () => {
      _close();
      if (onCancel) onCancel();
    });

    // Tap outside to cancel
    _el.addEventListener('click', e => {
      if (e.target === _el) {
        _close();
        if (onCancel) onCancel();
      }
    });
  }

  function close() {
    if (_el) {
      _el.classList.remove('cp-visible');
      setTimeout(() => { if (_el) { _el.remove(); _el = null; } }, 200);
    }
  }

  return { show, close };
})();
