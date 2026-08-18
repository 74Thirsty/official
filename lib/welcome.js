import { readFile } from 'node:fs/promises';
import { escapeHtml } from './http.js';

const WELCOME_LETTER_URL = new URL('../assets/WELCOME.md', import.meta.url);

export async function readWelcomeLetter() {
  return readFile(WELCOME_LETTER_URL, 'utf8');
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*(?!\*)/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
}

function markdownToHtml(markdown) {
  const blocks = [];
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    blocks.push('<ul style="margin:0 0 18px;padding-left:22px;color:#d6d6d6;font-size:15px;line-height:1.6;">' + listItems.map((item) => '<li>' + inlineMarkdown(item) + '</li>').join('') + '</ul>');
    listItems = [];
  };
  for (const line of lines) {
    const item = line.match(/^\*\s+(.+)$/);
    if (item) { listItems.push(item[1]); continue; }
    flushList();
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,2})\s+(.+)$/);
    if (heading) {
      const tag = heading[1].length === 1 ? 'h1' : 'h2';
      blocks.push('<' + tag + ' style="margin:24px 0 12px;color:#ff6a00;font-size:' + (tag === 'h1' ? '26px' : '20px') + ';line-height:1.25;">' + inlineMarkdown(heading[2]) + '</' + tag + '>');
    } else {
      blocks.push('<p style="margin:0 0 14px;color:#d6d6d6;font-size:15px;line-height:1.6;">' + inlineMarkdown(line) + '</p>');
    }
  }
  flushList();
  return blocks.join('');
}

export async function renderWelcomeEmail(ebookUrl, unsubUrl) {
  const body = markdownToHtml(await readWelcomeLetter());
  const safeEbookUrl = escapeHtml(ebookUrl);
  const safeUnsubUrl = escapeHtml(unsubUrl);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to Lost Limb Riders</title></head><body style="margin:0;padding:0;background:#050505;font-family:Arial,Helvetica,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;"><tr><td align="center" style="padding:40px 20px;"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="background:#101010;padding:32px;border-radius:12px 12px 0 0;">${body}<p style="margin:24px 0;text-align:center;"><a href="${safeEbookUrl}" style="display:inline-block;background:#ff6a00;color:#fff;font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;padding:14px 30px;border-radius:8px;">Download Your Free Autographed Copy</a></p></td></tr><tr><td style="background:#0a0a0a;padding:28px 32px;border-radius:0 0 12px 12px;"><p style="margin:0;color:#777;font-size:12px;text-align:center;">You are receiving this because you signed up at lostlimbriders.org.<br><a href="${safeUnsubUrl}" style="color:#aaa;text-decoration:underline;">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>`;
}
