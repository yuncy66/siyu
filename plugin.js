// ================================================================
// 私语空间 plugin v1.0.0
// 交换日记 · 悄悄话 · 匿名提问箱
// ================================================================
;(function () {
'use strict'

// ── 设计令牌 ────────────────────────────────────────────────────
const C = {
  bg:        '#f7f4f0',
  surface:   '#ffffff',
  card:      '#fdfaf7',
  border:    '#e8e2db',
  borderSoft:'#f0ebe4',
  text:      '#2a2420',
  textMid:   '#6b5f58',
  textSub:   '#a09088',
  accent:    '#c4a49a',   // 灰粉
  accentBg:  '#f5ede9',
  accentDeep:'#9a7060',
  ink:       '#3a2e28',
  line:      '#e8e0d8',   // 日记横线色
  noteYellow:'#fef9e7',
  notePink:  '#fce8ec',
  noteBlue:  '#e8f0fe',
  noteGreen: '#e8f5e9',
  noteWhite: '#fafafa',
}

// ── Google Fonts（DM Serif Display + Noto Serif SC） ─────────────
const FONT_URL = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Noto+Serif+SC:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap'

// ── 便利贴样板 ───────────────────────────────────────────────────
const NOTE_STYLES = [
  { id: 'yellow', bg: '#fef9e7', border: '#f5e88a', pin: '📌', shape: 'square' },
  { id: 'pink',   bg: '#fce8ec', border: '#f0b8c4', pin: '🩷', shape: 'square' },
  { id: 'blue',   bg: '#e8f0fe', border: '#b8c8f8', pin: '🔵', shape: 'square' },
  { id: 'green',  bg: '#e8f5e9', border: '#a8d8b0', pin: '📎', shape: 'square' },
  { id: 'dots',   bg: '#fce8ec', border: '#f0b8c4', pin: '🩷', shape: 'dots' },
  { id: 'grid',   bg: '#fafafa', border: '#d8d8d8', pin: '📍', shape: 'grid' },
  { id: 'bread',  bg: '#fef4e0', border: '#e8c880', pin: '🍞', shape: 'bread' },
]

// ── 工具函数 ─────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
const uuid = () => crypto.randomUUID()
const now  = () => Date.now()
const fmt  = ts => new Date(ts).toLocaleDateString('zh-CN',{month:'long',day:'numeric'})
const fmtFull = ts => new Date(ts).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\//g,'.')

function injectStyle(id, css) {
  if (document.getElementById(id)) return
  const s = document.createElement('style')
  s.id = id; s.textContent = css
  document.head.appendChild(s)
}
function removeStyle(id) { document.getElementById(id)?.remove() }

// ── 全局状态（跨 app 共享）──────────────────────────────────────
let _roche = null
let _ctx   = null   // { chars, userName, userAvatar, activeChar }
let _customFont = '' // 用户自定义字体 URL

async function loadCtx(roche) {
  _roche = roche
  let chars = []
  try { chars = await roche.character.list() } catch(_) {}
  let userName = '云云', userAvatar = ''
  try {
    const u = await roche.persona.getActiveUserPersona()
    if (u) { userName = u.handle || u.name || userName; userAvatar = u.avatar || '' }
  } catch(_) {}
  const savedCharId = await roche.storage.get('siyu_activeCharId').catch(()=>null)
  let activeChar = chars.find(c=>c.id===savedCharId) || chars[0] || null
  _ctx = { chars, userName, userAvatar, activeChar }
  _customFont = await roche.storage.get('siyu_customFont').catch(()=>null) || ''
  return _ctx
}

async function getCharMemory(char) {
  if (!char?.conversationId || !_roche) return ''
  try {
    const lt = await _roche.memory.getLongTerm({ conversationId: char.conversationId, limit: 80 })
    const core = lt.core?.summary || ''
    const facts = (lt.facts||[]).slice(0,30).map(f=>f.summaryText||f.action||'').filter(Boolean).join('\n')
    return [core, facts].filter(Boolean).join('\n')
  } catch(_) { return '' }
}

async function saveMemory(char, text) {
  if (!char?.conversationId || !_roche) return
  try {
    await _roche.memory.write({
      conversationId: char.conversationId,
      summaryText: text,
      who: [_ctx?.userName || '云云'],
      action: text,
      when: '最近',
      where: '私语空间插件',
      source: 'plugin',
    })
  } catch(_) {}
}

// ── 全局 CSS ─────────────────────────────────────────────────────
const GLOBAL_CSS = () => `
@import url('${FONT_URL}');

.siyu-root *, .siyu-root *::before, .siyu-root *::after {
  box-sizing: border-box; margin: 0; padding: 0;
}
.siyu-root {
  height: 100%; display: flex; flex-direction: column;
  background: ${C.bg};
  font-family: ${_customFont ? `'SiyuCustom', ` : ''}'DM Sans','PingFang SC','Noto Serif SC',sans-serif;
  color: ${C.text};
  overflow: hidden;
  position: relative;
}
${_customFont ? `@font-face { font-family: 'SiyuCustom'; src: url('${_customFont}'); }` : ''}

/* ── 背景 ── */
.siyu-bg-layer {
  position: absolute; inset: 0; z-index: 0;
  background-size: cover; background-position: center;
  pointer-events: none;
}

/* ── 顶栏 ── */
.siyu-header {
  position: relative; z-index: 2;
  display: flex; align-items: center; gap: 10px;
  padding: 14px 18px 12px;
  background: rgba(255,255,255,0.82);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid ${C.borderSoft};
  flex-shrink: 0;
}
.siyu-back {
  background: none; border: none; cursor: pointer;
  font-size: 20px; color: ${C.accent}; line-height: 1; padding: 2px 4px 2px 0;
}
.siyu-title-serif {
  font-family: 'DM Serif Display', 'Noto Serif SC', serif;
  font-size: 17px; color: ${C.ink}; flex: 1; letter-spacing: .01em;
}
.siyu-header-sub {
  font-size: 11px; color: ${C.textSub}; letter-spacing: .05em;
}

/* ── 滚动体 ── */
.siyu-body {
  position: relative; z-index: 1;
  flex: 1; overflow-y: auto;
  padding: 16px 16px 90px;
  display: flex; flex-direction: column; gap: 14px;
}
.siyu-body-pad { padding-bottom: 100px; }

/* ── 液态玻璃底栏 ── */
.siyu-nav {
  position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
  z-index: 10;
  display: flex; gap: 0;
  background: rgba(255,255,255,0.65);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.8);
  border-radius: 30px;
  padding: 6px 8px;
  box-shadow: 0 4px 24px rgba(0,0,0,.10), 0 1px 4px rgba(0,0,0,.06);
  min-width: 260px;
}
.siyu-nav-item {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  gap: 2px; padding: 6px 14px; cursor: pointer;
  border-radius: 22px; transition: background .18s;
  border: none; background: none;
  font-family: inherit;
}
.siyu-nav-item:hover { background: rgba(196,164,154,.15); }
.siyu-nav-item.active { background: rgba(196,164,154,.28); }
.siyu-nav-icon { font-size: 18px; line-height: 1; }
.siyu-nav-label { font-size: 10px; color: ${C.textMid}; letter-spacing: .02em; }
.siyu-nav-item.active .siyu-nav-label { color: ${C.accentDeep}; font-weight: 500; }

/* ── 通用卡片 ── */
.siyu-card {
  background: rgba(255,255,255,0.92);
  border: 1px solid ${C.border};
  border-radius: 14px;
  padding: 16px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* ── 标签 ── */
.siyu-label {
  font-size: 11px; color: ${C.textSub};
  letter-spacing: .06em; text-transform: uppercase; margin-bottom: 5px;
}

/* ── 输入框 ── */
.siyu-input, .siyu-textarea, .siyu-select {
  width: 100%; border: 1px solid ${C.border}; border-radius: 10px;
  padding: 10px 13px; font-size: 14px; color: ${C.text};
  background: ${C.surface}; outline: none; font-family: inherit;
  transition: border-color .15s;
}
.siyu-input:focus, .siyu-textarea:focus, .siyu-select:focus { border-color: ${C.accent}; }
.siyu-textarea { resize: vertical; min-height: 100px; line-height: 1.8; }

/* ── 按钮 ── */
.siyu-btn {
  border: 1px solid ${C.border}; border-radius: 10px;
  padding: 10px 18px; font-size: 13px; cursor: pointer;
  font-family: inherit; letter-spacing: .02em;
  transition: all .15s; background: ${C.surface}; color: ${C.textMid};
}
.siyu-btn:hover { border-color: ${C.accent}; color: ${C.accentDeep}; }
.siyu-btn:disabled { opacity: .4; cursor: not-allowed; }
.siyu-btn-fill { background: ${C.ink}; color: #fff; border-color: ${C.ink}; }
.siyu-btn-fill:hover { background: ${C.accentDeep}; border-color: ${C.accentDeep}; color: #fff; }
.siyu-btn-soft { background: ${C.accentBg}; color: ${C.accentDeep}; border-color: ${C.accentBg}; }
.siyu-btn-soft:hover { background: #ecddd8; }
.siyu-row { display: flex; gap: 8px; }
.siyu-row .siyu-btn { flex: 1; }

/* ── 状态 ── */
.siyu-status { font-size: 12px; color: ${C.textSub}; min-height: 16px; }
.siyu-status.ok  { color: #7a9e7e; }
.siyu-status.err { color: #b06060; }

/* ── 日记本封面 ── */
.siyu-book-cover-wrap {
  width: 100%; max-width: 300px; margin: 0 auto;
  aspect-ratio: 3/4; border-radius: 6px 18px 18px 6px;
  position: relative; cursor: pointer;
  box-shadow: -6px 6px 20px rgba(0,0,0,.18), -2px 2px 0 rgba(0,0,0,.08);
  overflow: hidden; transition: transform .2s;
}
.siyu-book-cover-wrap:hover { transform: translateY(-3px) rotate(.5deg); }
.siyu-book-cover-img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.siyu-book-cover-default {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 14px;
}
.siyu-book-spine {
  position: absolute; left: 0; top: 0; bottom: 0; width: 18px;
  background: linear-gradient(to right, rgba(0,0,0,.15), rgba(0,0,0,.04), transparent);
  border-radius: 6px 0 0 6px;
}
.siyu-book-cover-title {
  font-family: 'DM Serif Display','Noto Serif SC',serif;
  font-size: 22px; letter-spacing: .05em; text-align: center;
  padding: 0 20px;
}
.siyu-book-cover-hint {
  font-size: 12px; opacity: .6; letter-spacing: .04em;
}

/* ── 日记内页 ── */
.siyu-diary-page {
  background: ${C.surface};
  border-radius: 14px;
  box-shadow: 0 2px 16px rgba(0,0,0,.08);
  overflow: hidden;
  position: relative;
}
.siyu-diary-page-header {
  padding: 14px 18px 10px;
  border-bottom: 1px solid ${C.borderSoft};
  display: flex; align-items: center; gap: 8px;
}
.siyu-diary-page-date {
  font-family: 'DM Serif Display', serif;
  font-size: 13px; color: ${C.textSub}; flex: 1; letter-spacing: .04em;
}
.siyu-diary-page-author {
  display: flex; align-items: center; gap: 6px;
}
.siyu-diary-page-avatar {
  width: 22px; height: 22px; border-radius: 50%;
  object-fit: cover; background: ${C.accentBg};
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; flex-shrink: 0; overflow: hidden;
}
.siyu-diary-page-avatar img { width: 100%; height: 100%; object-fit: cover; }
.siyu-diary-page-name { font-size: 12px; color: ${C.textMid}; }

/* 日记正文带横线 */
.siyu-diary-lines {
  padding: 16px 18px 20px;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 31px,
    ${C.line} 31px,
    ${C.line} 32px
  );
  background-position: 0 20px;
  line-height: 32px;
  font-size: 15px; color: ${C.text};
  min-height: 200px;
  white-space: pre-wrap; word-break: break-word;
  font-family: ${_customFont ? "'SiyuCustom'," : ''}'Noto Serif SC', serif;
}

/* 划掉效果 */
.siyu-strikethrough { text-decoration: line-through; color: ${C.textSub}; }
/* 涂改效果 */
.siyu-correction {
  position: relative; display: inline;
}
.siyu-correction::before {
  content: attr(data-wrong);
  position: absolute; top: 0; left: 0;
  color: ${C.textSub}; text-decoration: line-through;
  font-size: .9em; white-space: nowrap;
}

/* ── 便利贴 ── */
.siyu-sticker-wrap {
  margin: 0 18px 18px;
  position: relative;
}
.siyu-sticker {
  border-radius: 3px;
  padding: 12px 14px;
  font-size: 14px; line-height: 1.75;
  white-space: pre-wrap; word-break: break-word;
  position: relative;
  box-shadow: 2px 3px 8px rgba(0,0,0,.10);
  font-family: ${_customFont ? "'SiyuCustom'," : ''}'Noto Serif SC', serif;
}
.siyu-sticker.dots {
  background-image: radial-gradient(circle, rgba(0,0,0,.12) 1px, transparent 1px);
  background-size: 12px 12px;
}
.siyu-sticker.grid {
  background-image:
    linear-gradient(rgba(0,0,0,.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,.06) 1px, transparent 1px);
  background-size: 16px 16px;
}
.siyu-sticker.bread {
  border-radius: 24px 24px 20px 20px;
  border: 2.5px solid;
}
.siyu-sticker-pin {
  position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
  font-size: 18px; line-height: 1;
}
.siyu-sticker-author {
  font-size: 11px; color: ${C.textSub}; margin-bottom: 6px;
  letter-spacing: .04em;
}
.siyu-sticker-pending {
  font-size: 12px; color: ${C.textSub}; font-style: italic; padding: 10px 0;
}

/* ── 搜索框 ── */
.siyu-search {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,.9);
  border: 1px solid ${C.border}; border-radius: 22px;
  padding: 9px 14px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.siyu-search input {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 14px; color: ${C.text}; font-family: inherit;
}
.siyu-search-icon { color: ${C.textSub}; font-size: 14px; }

/* ── 日记本双格 ── */
.siyu-books-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
  padding: 8px 4px;
}
.siyu-mini-book {
  cursor: pointer; display: flex; flex-direction: column;
  align-items: center; gap: 8px; transition: transform .18s;
}
.siyu-mini-book:hover { transform: translateY(-3px); }
.siyu-mini-book-cover {
  width: 100%; aspect-ratio: 3/4;
  border-radius: 4px 10px 10px 4px;
  box-shadow: -4px 4px 12px rgba(0,0,0,.15);
  overflow: hidden; position: relative;
}
.siyu-mini-book-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.siyu-mini-book-default {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px;
  font-family: 'DM Serif Display', serif;
}
.siyu-mini-book-spine {
  position: absolute; left: 0; top: 0; bottom: 0; width: 10px;
  background: linear-gradient(to right, rgba(0,0,0,.18), transparent);
}
.siyu-mini-book-title {
  font-size: 12px; color: ${C.textMid}; text-align: center; letter-spacing: .02em;
}

/* ── 选项卡 ── */
.siyu-tabs {
  display: flex; border-bottom: 1px solid ${C.border}; margin-bottom: 14px;
  background: rgba(255,255,255,.7);
  border-radius: 10px 10px 0 0; overflow: hidden;
}
.siyu-tab {
  flex: 1; padding: 11px; text-align: center;
  font-size: 13px; color: ${C.textSub}; cursor: pointer;
  border-bottom: 2.5px solid transparent; transition: all .15s; letter-spacing: .02em;
}
.siyu-tab.active { color: ${C.ink}; border-bottom-color: ${C.accent}; font-weight: 500; }

/* ── 匿名卡片 ── */
.siyu-anon-card {
  background: rgba(255,255,255,.92);
  border: 1px solid ${C.border};
  border-radius: 14px; padding: 16px;
  display: flex; flex-direction: column; gap: 10px;
}
.siyu-anon-q {
  font-size: 15px; color: ${C.ink}; line-height: 1.7;
  font-family: 'Noto Serif SC', serif;
}
.siyu-anon-meta { font-size: 11px; color: ${C.textSub}; letter-spacing: .04em; }
.siyu-anon-answer {
  background: ${C.accentBg}; border-radius: 10px;
  padding: 12px 14px; font-size: 14px; line-height: 1.75;
  color: ${C.text}; white-space: pre-wrap; word-break: break-word;
}
.siyu-anon-char-reply {
  background: #e8f0fe; border-radius: 10px;
  padding: 12px 14px; font-size: 13px; line-height: 1.7;
  color: #3a4a7a; white-space: pre-wrap; word-break: break-word;
  font-style: italic;
}
.siyu-anon-hint {
  font-size: 11px; color: ${C.accentDeep}; letter-spacing: .02em;
}

/* ── 首页 ── */
.siyu-home-header {
  padding: 28px 20px 16px;
  position: relative; z-index: 2;
}
.siyu-home-title {
  font-family: 'DM Serif Display', serif;
  font-size: 30px; color: ${C.ink}; letter-spacing: -.01em;
}
.siyu-home-sub { font-size: 12px; color: ${C.textSub}; margin-top: 4px; letter-spacing: .04em; }
.siyu-char-avatar-row {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px;
  background: rgba(255,255,255,.85); border-radius: 14px;
  backdrop-filter: blur(8px); border: 1px solid ${C.borderSoft};
  cursor: pointer;
}
.siyu-char-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  object-fit: cover; flex-shrink: 0;
  background: ${C.accentBg}; display: flex; align-items: center;
  justify-content: center; font-size: 16px; overflow: hidden;
}
.siyu-char-avatar img { width: 100%; height: 100%; object-fit: cover; }
.siyu-char-name { font-size: 15px; color: ${C.ink}; font-weight: 500; }
.siyu-char-bio { font-size: 12px; color: ${C.textSub}; margin-top: 2px; }

/* ── 图片上传组件 ── */
.siyu-img-upload { display: flex; align-items: center; gap: 10px; }
.siyu-img-preview {
  width: 56px; height: 56px; border-radius: 10px;
  object-fit: cover; border: 1px solid ${C.border};
  background: ${C.accentBg}; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; overflow: hidden;
}
.siyu-img-preview img { width: 100%; height: 100%; object-fit: cover; border-radius: 10px; }
.siyu-img-btns { display: flex; flex-direction: column; gap: 5px; }
.siyu-img-url-row { display: flex; gap: 6px; margin-top: 6px; }
.siyu-img-url-row .siyu-input { padding: 7px 10px; font-size: 12px; }

/* ── 悄悄话便利贴墙 ── */
.siyu-whisper-grid {
  columns: 2; column-gap: 10px;
}
.siyu-whisper-item {
  break-inside: avoid; margin-bottom: 10px;
  border-radius: 4px; padding: 14px 13px 12px;
  box-shadow: 2px 3px 8px rgba(0,0,0,.09);
  position: relative; cursor: pointer;
  font-family: ${_customFont ? "'SiyuCustom'," : ''}'Noto Serif SC', serif;
  font-size: 14px; line-height: 1.75; color: ${C.text};
  white-space: pre-wrap; word-break: break-word;
  transition: transform .15s;
}
.siyu-whisper-item:hover { transform: translateY(-2px); }
.siyu-whisper-pin {
  position: absolute; top: -9px; left: 50%; transform: translateX(-50%);
  font-size: 16px;
}
.siyu-whisper-dots {
  background-image: radial-gradient(circle, rgba(0,0,0,.1) 1px, transparent 1px);
  background-size: 10px 10px;
}
.siyu-whisper-grid-bg {
  background-image:
    linear-gradient(rgba(0,0,0,.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,.05) 1px, transparent 1px);
  background-size: 14px 14px;
}
.siyu-whisper-bread {
  border-radius: 22px 22px 18px 18px !important;
  border: 2px solid;
}
.siyu-whisper-meta {
  font-size: 10px; color: ${C.textSub}; margin-top: 8px;
  letter-spacing: .03em; text-align: right;
}

/* ── 写作浮层 ── */
.siyu-write-overlay {
  position: absolute; inset: 0; z-index: 20;
  background: rgba(42,36,32,.45);
  backdrop-filter: blur(4px);
  display: flex; align-items: flex-end;
}
.siyu-write-sheet {
  width: 100%; background: ${C.surface};
  border-radius: 20px 20px 0 0;
  padding: 20px 18px 32px;
  display: flex; flex-direction: column; gap: 12px;
  max-height: 85vh; overflow-y: auto;
}
.siyu-write-handle {
  width: 36px; height: 4px; background: ${C.border};
  border-radius: 2px; margin: 0 auto 4px;
}

/* ── 涂改/划线工具栏 ── */
.siyu-effect-bar {
  display: flex; gap: 6px; flex-wrap: wrap;
}
.siyu-effect-btn {
  font-size: 11px; padding: 4px 10px;
  border: 1px solid ${C.border}; border-radius: 20px;
  background: ${C.surface}; cursor: pointer; color: ${C.textMid};
  transition: all .12s; font-family: inherit;
}
.siyu-effect-btn:hover { border-color: ${C.accent}; color: ${C.accentDeep}; }
.siyu-effect-btn.active { background: ${C.accentBg}; border-color: ${C.accent}; color: ${C.accentDeep}; }

/* ── 延迟选择 ── */
.siyu-delay-row {
  display: flex; gap: 6px; flex-wrap: wrap;
}
.siyu-delay-btn {
  font-size: 11px; padding: 5px 12px;
  border: 1px solid ${C.border}; border-radius: 20px;
  background: ${C.surface}; cursor: pointer; color: ${C.textMid};
  font-family: inherit; transition: all .12s;
}
.siyu-delay-btn:hover { border-color: ${C.accent}; }
.siyu-delay-btn.active { background: ${C.ink}; border-color: ${C.ink}; color: #fff; }

/* ── 页脚翻页 ── */
.siyu-page-footer {
  display: flex; align-items: center; justify-content: center; gap: 16px;
  padding: 16px 0 4px;
}
.siyu-page-btn {
  background: rgba(255,255,255,.85); border: 1px solid ${C.border};
  border-radius: 20px; padding: 7px 18px; font-size: 13px;
  color: ${C.textMid}; cursor: pointer; font-family: inherit;
  transition: all .15s;
}
.siyu-page-btn:hover { border-color: ${C.accent}; color: ${C.accentDeep}; }
.siyu-page-btn:disabled { opacity: .35; cursor: not-allowed; }
.siyu-page-num { font-size: 12px; color: ${C.textSub}; }
`

// ── 图片上传组件 ─────────────────────────────────────────────────
function mountImgUpload(wrap, opts) {
  // opts: { id, current, placeholder, onChange }
  wrap.innerHTML = `
    <div class="siyu-img-upload">
      <div class="siyu-img-preview" id="${opts.id}-preview">
        ${opts.current ? `<img src="${esc(opts.current)}">` : (opts.placeholder || '🖼')}
      </div>
      <div class="siyu-img-btns">
        <label class="siyu-btn" style="cursor:pointer;font-size:12px;padding:6px 12px">
          本地上传
          <input type="file" accept="image/*" id="${opts.id}-file" style="display:none">
        </label>
        <button class="siyu-btn" id="${opts.id}-urltoggle" style="font-size:12px;padding:6px 12px">链接</button>
      </div>
    </div>
    <div class="siyu-img-url-row" id="${opts.id}-urlrow" style="display:none">
      <input class="siyu-input" id="${opts.id}-urlinput" type="text" placeholder="https://...">
      <button class="siyu-btn siyu-btn-soft" id="${opts.id}-urlok" style="white-space:nowrap;font-size:12px">确认</button>
    </div>
  `
  const preview = wrap.querySelector(`#${opts.id}-preview`)
  function setImg(src) {
    preview.innerHTML = `<img src="${esc(src)}">`
    opts.onChange && opts.onChange(src)
  }
  wrap.querySelector(`#${opts.id}-file`).addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return
    const r = new FileReader()
    r.onload = ev => setImg(ev.target.result)
    r.readAsDataURL(f)
  })
  const urlRow = wrap.querySelector(`#${opts.id}-urlrow`)
  wrap.querySelector(`#${opts.id}-urltoggle`).addEventListener('click', () => {
    urlRow.style.display = urlRow.style.display === 'none' ? 'flex' : 'none'
  })
  wrap.querySelector(`#${opts.id}-urlok`).addEventListener('click', () => {
    const v = wrap.querySelector(`#${opts.id}-urlinput`).value.trim()
    if (v) { setImg(v); urlRow.style.display = 'none' }
  })
}

