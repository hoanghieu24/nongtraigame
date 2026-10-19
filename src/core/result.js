export const ok = (extra) => ({ ok: true, ...extra });
export const fail = (msg) => ({ ok: false, msg });
