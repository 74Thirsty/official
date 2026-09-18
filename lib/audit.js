/**
 * @file        audit.js
 * @description Append-only audit trail
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
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