// ── 处理文本的涂改/划线标记 ────────────────────────────────────
// 格式：~~划掉~~ 和 ~~错字->正字~~
function renderDiaryText(raw) {
  if (!raw) return ''
  return esc(raw)
    .replace(/~~([^~]+?)~>/g, '<span class="siyu-strikethrough">$1</span>')  // ~~旧->新~~
    .replace(/~~([^~]+?)~~/g, '<span class="siyu-strikethrough">$1</span>') // ~~划掉~~
}

// ── 延迟配置 ─────────────────────────────────────────────────────
const DELAYS = [
  { label: '立刻', id: 0, ms: 0 },
  { label: '1–3 小时', id: 1, ms: -1 },
  { label: '当天晚些', id: 2, ms: -2 },
  { label: '第二天', id: 3, ms: -3 },
]
function computeRevealAt(delayId) {
  if (delayId === 0) return Date.now()
  if (delayId === 1) { return Date.now() + (1 + Math.random() * 2) * 3600000 }
  if (delayId === 2) { // 当天晚上随机时间
    const d = new Date(); d.setHours(20 + Math.floor(Math.random()*3), Math.floor(Math.random()*60), 0, 0)
    return d < Date.now() ? Date.now() + 3600000 : d.getTime()
  }
  if (delayId === 3) { // 次日早上
    const d = new Date(); d.setDate(d.getDate()+1); d.setHours(8+Math.floor(Math.random()*3), 0, 0, 0)
    return d.getTime()
  }
  return Date.now()
}
function isRevealed(entry) {
  if (!entry.revealAt) return true
  return Date.now() >= entry.revealAt
}

