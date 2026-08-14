import { getList, setList, KEYS, LIMITS } from './storage.js';

export async function addAudit(event, email, details = {}) {
  try {
    const list = await getList(KEYS.audit);
    list.unshift({
      at: new Date().toISOString(),
      event,
      email,
      ...details,
    });
    await setList(KEYS.audit, list.slice(0, LIMITS.audit));
  } catch (err) {
    console.error('audit append failed:', err);
  }
}
