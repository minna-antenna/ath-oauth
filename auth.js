'use strict';
(() => {
  const incoming = new URL(window.location.href);
  // Strip query/fragment from history immediately. Never log them or send analytics.
  window.history.replaceState(null, '', incoming.pathname);
  const status = document.getElementById('status');
  const transfer = document.getElementById('transfer');
  const field = document.getElementById('handoff');
  const copy = document.getElementById('copy');
  const expiry = document.getElementById('expiry');
  let handoff = '';
  const clear = () => { handoff = ''; field.value = ''; copy.disabled = true; };
  window.addEventListener('pagehide', clear);
  document.getElementById('clear').addEventListener('click', () => { clear(); status.textContent = 'このページから認証結果を消去しました。'; });
  if (window.top !== window.self || incoming.protocol !== 'https:') {
    status.textContent = 'ご自身のHTTPSサイトに設置してから、ATHから認証を開始してください。'; return;
  }
  const params = incoming.searchParams;
  if (['code', 'state', 'error'].some(k => params.getAll(k).length > 1)) {
    status.textContent = '重複した認証パラメーターを拒否しました。ATHから開始し直してください。'; return;
  }
  const state = params.get('state') || '';
  const code = params.get('code') || '';
  const declined = document.documentElement.dataset.outcome === 'declined';
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(state) || code.length > 15000 || (declined && code) || (!declined && (!code || params.has('error')))) {
    status.textContent = declined ? '元のATH画面で必要に応じて接続を開始し直してください。保存済みの認証情報は変更していません。' : '認証結果がありません。ページを直接開いた場合や再読み込みした場合は、ATHから認証を開始し直してください。'; return;
  }
  if (declined && params.has('error') && params.get('error') !== 'access_denied') {
    status.textContent = '認証結果を確認できません。ATHから開始し直してください。'; return;
  }
  const result = {version: 1, environment: 'sandbox', callback_url: incoming.origin + incoming.pathname, state};
  if (declined) result.error = 'access_denied'; else result.code = code;
  const bytes = new TextEncoder().encode(JSON.stringify(result));
  let raw = ''; for (const byte of bytes) raw += String.fromCharCode(byte);
  handoff = 'ATH-EBAY-SANDBOX:' + btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  field.value = handoff; transfer.hidden = false;
  status.textContent = declined ? 'キャンセル結果を元のATH画面へ戻せます。保存済みトークンを削除する操作ではありません。' : 'eBayから認証結果を受け取りました。コピーして元のATH画面へ貼り付けてください。';
  const seconds = Math.min(299, Math.max(1, Number(params.get('expires_in')) || 299));
  const deadline = Date.now() + seconds * 1000;
  const timer = window.setInterval(() => {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    expiry.textContent = `コピー元ページの表示期限: あと${remaining}秒。認証コードの有効性はeBay側で検証します。`;
    if (remaining === 0) { clear(); clearInterval(timer); status.textContent = '表示期限が切れました。ATHから認証を開始し直してください。'; }
  }, 1000);
  copy.addEventListener('click', async () => {
    if (!handoff) return;
    try {
      await navigator.clipboard.writeText(handoff);
      status.textContent = 'コピーしました。認証を開始した元のATH画面へ貼り付けてください。';
    } catch {
      try {
        field.type = 'text'; field.focus(); field.select();
        if (!document.execCommand('copy')) throw new Error('copy unavailable');
        status.textContent = 'コピーしました。元のATH画面へ貼り付けてください。';
      } catch { status.textContent = 'コピーを許可して再度押してください。認証結果を第三者へ送らないでください。'; }
      finally { field.type = 'password'; }
    }
  });
})();