// ================================================================
// 首页
// ================================================================
async function mountHome(container, roche) {
  await loadCtx(roche)
  injectStyle('siyu-css', GLOBAL_CSS())
  let bgUrl = await roche.storage.get('siyu_bg').catch(()=>null) || ''

  function render() {
    container.innerHTML = ''
    const root = document.createElement('div')
    root.className = 'siyu-root'

    // 背景
    if (bgUrl) {
      root.innerHTML = `<div class="siyu-bg-layer" style="background-image:url('${esc(bgUrl)}')"></div>`
    }

    const char = _ctx.activeChar
    const charName = char ? (char.handle || char.name) : '未选择角色'
    const charAvatar = char?.avatar || ''
    const charBio = char?.bio || ''

    root.innerHTML += `
      <div class="siyu-home-header">
        <div class="siyu-home-title">私语空间</div>
        <div class="siyu-home-sub">只属于你们的角落</div>
      </div>
      <div class="siyu-body">
        <!-- 选角色 -->
        <div class="siyu-label">当前角色</div>
        <div class="siyu-char-avatar-row" id="siyu-char-toggle">
          <div class="siyu-char-avatar">
            ${charAvatar ? `<img src="${esc(charAvatar)}">` : '🐱'}
          </div>
          <div>
            <div class="siyu-char-name">${esc(charName)}</div>
            ${charBio ? `<div class="siyu-char-bio">${esc(charBio.slice(0,40))}…</div>` : ''}
          </div>
          <div style="margin-left:auto;color:${C.textSub};font-size:13px">切换 ›</div>
        </div>

        <!-- 角色选择列表（折叠）-->
        <div id="siyu-char-list" style="display:none;flex-direction:column;gap:6px">
          ${_ctx.chars.map(c => `
            <div class="siyu-char-avatar-row" data-charid="${esc(c.id)}" style="cursor:pointer">
              <div class="siyu-char-avatar">
                ${c.avatar ? `<img src="${esc(c.avatar)}">` : '🐱'}
              </div>
              <div>
                <div class="siyu-char-name">${esc(c.handle||c.name)}</div>
              </div>
              ${c.id === char?.id ? '<div style="margin-left:auto;font-size:12px;color:'+C.accentDeep+'">✓</div>' : ''}
            </div>
          `).join('')}
        </div>

        <!-- 背景设置 -->
        <div class="siyu-card" style="padding:12px 14px">
          <div class="siyu-label" style="margin-bottom:8px">背景图</div>
          <div id="siyu-bg-upload"></div>
          ${bgUrl ? `<button class="siyu-btn" id="siyu-bg-clear" style="margin-top:8px;font-size:12px;padding:6px 12px">清除背景</button>` : ''}
        </div>

        <!-- 字体设置 -->
        <div class="siyu-card" style="padding:12px 14px">
          <div class="siyu-label" style="margin-bottom:6px">自定义字体链接</div>
          <div class="siyu-row">
            <input class="siyu-input" id="siyu-font-input" type="text"
              placeholder="https://...字体文件 URL (.ttf/.woff2)"
              value="${esc(_customFont)}" style="font-size:12px">
            <button class="siyu-btn siyu-btn-soft" id="siyu-font-save" style="white-space:nowrap;font-size:12px">保存</button>
          </div>
          ${_customFont ? `<div style="font-size:11px;color:${C.textSub};margin-top:4px">已自定义字体（重新打开生效）</div>` : ''}
        </div>

        <div style="height:60px"></div>
      </div>

      <!-- 底栏 -->
      <div class="siyu-nav">
        <button class="siyu-nav-item active" id="nav-home">
          <span class="siyu-nav-icon">ʕ•ᴥ•ʔ</span>
          <span class="siyu-nav-label">主页</span>
        </button>
        <button class="siyu-nav-item" id="nav-diary">
          <span class="siyu-nav-icon">📓</span>
          <span class="siyu-nav-label">日记</span>
        </button>
        <button class="siyu-nav-item" id="nav-whisper">
          <span class="siyu-nav-icon">(´｡• ᵕ •｡\`)</span>
          <span class="siyu-nav-label">悄悄话</span>
        </button>
        <button class="siyu-nav-item" id="nav-anon">
          <span class="siyu-nav-icon">(°▽°)</span>
          <span class="siyu-nav-label">提问箱</span>
        </button>
      </div>
    `

    container.appendChild(root)

    // 背景上传
    const bgWrap = root.querySelector('#siyu-bg-upload')
    mountImgUpload(bgWrap, {
      id: 'siyu-bg', current: bgUrl, placeholder: '🌸',
      onChange: async v => {
        bgUrl = v
        await roche.storage.set('siyu_bg', v).catch(()=>{})
        render()
      }
    })
    root.querySelector('#siyu-bg-clear')?.addEventListener('click', async () => {
      bgUrl = ''; await roche.storage.set('siyu_bg', '').catch(()=>{}); render()
    })

    // 字体保存
    root.querySelector('#siyu-font-save')?.addEventListener('click', async () => {
      const v = root.querySelector('#siyu-font-input').value.trim()
      _customFont = v
      await roche.storage.set('siyu_customFont', v).catch(()=>{})
      roche.ui.toast('字体已保存，重新打开插件生效')
    })

    // 角色切换
    root.querySelector('#siyu-char-toggle')?.addEventListener('click', () => {
      const list = root.querySelector('#siyu-char-list')
      list.style.display = list.style.display === 'none' ? 'flex' : 'none'
    })
    root.querySelectorAll('[data-charid]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.charid
        _ctx.activeChar = _ctx.chars.find(c=>c.id===id)
        await roche.storage.set('siyu_activeCharId', id).catch(()=>{})
        render()
      })
    })

    // 导航
    root.querySelector('#nav-diary')?.addEventListener('click', () => roche.ui.openApp('siyu-diary'))
    root.querySelector('#nav-whisper')?.addEventListener('click', () => roche.ui.openApp('siyu-whisper'))
    root.querySelector('#nav-anon')?.addEventListener('click', () => roche.ui.openApp('siyu-anon'))
    root.querySelector('#nav-home')?.addEventListener('click', () => {})
  }

  render()
}

