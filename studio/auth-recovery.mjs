/** CITYMUS email-link recovery. Parses links locally; NEVER fetches a tracking URL.
 * Only the official Supabase Auth origin may issue a verification token.
 * A redirect wrapper is accepted only when it CONTAINS a valid official link. */
const WRAPPER_PARAMS = ['url','u','q','target','link','destination','redirect','redirectUrl','redirect_url','continue','to'];
const AUTH_TYPES = new Set(['magiclink','signup','email','invite']);
const LIVE_STUDIO = 'https://citymus-production.vercel.app';

function unwrapUrl(input) {
  let value = String(input).trim().replace(/^["'<\s]+|[>"'\s]+$/g, '').replace(/&amp;/gi, '&');
  for (let pass=0;pass<2 && /^https?%3a%2f%2f/i.test(value);pass++) {
    try { value = decodeURIComponent(value); } catch { break; }
  }
  return value;
}
function candidateURL(input) {
  try { return new URL(unwrapUrl(input)); }
  catch { return null; }
}
function parseCandidate(url, authOrigin, depth=0, seen=new Set()) {
  if (!url || depth > 4 || seen.has(url.href)) return null;
  seen.add(url.href);
  const validVerify = url.protocol==='https:' && url.origin===authOrigin && url.pathname==='/auth/v1/verify';
  if (validVerify) {
    const hash=url.searchParams.get('token_hash') || url.searchParams.get('token');
    const type=(url.searchParams.get('type') || '').toLowerCase();
    if (!hash || !/^[A-Za-z0-9_-]{32,1024}$/.test(hash))
      throw Error('驗證信中的驗證碼不完整；請複製信內「登入」按鈕的原始連結');
    if (!AUTH_TYPES.has(type)) throw Error('驗證連結類型不支援：請使用 CITYMUS 的 Email 登入信');
    return {method:'verify',token_hash:hash,type};
  }
  const local = (url.origin==='http://localhost:3000' || url.origin==='http://127.0.0.1:3000');
  const official = (url.origin===LIVE_STUDIO && (url.pathname==='/studio/' || url.pathname==='/studio'));
  if (local || official) {
    const frag = new URLSearchParams(url.hash.replace(/^#/, ''));
    const access_token=frag.get('access_token'), refresh_token=frag.get('refresh_token');
    if (access_token && refresh_token) {
      if (access_token.length>4096 || refresh_token.length>4096 ||
          !/^[A-Za-z0-9._~-]+$/.test(access_token) || !/^[A-Za-z0-9._~-]+$/.test(refresh_token))
        throw Error('驗證連結中的登入資訊格式不正確');
      return {method:'session',access_token,refresh_token};
    }
    if (local) throw Error('你複製的是 localhost 頁面網址，但裡面沒有登入資訊。請重新寄信，長按信中的登入按鈕並選擇「複製連結」');
    throw Error('這是 CITYMUS 網站頁面，不是驗證信中的登入連結');
  }
  for (const name of WRAPPER_PARAMS) {
    for (const value of url.searchParams.getAll(name)) {
      const wrapped=candidateURL(value);
      if (wrapped) {
        const result=parseCandidate(wrapped,authOrigin,depth+1,seen);
        if (result) return result;
      }
    }
  }
  // Occasionally an email app encodes a full Supabase URL inside an opaque
  // search value. Only parse it if it is still visible as a complete URL.
  for (const [,value] of url.searchParams) {
    if (value.length>5000) continue;
    const nested=candidateURL(value);
    if(nested) {
      const result=parseCandidate(nested,authOrigin,depth+1,seen);
      if(result) return result;
    }
  }
  return null;
}
export function parseCitymusAuthRecoveryLink(raw,supabaseUrl) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length>16000)
    throw Error('請貼上登入信中「登入」按鈕的完整連結');
  let supa;
  try { supa=new URL(supabaseUrl); } catch { throw Error('CITYMUS 驗證服務尚未設定'); }
  const entry=candidateURL(raw);
  if(!entry) throw Error('貼上的不是完整網址。請在 Email 裡長按「登入」按鈕，選擇「複製連結」');
  const match=parseCandidate(entry,supa.origin);
  if(match) return match;
  if (/^(mail\.google\.com|gmail\.com|outlook\.live\.com|outlook\.office\.com|mail\.yahoo\.com)$/i.test(entry.hostname))
    throw Error('你複製到的是電子郵件的「信件頁面」，不是信內「登入」按鈕的連結。請長按登入按鈕並選擇「複製連結」');
  throw Error('這個網址不是 CITYMUS 驗證連結。請複製信內的登入按鈕網址；若郵件 App 包裝連結，請改用瀏覽器開啟郵件後複製原始連結');
}
