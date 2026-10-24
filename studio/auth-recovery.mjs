/** CITYMUS Magic Link recovery from a broken localhost callback.
 * Data stays in the browser; only the official Supabase Auth client receives tokens.
 * Never log, store, or transmit the recovered URLs to a custom backend. */
export function parseCitymusAuthRecoveryLink(raw, supabaseUrl) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 5000)
    throw Error('請貼上完整的登入驗證網址');
  let link, authHost;
  try {
    link = new URL(raw.trim());
    authHost = new URL(supabaseUrl);
  } catch {
    throw Error('不是有效的完整網址');
  }
  if (link.protocol === 'https:' && link.origin === authHost.origin &&
      link.pathname === '/auth/v1/verify') {
    const token_hash = link.searchParams.get('token_hash') || link.searchParams.get('token');
    const type = link.searchParams.get('type');
    if (!token_hash || !/^[a-zA-Z0-9_-]{32,512}$/.test(token_hash))
      throw Error('驗證信網址沒有有效驗證碼');
    if (!['magiclink', 'signup', 'email'].includes(type))
      throw Error('驗證連結類型不支援');
    return { method: 'verify', token_hash, type };
  }
  if (link.origin === 'http://localhost:3000' ||
      link.origin === 'http://127.0.0.1:3000') {
    const fragment = new URLSearchParams(link.hash.replace(/^#/, ''));
    const access_token = fragment.get('access_token');
    const refresh_token = fragment.get('refresh_token');
    if (!access_token || !refresh_token)
      throw Error('localhost 網址沒有可還原的登入資訊，請寄送新的驗證信');
    if (access_token.length > 4096 || refresh_token.length > 4096 ||
        !/^[a-zA-Z0-9._~-]+$/.test(access_token) ||
        !/^[a-zA-Z0-9._~-]+$/.test(refresh_token))
      throw Error('登入資訊格式不正確');
    return { method: 'session', access_token, refresh_token };
  }
  throw Error('請貼上 CITYMUS Supabase 驗證信連結，或 localhost:3000 網址');
}