// ================================================================
// 交换日记
// ================================================================
async function mountDiary(container, roche) {
  if (!_ctx) await loadCtx(roche)
  injectStyle('siyu-css', GLOBAL_CSS())

  // 数据结构：{ myBook: {cover, color}, charBook: {cover, color}, entries: [{id, ts, text, charReply, charReplyRevealAt, charReplyPending}] }
  let data = await roche.storage.get('siyu_diary').catch(()=>null) || {
    myBook:   { cover: '', color: '#f5ede9', textColor: '#3a2e28', title: 'My Diary' },
    charBook: { cover: '', color: '#dce8f0', textColor: '#2a3a4a', title: '' },
    entries:  [],
  }

  let view = 'shelf'    // 'shelf' | 'mine' | 'char' | 'write' | 'editBook'
  let activePage = 0    // 当前第几页（每页1篇）
  let editTarget = ''   // 'mine' | 'char'
  let writeState = { text: '', delayId: 0, effect: '' }
  let searchQ = ''

  // 打开时检查待生成
  async function checkPending() {
    let changed = false
    for (const e of data.entries) {
      if (e.charReplyPending && isRevealed(e)) {
        await genCharReply(e)
        changed = true
      }
    }
    if (changed) await save()
  }

  async function save() {
    await roche.storage.set('siyu_diary', data).catch(()=>{})
  }

  async function genCharReply(entry) {
    const char = _ctx.activeChar
    if (!char) return
    const charName = char.handle || char.name
    const persona = char.persona || char.bio || ''
    const mem = await getCharMemory(char)
    try {
      const res = await roche.ai.chat({
        messages: [{
          role: 'system',
          content: `你是${charName}。${persona}\n你对${_ctx.userName}的了解：\n${mem||'暂无'}\n\n${_ctx.userName}在你们的交换日记里写了一篇给你看。请写你的日记回应，就像真实的人写手账一样：有情绪，有细节，提到你自己今天的事，顺带回应她写的内容。100-250字，语气亲密自然。用正常中文，不要AI格式，不要分段标题。可以用 ~~划掉的字~~ 来表达划线涂改效果。`
        }, {
          role: 'user',
          content: `${_ctx.userName}的日记：\n${entry.text}`
        }],
        temperature: 0.9
      })
      entry.charReply = res.text?.trim() || ''
      entry.charReplyPending = false
      await saveMemory(char, `${_ctx.userName}在交换日记里写道：${entry.text.slice(0,100)}`)
    } catch(e) { entry.charReplyPending = false }
  }

  function filteredEntries() {
    if (!searchQ) return data.entries
    return data.entries.filter(e =>
      e.text?.includes(searchQ) || e.charReply?.includes(searchQ)
    )
  }

  function render() {
    container.innerHTML = ''
    const root = document.createElement('div')
    root.className = 'siyu-root'

    const bgUrl = ''  // 可扩展从全局读
    if (bgUrl) root.innerHTML = `<div class="siyu-bg-layer" style="background-image:url('${esc(bgUrl)}')"></div>`

    if (view === 'shelf') renderShelf(root)
    else if (view === 'mine' || view === 'char') renderDiaryView(root)
    else if (view === 'write') renderWrite(root)
    else if (view === 'editBook') renderEditBook(root)

    container.appendChild(root)
  }

  function renderShelf(root) {
    const char = _ctx.activeChar
    const charName = char ? (char.handle || char.name) : '角色'
    const charBook = data.charBook
    const myBook = data.myBook

    root.innerHTML = `
      <div class="siyu-header">
        <button class="siyu-back" id="siyu-back">‹</button>
        <div class="siyu-title-serif">交换日记</div>
        <div class="siyu-header-sub" style="margin-left:auto">Exchange Diary</div>
      </div>

      <!-- 选项卡 -->
      <div style="display:flex;gap:10px;padding:12px 16px 0;position:relative;z-index:2">
        <button class="siyu-tab active" id="tab-mine"
          style="flex:1;border:1px solid ${C.border};border-radius:22px;background:rgba(196,164,154,.22);border-bottom:none">
          我的日记本
        </button>
        <button class="siyu-tab" id="tab-char"
          style="flex:1;border:1px solid ${C.border};border-radius:22px;background:rgba(255,255,255,.5);border-bottom:none">
          ${esc(charName)} 的日记本
        </button>
      </div>

      <div class="siyu-body" style="padding-top:16px;align-items:center">
        <!-- 搜索 -->
        <div class="siyu-search">
          <span class="siyu-search-icon">⌕</span>
          <input id="siyu-search" placeholder="搜索日记内容…" value="${esc(searchQ)}">
        </div>

        <!-- 我的本子封面 -->
        <div id="siyu-mybook-cover" class="siyu-book-cover-wrap" style="display:block">
          ${myBook.cover
            ? `<img src="${esc(myBook.cover)}" class="siyu-book-cover-img">`
            : `<div class="siyu-book-cover-default" style="background:${esc(myBook.color)};color:${esc(myBook.textColor)}">
                <div class="siyu-book-cover-title">${esc(myBook.title || 'My Diary')}</div>
                <div class="siyu-book-cover-hint">点击翻开日记本</div>
               </div>`
          }
          <div class="siyu-book-spine"></div>
        </div>
        <div style="display:flex;gap:8px;width:100%;max-width:300px">
          <button class="siyu-btn siyu-btn-fill" id="siyu-open-mine" style="flex:1">翻开日记本</button>
          <button class="siyu-btn" id="siyu-edit-mine" style="font-size:12px;padding:10px 12px">✏ 编辑封面</button>
        </div>

        <div style="height:60px"></div>
      </div>

      <!-- 底栏 -->
      ${renderNav('diary')}
    `

    // 角色封面会在切换tab时显示，这里先做tab切换
    root.querySelector('#siyu-back')?.addEventListener('click', () => roche.ui.openApp('siyu-home'))
    root.querySelector('#siyu-search')?.addEventListener('input', e => { searchQ = e.target.value })

    root.querySelector('#tab-mine')?.addEventListener('click', () => {
      // 直接打开我的日记
      view = 'mine'; activePage = 0; render()
    })
    root.querySelector('#tab-char')?.addEventListener('click', () => {
      view = 'char'; activePage = 0; render()
    })
    root.querySelector('#siyu-mybook-cover')?.addEventListener('click', () => {
      view = 'mine'; activePage = 0; render()
    })
    root.querySelector('#siyu-open-mine')?.addEventListener('click', () => {
      view = 'mine'; activePage = 0; render()
    })
    root.querySelector('#siyu-edit-mine')?.addEventListener('click', () => {
      editTarget = 'mine'; view = 'editBook'; render()
    })

    bindNav(root, 'diary')
  }

  function renderDiaryView(root) {
    const isMine = view === 'mine'
    const char = _ctx.activeChar
    const charName = char ? (char.handle||char.name) : '角色'
    const charAvatar = char?.avatar || ''
    const entries = filteredEntries()

    // 我的日记：每页显示1篇，带角色便利贴
    // 角色日记：每页显示1篇角色回应
    const total = isMine ? entries.length : entries.filter(e=>e.charReply||e.charReplyPending).length
    const currentEntry = isMine ? entries[activePage] : entries.filter(e=>e.charReply||e.charReplyPending)[activePage]

    const book = isMine ? data.myBook : data.charBook
    const bookTitle = isMine ? (book.title || 'My Diary') : (book.title || charName + ' Diary')

    root.innerHTML = `
      <div class="siyu-header">
        <button class="siyu-back" id="siyu-back">‹</button>
        <div>
          <div class="siyu-title-serif">${esc(bookTitle)}</div>
          <div class="siyu-header-sub">${isMine ? '我的日记' : charName + ' 的日记'}</div>
        </div>
        ${isMine ? `<button class="siyu-btn siyu-btn-soft" id="siyu-write-btn" style="margin-left:auto;font-size:12px;padding:7px 13px">✏ 写</button>` : ''}
      </div>
      <div class="siyu-body">
        <!-- 选项卡 -->
        <div class="siyu-tabs">
          <div class="siyu-tab ${isMine?'active':''}" id="tab-mine2">我的</div>
          <div class="siyu-tab ${!isMine?'active':''}" id="tab-char2">${esc(charName)} 的</div>
        </div>

        ${!currentEntry ? `
          <div style="text-align:center;padding:48px 20px;color:${C.textSub};font-size:13px;line-height:2">
            ${isMine ? '还没有写过<br><span style="font-size:11px">点右上角 ✏ 开始写吧</span>' : '还没有内容'}
          </div>
        ` : `
          <!-- 日记页 -->
          <div class="siyu-diary-page">
            <!-- 页眉 -->
            <div class="siyu-diary-page-header">
              <div class="siyu-diary-page-date">${fmtFull(currentEntry.ts)}</div>
              <div class="siyu-diary-page-author">
                <div class="siyu-diary-page-avatar">
                  ${isMine
                    ? (_ctx.userAvatar ? `<img src="${esc(_ctx.userAvatar)}">` : '🙂')
                    : (charAvatar ? `<img src="${esc(charAvatar)}">` : '🐱')
                  }
                </div>
                <div class="siyu-diary-page-name">
                  ${esc(isMine ? _ctx.userName : charName)} 的日记
                </div>
              </div>
            </div>
            <!-- 正文横线 -->
            <div class="siyu-diary-lines">
              ${isMine
                ? renderDiaryText(currentEntry.text)
                : (currentEntry.charReply
                    ? renderDiaryText(currentEntry.charReply)
                    : '<span style="color:'+C.textSub+';font-style:italic">正在写…</span>')
              }
            </div>
          </div>

          <!-- 如果是我的日记，角色在下面贴便利贴 -->
          ${isMine ? renderCharSticker(currentEntry, charName, charAvatar) : ''}

          <!-- 如果是角色日记，显示对应我的日记摘要 -->
          ${!isMine && currentEntry.text ? `
            <div style="font-size:12px;color:${C.textSub};padding:0 4px">
              对应云云的日记：${esc(currentEntry.text.slice(0,60))}…
            </div>
          ` : ''}
        `}

        <!-- 翻页 -->
        ${total > 0 ? `
          <div class="siyu-page-footer">
            <button class="siyu-page-btn" id="siyu-prev" ${activePage<=0?'disabled':''}>‹ 前一页</button>
            <span class="siyu-page-num">${activePage+1} / ${total} 页</span>
            <button class="siyu-page-btn" id="siyu-next" ${activePage>=total-1?'disabled':''}>下一页 ›</button>
          </div>
        ` : ''}

        <div style="height:70px"></div>
      </div>
      ${renderNav('diary')}
    `

    root.querySelector('#siyu-back')?.addEventListener('click', () => { view='shelf'; render() })
    root.querySelector('#tab-mine2')?.addEventListener('click', () => { view='mine'; activePage=0; render() })
    root.querySelector('#tab-char2')?.addEventListener('click', () => { view='char'; activePage=0; render() })
    root.querySelector('#siyu-write-btn')?.addEventListener('click', () => { view='write'; render() })
    root.querySelector('#siyu-prev')?.addEventListener('click', () => { activePage--; render() })
    root.querySelector('#siyu-next')?.addEventListener('click', () => { activePage++; render() })
    bindNav(root, 'diary')
  }

  function renderCharSticker(entry, charName, charAvatar) {
    if (entry.charReplyPending && !isRevealed(entry)) {
      const d = new Date(entry.revealAt)
      const timeStr = d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})
      return `
        <div class="siyu-sticker-wrap">
          <div style="font-size:12px;color:${C.textSub};font-style:italic;padding:8px 4px">
            ${esc(charName)} 还在写…（预计 ${timeStr} 前后）
          </div>
        </div>
      `
    }
    if (!entry.charReply) return ''
    // 随机选便利贴样式（固定seed by entry id）
    const styleIdx = entry.id.charCodeAt(0) % NOTE_STYLES.length
    const ns = NOTE_STYLES[styleIdx]
    return `
      <div class="siyu-sticker-wrap">
        <div class="siyu-sticker ${ns.shape==='dots'?'dots':ns.shape==='grid'?'grid':ns.shape==='bread'?'bread':''}"
          style="background:${ns.bg};border:1.5px solid ${ns.border}">
          <div class="siyu-sticker-pin">${ns.pin}</div>
          <div class="siyu-sticker-author">
            ${esc(charName)} 的留言
          </div>
          ${renderDiaryText(entry.charReply)}
        </div>
      </div>
    `
  }

  function renderWrite(root) {
    root.innerHTML = `
      <div class="siyu-header">
        <button class="siyu-back" id="siyu-back">‹</button>
        <div class="siyu-title-serif">写今天的日记</div>
      </div>
      <div class="siyu-body">
        <div class="siyu-label">文字效果（选中文字后点击）</div>
        <div class="siyu-effect-bar">
          <button class="siyu-effect-btn" id="eff-strike" title="划掉">~~划掉~~</button>
          <button class="siyu-effect-btn" id="eff-hint">用 ~~文字~~ 标记划掉</button>
        </div>
        <textarea class="siyu-textarea" id="siyu-diary-text"
          placeholder="今天想写点什么…&#10;&#10;可以用 ~~这样~~ 来划掉字&#10;适合 100-500 字"
          style="min-height:200px;font-family:${_customFont?'SiyuCustom,':''}Noto Serif SC,serif;line-height:1.9;background-image:repeating-linear-gradient(to bottom,transparent,transparent 31px,${C.line} 31px,${C.line} 32px);background-position:0 16px;padding-top:16px"
        >${esc(writeState.text)}</textarea>
        <div>
          <div class="siyu-label">角色什么时候回应</div>
          <div class="siyu-delay-row">
            ${DELAYS.map(d=>`
              <button class="siyu-delay-btn ${writeState.delayId===d.id?'active':''}" data-delay="${d.id}">
                ${d.label}
              </button>
            `).join('')}
          </div>
        </div>
        <div class="siyu-status err" id="siyu-status"></div>
        <button class="siyu-btn siyu-btn-fill" id="siyu-submit">提交日记</button>
        <div style="height:20px"></div>
      </div>
    `
    root.querySelector('#siyu-back')?.addEventListener('click', () => { view='mine'; render() })
    root.querySelector('#siyu-diary-text')?.addEventListener('input', e => { writeState.text = e.target.value })
    root.querySelectorAll('[data-delay]').forEach(el => {
      el.addEventListener('click', () => { writeState.delayId = Number(el.dataset.delay); render() })
    })
    root.querySelector('#eff-strike')?.addEventListener('click', () => {
      const ta = root.querySelector('#siyu-diary-text')
      const s = ta.selectionStart, e = ta.selectionEnd
      if (s !== e) {
        const sel = ta.value.slice(s,e)
        const newVal = ta.value.slice(0,s) + '~~' + sel + '~~' + ta.value.slice(e)
        ta.value = newVal; writeState.text = newVal
      }
    })
    root.querySelector('#siyu-submit')?.addEventListener('click', async () => {
      if (!writeState.text.trim()) {
        root.querySelector('#siyu-status').textContent = '请先写点什么'
        root.querySelector('#siyu-status').className = 'siyu-status err'
        return
      }
      const revealAt = computeRevealAt(writeState.delayId)
      const entry = {
        id: uuid(), ts: now(),
        text: writeState.text.trim(),
        charReply: '', charReplyPending: true,
        revealAt,
        delayId: writeState.delayId
      }
      data.entries.unshift(entry)
      await save()
      writeState = { text: '', delayId: 0 }
      view = 'mine'; activePage = 0; render()
      // 立刻生成
      if (isRevealed(entry)) {
        await genCharReply(entry)
        await save(); render()
      } else {
        roche.ui.toast(`日记已保存，${DELAYS[entry.delayId]?.label}可以看到回应`)
      }
    })
  }

  function renderEditBook(root) {
    const target = editTarget === 'mine' ? data.myBook : data.charBook
    const label = editTarget === 'mine' ? '我的日记本' : '角色的日记本'
    root.innerHTML = `
      <div class="siyu-header">
        <button class="siyu-back" id="siyu-back">‹</button>
        <div class="siyu-title-serif">编辑 ${esc(label)}</div>
      </div>
      <div class="siyu-body">
        <div class="siyu-label">封面图</div>
        <div id="siyu-cover-upload"></div>
        <div class="siyu-label" style="margin-top:8px">封面背景色</div>
        <input type="color" class="siyu-input" id="siyu-cover-color" value="${esc(target.color||'#f5ede9')}" style="height:44px;padding:4px">
        <div class="siyu-label" style="margin-top:4px">文字颜色</div>
        <input type="color" class="siyu-input" id="siyu-text-color" value="${esc(target.textColor||'#3a2e28')}" style="height:44px;padding:4px">
        <div class="siyu-label" style="margin-top:4px">标题</div>
        <input class="siyu-input" id="siyu-cover-title" value="${esc(target.title||'')}" placeholder="日记本标题">
        <button class="siyu-btn siyu-btn-fill" id="siyu-save-cover">保存</button>
      </div>
    `
    root.querySelector('#siyu-back')?.addEventListener('click', () => { view='shelf'; render() })
    const coverWrap = root.querySelector('#siyu-cover-upload')
    mountImgUpload(coverWrap, {
      id: 'diary-cover', current: target.cover, placeholder: '📓',
      onChange: v => { target.cover = v }
    })
    root.querySelector('#siyu-cover-color')?.addEventListener('input', e => { target.color = e.target.value })
    root.querySelector('#siyu-text-color')?.addEventListener('input', e => { target.textColor = e.target.value })
    root.querySelector('#siyu-cover-title')?.addEventListener('input', e => { target.title = e.target.value })
    root.querySelector('#siyu-save-cover')?.addEventListener('click', async () => {
      await save(); roche.ui.toast('已保存'); view='shelf'; render()
    })
  }

  await checkPending()
  render()
}

// ================================================================
// 悄悄话
// ================================================================
async function mountWhisper(container, roche) {
  if (!_ctx) await loadCtx(roche)
  injectStyle('siyu-css', GLOBAL_CSS())

  let items = await roche.storage.get('siyu_whisper').catch(()=>null) || []
  // item: {id, ts, text, from, style, effects:[]}
  // from: 'me' | 'char'
  let view = 'wall'  // 'wall' | 'write'
  let writeState = { text: '', styleId: 'yellow', from: 'me', effects: [] }
  let showWrite = false

  const EFFECT_LABELS = [
    { id: 'strike', label: '~~划掉~~', desc: '选中后加删除线' },
  ]

  // 打开时检查角色是否要发新悄悄话
  async function checkCharWhisper() {
    const char = _ctx.activeChar
    if (!char) return
    const lastCharTs = await roche.storage.get('siyu_whisper_lastchar').catch(()=>null) || 0
    const gap = Date.now() - lastCharTs
    // 随机每隔 1-3 天角色发一条悄悄话
    const threshold = (24 + Math.random() * 48) * 3600000
    if (gap < threshold) return

    const mem = await getCharMemory(char)
    const charName = char.handle || char.name
    const persona = char.persona || char.bio || ''
    try {
      const res = await roche.ai.chat({
        messages: [{
          role: 'system',
          content: `你是${charName}。${persona}\n你对${_ctx.userName}的了解：\n${mem||'暂无'}\n\n你想在悄悄话墙上悄悄写一张便利贴给${_ctx.userName}。就是那种你突然想到什么，想写下来但又不好意思直接说的话，或者一句不知道该怎么说出口的想念。一句话到三句话，真实，不要华丽，不要说教。直接输出那句话，不要加引号或说明。`
        }, { role: 'user', content: '写一张' }],
        temperature: 0.92
      })
      const text = res.text?.trim()
      if (!text) return
      const styleIdx = Math.floor(Math.random() * NOTE_STYLES.length)
      items.unshift({
        id: uuid(), ts: now(),
        text,
        from: 'char',
        style: NOTE_STYLES[styleIdx].id,
        effects: []
      })
      await roche.storage.set('siyu_whisper', items).catch(()=>{})
      await roche.storage.set('siyu_whisper_lastchar', Date.now()).catch(()=>{})
      await saveMemory(char, `${charName}在悄悄话里写了：${text.slice(0,60)}`)
    } catch(_) {}
  }

  function renderNoteStyle(item) {
    const ns = NOTE_STYLES.find(n=>n.id===item.style) || NOTE_STYLES[0]
    let cls = 'siyu-whisper-item'
    if (ns.shape === 'dots') cls += ' siyu-whisper-dots'
    if (ns.shape === 'grid') cls += ' siyu-whisper-grid-bg'
    if (ns.shape === 'bread') cls += ' siyu-whisper-bread'
    const borderStyle = ns.shape === 'bread' ? `border-color:${ns.border};` : ''
    const char = _ctx.activeChar
    const isChar = item.from === 'char'
    return `
      <div class="${cls}" data-id="${esc(item.id)}"
        style="background:${ns.bg};${borderStyle}">
        <div class="siyu-whisper-pin">${ns.pin}</div>
        <div style="font-size:10px;color:${C.textSub};margin-bottom:6px;letter-spacing:.04em">
          ${isChar ? esc(char?.handle||char?.name||'角色') : esc(_ctx.userName)}
        </div>
        ${renderDiaryText(item.text)}
        <div class="siyu-whisper-meta">${fmt(item.ts)}</div>
      </div>
    `
  }

  function render() {
    container.innerHTML = ''
    const root = document.createElement('div')
    root.className = 'siyu-root'

    const myItems = items.filter(i=>i.from==='me')
    const charItems = items.filter(i=>i.from==='char')

    root.innerHTML = `
      <div class="siyu-header">
        <button class="siyu-back" id="siyu-back">‹</button>
        <div class="siyu-title-serif">悄悄话</div>
        <button class="siyu-btn siyu-btn-soft" id="siyu-add"
          style="margin-left:auto;font-size:12px;padding:7px 12px">+ 写一张</button>
      </div>
      <div class="siyu-body">
        <div class="siyu-tabs" style="margin-bottom:4px">
          <div class="siyu-tab active" id="tab-all">全部</div>
          <div class="siyu-tab" id="tab-mine">我写的</div>
          <div class="siyu-tab" id="tab-char">${esc(_ctx.activeChar?.handle||_ctx.activeChar?.name||'角色')}写的</div>
        </div>

        <div id="siyu-wall-grid" class="siyu-whisper-grid">
          ${items.length === 0
            ? `<div style="grid-column:span 2;text-align:center;padding:40px;color:${C.textSub};font-size:13px">还没有悄悄话</div>`
            : items.map(renderNoteStyle).join('')
          }
        </div>

        <div style="height:70px"></div>
      </div>

      ${renderNav('whisper')}

      <!-- 写便利贴浮层 -->
      ${showWrite ? `
        <div class="siyu-write-overlay" id="siyu-overlay">
          <div class="siyu-write-sheet">
            <div class="siyu-write-handle"></div>
            <div class="siyu-label">选便利贴样式</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${NOTE_STYLES.map(ns=>`
                <div data-nstyle="${ns.id}"
                  style="width:36px;height:36px;background:${ns.bg};border:2px solid ${writeState.styleId===ns.id?C.accentDeep:ns.border};border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px">
                  ${ns.pin}
                </div>
              `).join('')}
            </div>
            <div class="siyu-label">发送者</div>
            <div class="siyu-row">
              <button class="siyu-btn ${writeState.from==='me'?'siyu-btn-fill':''}" id="from-me">我写的</button>
              <button class="siyu-btn ${writeState.from==='char'?'siyu-btn-fill':''}" id="from-char">让角色写</button>
            </div>
            <div class="siyu-label">内容</div>
            <textarea class="siyu-textarea" id="siyu-note-text"
              placeholder="${writeState.from==='char'?'描述你想让角色写什么方向（可留空随机）…':'写下想说的话…'}"
              style="min-height:80px">${esc(writeState.text)}</textarea>
            <div style="font-size:11px;color:${C.textSub}">可以用 ~~这样~~ 来划掉字</div>
            <div class="siyu-status err" id="siyu-note-status"></div>
            <div class="siyu-row">
              <button class="siyu-btn" id="siyu-cancel">取消</button>
              <button class="siyu-btn siyu-btn-fill" id="siyu-confirm-note">贴上去</button>
            </div>
          </div>
        </div>
      ` : ''}
    `

    container.appendChild(root)

    root.querySelector('#siyu-back')?.addEventListener('click', () => roche.ui.openApp('siyu-home'))
    root.querySelector('#siyu-add')?.addEventListener('click', () => { showWrite = true; render() })
    root.querySelector('#siyu-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'siyu-overlay') { showWrite = false; render() }
    })
    root.querySelector('#siyu-cancel')?.addEventListener('click', () => { showWrite = false; render() })
    root.querySelector('#siyu-note-text')?.addEventListener('input', e => { writeState.text = e.target.value })
    root.querySelector('#from-me')?.addEventListener('click', () => { writeState.from = 'me'; render() })
    root.querySelector('#from-char')?.addEventListener('click', () => { writeState.from = 'char'; render() })

    root.querySelectorAll('[data-nstyle]').forEach(el => {
      el.addEventListener('click', () => { writeState.styleId = el.dataset.nstyle; render() })
    })

    // 选项卡（简化版：直接过滤渲染）
    root.querySelector('#tab-mine')?.addEventListener('click', () => {
      const grid = root.querySelector('#siyu-wall-grid')
      if (grid) grid.innerHTML = myItems.map(renderNoteStyle).join('') || `<div style="text-align:center;padding:30px;color:${C.textSub}">暂无</div>`
      root.querySelectorAll('.siyu-tab').forEach(t=>t.classList.remove('active'))
      root.querySelector('#tab-mine').classList.add('active')
    })
    root.querySelector('#tab-char')?.addEventListener('click', () => {
      const grid = root.querySelector('#siyu-wall-grid')
      if (grid) grid.innerHTML = charItems.map(renderNoteStyle).join('') || `<div style="text-align:center;padding:30px;color:${C.textSub}">暂无</div>`
      root.querySelectorAll('.siyu-tab').forEach(t=>t.classList.remove('active'))
      root.querySelector('#tab-char').classList.add('active')
    })
    root.querySelector('#tab-all')?.addEventListener('click', () => {
      const grid = root.querySelector('#siyu-wall-grid')
      if (grid) grid.innerHTML = items.map(renderNoteStyle).join('')
      root.querySelectorAll('.siyu-tab').forEach(t=>t.classList.remove('active'))
      root.querySelector('#tab-all').classList.add('active')
    })

    root.querySelector('#siyu-confirm-note')?.addEventListener('click', async () => {
      const text = root.querySelector('#siyu-note-text')?.value?.trim() || writeState.text.trim()
      if (writeState.from === 'me' && !text) {
        root.querySelector('#siyu-note-status').textContent = '写点什么吧'
        return
      }
      let finalText = text
      if (writeState.from === 'char') {
        const char = _ctx.activeChar
        if (char) {
          const mem = await getCharMemory(char)
          const charName = char.handle || char.name
          const persona = char.persona || char.bio || ''
          try {
            const res = await roche.ai.chat({
              messages: [{
                role: 'system',
                content: `你是${charName}。${persona}\n你对${_ctx.userName}的了解：\n${mem||'暂无'}\n\n写一张悄悄话便利贴给${_ctx.userName}。真实口语，不超过三句话，像突然想到的那种。${text?'方向参考：'+text:''}`
              }, { role: 'user', content: '写一张便利贴' }],
              temperature: 0.9
            })
            finalText = res.text?.trim() || text || '想你了'
            await saveMemory(char, `${charName}在悄悄话里写了：${finalText.slice(0,60)}`)
          } catch(_) { finalText = text || '想你了' }
        }
      }
      items.unshift({
        id: uuid(), ts: now(),
        text: finalText,
        from: writeState.from,
        style: writeState.styleId,
        effects: [],
      })
      await roche.storage.set('siyu_whisper', items).catch(()=>{})
      writeState = { text: '', styleId: 'yellow', from: 'me', effects: [] }
      showWrite = false
      render()
    })

    bindNav(root, 'whisper')
  }

  await checkCharWhisper()
  render()
}

// ================================================================
// 匿名提问箱
// ================================================================
async function mountAnon(container, roche) {
  if (!_ctx) await loadCtx(roche)
  injectStyle('siyu-css', GLOBAL_CSS())

  let data = await roche.storage.get('siyu_anon').catch(()=>null) || {
    myBox: [],   // 我的匿名箱：别人问我
    charBox: [], // 角色的匿名箱：我/路人问角色
  }
  // question: {id, ts, q, answer, answerPending, from, isChar, hint}
  // isChar=true 表示这条是角色假装路人问的（有小破绽）
  // from: 'anon' | 'char_disguise' | 'me'
  let view = 'mybox'   // 'mybox' | 'charbox' | 'askchar' | 'answer'
  let answerTargetId = ''
  let writeQ = ''
  let answerText = ''
  let showAskSheet = false

  // 检查：角色是否要偷偷投一个匿名问题进我的箱子
  async function checkCharAnonymous() {
    const char = _ctx.activeChar
    if (!char) return
    const lastTs = await roche.storage.get('siyu_anon_lastchar').catch(()=>null) || 0
    const gap = Date.now() - lastTs
    const threshold = (36 + Math.random() * 60) * 3600000  // 1.5-4天
    if (gap < threshold) return

    const mem = await getCharMemory(char)
    const charName = char.handle || char.name
    const persona = char.persona || char.bio || ''
    try {
      const res = await roche.ai.chat({
        messages: [{
          role: 'system',
          content: `你是${charName}。${persona}\n你对${_ctx.userName}的了解：\n${mem||'暂无'}\n\n你想匿名给${_ctx.userName}的提问箱投一个问题。你要假装是一个陌生人，但你可以故意留一个细微的破绽——比如用了你们之间的私人说法、或者问题角度太像你、或者用词习惯太明显。问题要有意思，不要太普通，让${_ctx.userName}能隐约猜出是你。只输出那个问题，不加说明。`
        }, { role: 'user', content: '投一个匿名问题' }],
        temperature: 0.92
      })
      const q = res.text?.trim()
      if (!q) return

      // 生成破绽提示（给char自己知道是自己）
      const hintRes = await roche.ai.chat({
        messages: [{
          role: 'system', content: `你是${charName}。你刚刚匿名投了这个问题给${_ctx.userName}：「${q}」。用一句话说说你藏在里面的那个破绽是什么，或者你真正想问的是什么。简短，不超过30字。`
        }, { role: 'user', content: '说说破绽' }],
        temperature: 0.85
      })
      const hint = hintRes.text?.trim() || ''

      data.myBox.unshift({
        id: uuid(), ts: now(),
        q, answer: '', answerPending: false,
        from: 'char_disguise',
        isCharDisguise: true,
        hint,
      })
      await roche.storage.set('siyu_anon', data).catch(()=>{})
      await roche.storage.set('siyu_anon_lastchar', Date.now()).catch(()=>{})
      await saveMemory(char, `${charName}匿名给${_ctx.userName}的提问箱投了问题：${q.slice(0,60)}`)
    } catch(_) {}
  }

  async function genAIQuestion() {
    const char = _ctx.activeChar
    if (!char) return '你最近有什么让你开心的小事吗？'
    const mem = await getCharMemory(char)
    try {
      const res = await roche.ai.chat({
        messages: [{
          role: 'system',
          content: `你是一个匿名提问者，给${_ctx.userName}的匿名提问箱发一个有意思的问题。不要太普通，要有点意思，让人想认真回答。只输出那个问题，不加说明。参考她的近况：${mem||'暂无'}`
        }, { role: 'user', content: '生成一个问题' }],
        temperature: 0.95
      })
      return res.text?.trim() || '你最近有什么让你开心的小事吗？'
    } catch(_) { return '你最近有什么让你开心的小事吗？' }
  }

  async function genCharAnswer(question) {
    const char = _ctx.activeChar
    if (!char) return ''
    const charName = char.handle || char.name
    const persona = char.persona || char.bio || ''
    const mem = await getCharMemory(char)
    try {
      const res = await roche.ai.chat({
        messages: [{
          role: 'system',
          content: `你是${charName}。${persona}\n你对${_ctx.userName}的了解：\n${mem||'暂无'}\n\n你在回答匿名提问箱里的一个问题。你不知道是谁问的（就算其实是${_ctx.userName}问的，你也要当作不知道）。用你自己的语气回答，可以有态度，可以幽默，可以真诚，但要像真实的人在回答陌生人的问题。`
        }, {
          role: 'user',
          content: `匿名提问：${question.q}`
        }],
        temperature: 0.88
      })
      const text = res.text?.trim() || ''
      await saveMemory(char, `${charName}在匿名提问箱里回答了：${question.q.slice(0,50)}`)
      return text
    } catch(_) { return '' }
  }

  // 角色看到我回答后的内心想法
  async function genCharThought(question) {
    const char = _ctx.activeChar
    if (!char || !question.answer) return ''
    const charName = char.handle || char.name
    const persona = char.persona || char.bio || ''
    const mem = await getCharMemory(char)
    try {
      const res = await roche.ai.chat({
        messages: [{
          role: 'system',
          content: `你是${charName}。${persona}\n${_ctx.userName}在她的匿名提问箱里回答了一个问题（那个匿名问题其实是你投的，但她不一定知道）。读完她的回答，说说你内心真实的想法，可以阴暗、疯狂、心疼、满足、醋意——任何真实的情绪都行，不超过100字，不加解释。`
        }, {
          role: 'user',
          content: `问题：${question.q}\n${_ctx.userName}的回答：${question.answer}`
        }],
        temperature: 0.95
      })
      return res.text?.trim() || ''
    } catch(_) { return '' }
  }

  function render() {
    container.innerHTML = ''
    const root = document.createElement('div')
    root.className = 'siyu-root'
    const charName = _ctx.activeChar?.handle || _ctx.activeChar?.name || '角色'

    root.innerHTML = `
      <div class="siyu-header">
        <button class="siyu-back" id="siyu-back">‹</button>
        <div class="siyu-title-serif">匿名提问箱</div>
      </div>
      <div class="siyu-body">
        <div class="siyu-tabs">
          <div class="siyu-tab ${view==='mybox'?'active':''}" id="tab-mybox">我的提问箱</div>
          <div class="siyu-tab ${view==='charbox'?'active':''}" id="tab-charbox">${esc(charName)} 的提问箱</div>
        </div>

        ${view === 'mybox' ? renderMyBox() : renderCharBox()}

        <div style="height:70px"></div>
      </div>

      ${renderNav('anon')}

      <!-- 提问浮层 -->
      ${showAskSheet ? renderAskSheet() : ''}
    `

    container.appendChild(root)
    bindAnonEvents(root, charName)
    bindNav(root, 'anon')
  }

  function renderMyBox() {
    const box = data.myBox
    return `
      <div class="siyu-row" style="margin-bottom:4px">
        <button class="siyu-btn siyu-btn-soft" id="siyu-refresh-q" style="font-size:12px">🔄 AI 出题</button>
        <button class="siyu-btn" id="siyu-write-q" style="font-size:12px">✏ 自己写</button>
      </div>
      ${box.length === 0
        ? `<div style="text-align:center;padding:40px;color:${C.textSub};font-size:13px">还没有提问</div>`
        : box.map(q => `
          <div class="siyu-anon-card" data-qid="${esc(q.id)}">
            <div class="siyu-anon-meta">${fmt(q.ts)} · 匿名</div>
            <div class="siyu-anon-q">${esc(q.q)}</div>
            ${q.isCharDisguise && q.hint ? `
              <div class="siyu-anon-hint">💡 ${esc(q.hint)}</div>
            ` : ''}
            ${q.answer
              ? `<div class="siyu-anon-answer">${esc(q.answer)}</div>
                 ${q.charThought ? `<div class="siyu-anon-char-reply">[ ${esc(_ctx.activeChar?.handle||'角色')} 的内心 ] ${esc(q.charThought)}</div>` : ''}
                `
              : `<button class="siyu-btn siyu-btn-soft" data-answer="${esc(q.id)}" style="font-size:12px;padding:7px 12px">回答这个问题</button>`
            }
          </div>
        `).join('')
      }
    `
  }

  function renderCharBox() {
    const box = data.charBox
    const charName = _ctx.activeChar?.handle || _ctx.activeChar?.name || '角色'
    return `
      <div class="siyu-row" style="margin-bottom:4px">
        <button class="siyu-btn siyu-btn-soft" id="siyu-ask-char-ai" style="font-size:12px">🔄 AI 帮我问</button>
        <button class="siyu-btn" id="siyu-ask-char-write" style="font-size:12px">✏ 我来问</button>
      </div>
      ${box.length === 0
        ? `<div style="text-align:center;padding:40px;color:${C.textSub};font-size:13px">还没有提问</div>`
        : box.map(q => `
          <div class="siyu-anon-card">
            <div class="siyu-anon-meta">${fmt(q.ts)} · 匿名</div>
            <div class="siyu-anon-q">${esc(q.q)}</div>
            ${q.answer
              ? `<div class="siyu-anon-answer">${esc(charName)} 的回答：${esc(q.answer)}</div>`
              : q.answerPending
                ? `<div style="font-size:12px;color:${C.textSub};font-style:italic">${esc(charName)} 还没看到…</div>`
                : `<button class="siyu-btn siyu-btn-soft" data-charanswer="${esc(q.id)}" style="font-size:12px;padding:7px 12px">看 ${esc(charName)} 的回答</button>`
            }
          </div>
        `).join('')
      }
    `
  }

  function renderAskSheet() {
    const isMyBox = view === 'mybox'
    return `
      <div class="siyu-write-overlay" id="siyu-overlay">
        <div class="siyu-write-sheet">
          <div class="siyu-write-handle"></div>
          <div class="siyu-label">${isMyBox ? '给我的匿名箱' : '匿名问角色'}</div>
          <textarea class="siyu-textarea" id="siyu-q-text"
            style="min-height:80px" placeholder="写下问题…">${esc(writeQ)}</textarea>
          <div class="siyu-status err" id="siyu-ask-status"></div>
          <div class="siyu-row">
            <button class="siyu-btn" id="siyu-ask-cancel">取消</button>
            <button class="siyu-btn siyu-btn-fill" id="siyu-ask-confirm">投进去</button>
          </div>
        </div>
      </div>
    `
  }

  function bindAnonEvents(root, charName) {
    root.querySelector('#siyu-back')?.addEventListener('click', () => roche.ui.openApp('siyu-home'))
    root.querySelector('#tab-mybox')?.addEventListener('click', () => { view='mybox'; render() })
    root.querySelector('#tab-charbox')?.addEventListener('click', () => { view='charbox'; render() })

    // 我的箱子：AI生成问题
    root.querySelector('#siyu-refresh-q')?.addEventListener('click', async () => {
      roche.ui.toast('AI 正在想问题…')
      const q = await genAIQuestion()
      data.myBox.unshift({
        id: uuid(), ts: now(),
        q, answer: '', answerPending: false,
        from: 'anon', isCharDisguise: false, hint: '',
      })
      await roche.storage.set('siyu_anon', data).catch(()=>{})
      render()
    })

    // 我的箱子：自己写
    root.querySelector('#siyu-write-q')?.addEventListener('click', () => {
      writeQ = ''; showAskSheet = true; render()
    })

    // 回答按钮
    root.querySelectorAll('[data-answer]').forEach(btn => {
      btn.addEventListener('click', () => {
        answerTargetId = btn.dataset.answer
        answerText = ''
        // 打开答题浮层（复用write sheet逻辑）
        showAnswerSheet(root)
      })
    })

    // 角色提问箱
    root.querySelector('#siyu-ask-char-ai')?.addEventListener('click', async () => {
      roche.ui.toast('AI 生成中…')
      const char = _ctx.activeChar
      if (!char) return
      const mem = await getCharMemory(char)
      const cn = char.handle || char.name
      const res = await roche.ai.chat({
        messages: [{
          role: 'system',
          content: `帮${_ctx.userName}想一个匿名问题投给${cn}。可以是好奇的、撒娇的、有点挑衅的，不要太普通。只输出问题，不加说明。参考${cn}的近况：${mem||'暂无'}`
        }, { role: 'user', content: '生成' }],
        temperature: 0.92
      }).catch(()=>null)
      const q = res?.text?.trim() || '你有没有什么只想告诉我一个人的事？'
      data.charBox.unshift({
        id: uuid(), ts: now(),
        q, answer: '', answerPending: true, from: 'me'
      })
      await roche.storage.set('siyu_anon', data).catch(()=>{})
      render()
    })
    root.querySelector('#siyu-ask-char-write')?.addEventListener('click', () => {
      writeQ = ''; showAskSheet = true; render()
    })

    // 看角色回答
    root.querySelectorAll('[data-charanswer]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.charanswer
        const q = data.charBox.find(q=>q.id===id)
        if (!q) return
        roche.ui.toast('角色正在回答…')
        q.answer = await genCharAnswer(q)
        q.answerPending = false
        await roche.storage.set('siyu_anon', data).catch(()=>{})
        render()
      })
    })

    // 浮层
    root.querySelector('#siyu-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'siyu-overlay') { showAskSheet = false; render() }
    })
    root.querySelector('#siyu-ask-cancel')?.addEventListener('click', () => { showAskSheet = false; render() })
    root.querySelector('#siyu-q-text')?.addEventListener('input', e => { writeQ = e.target.value })
    root.querySelector('#siyu-ask-confirm')?.addEventListener('click', async () => {
      const text = root.querySelector('#siyu-q-text')?.value?.trim()
      if (!text) { root.querySelector('#siyu-ask-status').textContent = '请写下问题'; return }
      if (view === 'mybox') {
        data.myBox.unshift({
          id: uuid(), ts: now(),
          q: text, answer: '', answerPending: false,
          from: 'anon', isCharDisguise: false, hint: '',
        })
      } else {
        data.charBox.unshift({
          id: uuid(), ts: now(),
          q: text, answer: '', answerPending: true, from: 'me'
        })
      }
      await roche.storage.set('siyu_anon', data).catch(()=>{})
      showAskSheet = false; writeQ = ''; render()
    })
  }

  function showAnswerSheet(root) {
    // 动态注入答题浮层
    const overlay = document.createElement('div')
    overlay.className = 'siyu-write-overlay'
    overlay.id = 'siyu-answer-overlay'
    overlay.innerHTML = `
      <div class="siyu-write-sheet">
        <div class="siyu-write-handle"></div>
        <div class="siyu-label">回答匿名问题</div>
        <textarea class="siyu-textarea" id="siyu-ans-text" style="min-height:80px" placeholder="写下你的回答…"></textarea>
        <div class="siyu-row">
          <button class="siyu-btn" id="siyu-ans-cancel">取消</button>
          <button class="siyu-btn siyu-btn-fill" id="siyu-ans-confirm">提交回答</button>
        </div>
      </div>
    `
    root.appendChild(overlay)
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })
    overlay.querySelector('#siyu-ans-cancel').addEventListener('click', () => overlay.remove())
    overlay.querySelector('#siyu-ans-confirm').addEventListener('click', async () => {
      const text = overlay.querySelector('#siyu-ans-text').value.trim()
      if (!text) return
      const q = data.myBox.find(q=>q.id===answerTargetId)
      if (!q) return
      q.answer = text
      // 如果是角色伪装的问题，生成角色内心想法
      if (q.isCharDisguise) {
        q.charThought = await genCharThought(q)
        await saveMemory(_ctx.activeChar,
          `${_ctx.userName}回答了匿名提问「${q.q.slice(0,50)}」，回答是：${text.slice(0,80)}`)
      }
      await roche.storage.set('siyu_anon', data).catch(()=>{})
      overlay.remove(); render()
    })
  }

  await checkCharAnonymous()
  render()
}

// ── 底部导航渲染 ─────────────────────────────────────────────────
function renderNav(active) {
  return `
    <div class="siyu-nav">
      <button class="siyu-nav-item ${active==='home'?'active':''}" id="nav-home">
        <span class="siyu-nav-icon">ʕ•ᴥ•ʔ</span>
        <span class="siyu-nav-label">主页</span>
      </button>
      <button class="siyu-nav-item ${active==='diary'?'active':''}" id="nav-diary">
        <span class="siyu-nav-icon">📓</span>
        <span class="siyu-nav-label">日记</span>
      </button>
      <button class="siyu-nav-item ${active==='whisper'?'active':''}" id="nav-whisper">
        <span class="siyu-nav-icon">(´｡• ᵕ •｡\`)</span>
        <span class="siyu-nav-label">悄悄话</span>
      </button>
      <button class="siyu-nav-item ${active==='anon'?'active':''}" id="nav-anon">
        <span class="siyu-nav-icon">(°▽°)</span>
        <span class="siyu-nav-label">提问箱</span>
      </button>
    </div>
  `
}

function bindNav(root, active) {
  root.querySelector('#nav-home')?.addEventListener('click', () => {
    if (active !== 'home') _roche?.ui.openApp('siyu-home')
  })
  root.querySelector('#nav-diary')?.addEventListener('click', () => {
    if (active !== 'diary') _roche?.ui.openApp('siyu-diary')
  })
  root.querySelector('#nav-whisper')?.addEventListener('click', () => {
    if (active !== 'whisper') _roche?.ui.openApp('siyu-whisper')
  })
  root.querySelector('#nav-anon')?.addEventListener('click', () => {
    if (active !== 'anon') _roche?.ui.openApp('siyu-anon')
  })
}

// ================================================================
// 注册插件
// ================================================================
window.RochePlugin.register({
  id: 'siyu-plugin',
  name: '私语空间',
  version: '1.0.0',
  apps: [
    {
      id: 'siyu-home',
      name: '私语空间',
      icon: 'favorite',
      async mount(container, roche) { await mountHome(container, roche) },
      async unmount(container) { container.replaceChildren(); removeStyle('siyu-css') }
    },
    {
      id: 'siyu-diary',
      name: '交换日记',
      icon: 'menu_book',
      async mount(container, roche) { _roche=roche; await mountDiary(container, roche) },
      async unmount(container) { container.replaceChildren(); removeStyle('siyu-css') }
    },
    {
      id: 'siyu-whisper',
      name: '悄悄话',
      icon: 'sticky_note_2',
      async mount(container, roche) { _roche=roche; await mountWhisper(container, roche) },
      async unmount(container) { container.replaceChildren(); removeStyle('siyu-css') }
    },
    {
      id: 'siyu-anon',
      name: '匿名提问箱',
      icon: 'question_answer',
      async mount(container, roche) { _roche=roche; await mountAnon(container, roche) },
      async unmount(container) { container.replaceChildren(); removeStyle('siyu-css') }
    },
  ]
})

})()
