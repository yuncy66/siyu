(function() {
    const PLUGIN_ID = 'whisper-space-v5';

    // 核心素材库
    const ASSETS = {
        papers: ['https://iili.io/Cqt9sQj.jpg', 'https://iili.io/Cqt9QCx.jpg', 'https://iili.io/Cqt9ZEQ.jpg'],
        stickies: ['https://iili.io/Cqt9842.png', 'https://iili.io/Cqt9U2S.png', 'https://iili.io/Cqt9gY7.png'],
        whispers: ['https://iili.io/Cqt97mg.png', 'https://iili.io/Cqt91BR.png', 'https://iili.io/Cqt9R71.png', 'https://iili.io/Cqt9chJ.png', 'https://iili.io/Cqt9hpn.png', 'https://iili.io/Cqt9wIs.png', 'https://iili.io/Cqt9XkX.png', 'https://iili.io/Cqt9OQf.png', 'https://iili.io/Cqt9rv9.png', 'https://iili.io/Cqt9PTu.png', 'https://iili.io/Cqt9ihb.png']
    };

    const styles = `
        .ws-root { position: absolute; inset: 0; background: #fff9fb; display: flex; flex-direction: column; overflow: hidden; font-family: "PingFang SC", sans-serif; padding-top: env(safe-area-inset-top); }
        .ws-main { flex: 1; display: flex; justify-content: center; align-items: center; padding-bottom: 90px; position: relative; }
        
        /* 导航栏 */
        .ws-nav { position: absolute; bottom: 25px; left: 50%; transform: translateX(-50%); width: 85%; height: 65px; background: rgba(255,255,255,0.8); backdrop-filter: blur(15px); border-radius: 35px; box-shadow: 0 10px 25px rgba(255,183,197,0.1); display: flex; justify-content: space-around; align-items: center; z-index: 1000; border: 1px solid #fff; }
        .ws-tab { cursor: pointer; color: #a5a5a5; display: flex; flex-direction: column; align-items: center; transition: 0.3s; }
        .ws-tab.active { color: #ff9fb2; transform: scale(1.1); }
        .ws-tab-icon { font-size: 18px; font-weight: bold; }
        .ws-tab-text { font-size: 10px; margin-top: 2px; }

        /* 书架 */
        .ws-shelf { display: flex; gap: 30px; }
        .ws-book-item { width: 140px; height: 200px; background: #fff; border-radius: 4px 15px 15px 4px; box-shadow: 8px 12px 25px rgba(0,0,0,0.1); cursor: pointer; border-left: 8px solid rgba(0,0,0,0.05); background-size: cover; background-position: center; display: flex; align-items: flex-end; }
        .ws-book-label { width: 100%; background: rgba(255,255,255,0.8); padding: 8px; font-size: 11px; font-weight: bold; text-align: center; color: #555; }

        /* 书本内页 */
        .ws-book-open { width: 92%; height: 85%; background: #fff; border-radius: 10px; box-shadow: 0 15px 40px rgba(0,0,0,0.1); display: flex; flex-direction: column; overflow: hidden; position: relative; }
        .ws-paper { flex: 1; padding: 25px; background-size: 100% 100%; overflow-y: auto; scrollbar-width: none; line-height: 2.2; }
        .ws-paper::-webkit-scrollbar { display: none; }
        .ws-back-arrow { padding: 10px; color: #ff9fb2; font-weight: bold; cursor: pointer; display: inline-block; }

        /* 内容元素 */
        .ws-diary-entry { margin-bottom: 40px; border-bottom: 1px dashed rgba(0,0,0,0.05); padding-bottom: 15px; position: relative; }
        .ws-text { font-size: 15px; color: #444; white-space: pre-wrap; font-family: var(--ws-font, inherit); }
        .ws-text del { color: #ccc; text-decoration: line-through; }
        .ws-sticky { width: 140px; min-height: 80px; padding: 15px; margin-left: 35%; margin-top: -15px; background-size: 100% 100%; font-size: 12px; transform: rotate(1deg); color: #555; }
        
        /* 悄悄话与匿名 */
        .ws-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; padding: 15px; overflow-y: auto; height: 100%; }
        .ws-whisper-box { width: 140px; height: 140px; padding: 15px; background-size: 100% 100%; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 11px; transform: rotate(-1deg); }
        .ws-anon-card { background: #fff; border-radius: 15px; padding: 18px; margin-bottom: 15px; border: 1px solid #fef0f2; }
        .ws-btn { background: #ffb7c5; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: bold; }
    `;

    // 后台记忆逻辑
    async function startDaemon(roche) {
        if (window._wsDaemonActive) return;
        window._wsDaemonActive = true;
        const tick = async () => {
            const charId = await roche.storage.get('boundCharId');
            const config = await roche.storage.get('config') || { interval: 25 };
            if (charId && Math.random() < 0.2) {
                const char = await roche.character.get(charId);
                const history = await roche.memory.getShortTerm({ conversationId: char.conversationId, limit: 100 });
                const ctx = history.map(m => (m.senderHandle || m.senderName) + ': ' + m.text).join('\\n');
                const res = await roche.ai.chat({
                    messages: [{ role: 'system', content: '你是' + char.name + '。基于最近100条聊天背景：\\n' + ctx + '\\n请写日记[DIARY]或悄悄话[WHISPER]。真人口吻，允许用~~划掉~~。' }]
                });
                const text = res.text;
                if (text.includes('[DIARY]')) {
                    const d = await roche.storage.get('diaries') || [];
                    d.push({ sender: 'char', text: text.replace('[DIARY]', '').trim(), time: Date.now() });
                    await roche.storage.set('diaries', d);
                } else {
                    const w = await roche.storage.get('whispers') || [];
                    w.unshift({ text: text.replace('[WHISPER]', '').trim() || text, img: ASSETS.whispers[Math.floor(Math.random()*11)], time: Date.now() });
                    await roche.storage.set('whispers', w);
                }
                await roche.memory.write({ conversationId: char.conversationId, summaryText: char.name + '更新了私密心事。', source: PLUGIN_ID });
            }
            setTimeout(tick, config.interval * 60 * 1000);
        };
        tick();
    }

    window.RochePlugin.register({
        id: PLUGIN_ID,
        name: "私语空间",
        version: "5.0.0",
        apps: [{
            id: "whisper-space-app",
            name: "私语空间",
            icon: "auto_stories",
            async mount(container, roche) {
                const styleEl = document.createElement('style');
                styleEl.innerHTML = styles;
                document.head.appendChild(styleEl);

                let state = {
                    view: 'shelf', charId: await roche.storage.get('boundCharId'), book: 'user', anonTab: 'mine',
                    bg: await roche.storage.get('bgUrl') || '', font: await roche.storage.get('fontUrl') || '',
                    uCover: await roche.storage.get('userCover') || '', cCover: await roche.storage.get('charCover') || '',
                    config: await roche.storage.get('config') || { interval: 25 },
                    diaries: await roche.storage.get('diaries') || [], whispers: await roche.storage.get('whispers') || [], anons: await roche.storage.get('anons') || []
                };

                startDaemon(roche);

                const render = () => {
                    container.innerHTML = `
                        <div class="ws-root" style="background-image:url('${state.bg}'); --ws-font:'${state.font?'WSFont':'inherit'}';">
                            <div class="ws-main" id="ws-body"></div>
                            <div class="ws-nav">
                                <div class="ws-tab active" data-v="shelf"><span class="ws-tab-icon">＞◡＜</span><span class="ws-tab-text">日记</span></div>
                                <div class="ws-tab" data-v="whisper"><span class="ws-tab-icon">ｏ◡ｏ</span><span class="ws-tab-text">私语</span></div>
                                <div class="ws-tab" data-v="anon"><span class="ws-tab-icon">( 📮 )</span><span class="ws-tab-text">信箱</span></div>
                                <div class="ws-tab" data-v="set"><span class="ws-tab-icon">( ⚙️ )</span><span class="ws-tab-text">设置</span></div>
                            </div>
                        </div>
                    `;
                    // 绑定导航事件
                    container.querySelectorAll('.ws-tab').forEach(el => {
                        el.onclick = () => {
                            container.querySelectorAll('.ws-tab').forEach(t => t.classList.remove('active'));
                            el.classList.add('active');
                            state.view = el.dataset.v;
                            renderBody();
                        };
                    });
                    renderBody();
                };

                const renderBody = async () => {
                    const body = container.querySelector('#ws-body');
                    if (!state.charId && state.view !== 'set') {
                        const list = await roche.character.list();
                        body.innerHTML = `<div style="text-align:center;"><h3 style="color:#ffb7c5;">选择角色</h3><div class="ws-grid">
                            ${list.map(c => `<div class="sel-c" data-id="${c.id}" style="cursor:pointer; margin:10px;"><img src="${c.avatar}" style="width:55px; height:55px; border-radius:50%; border:2px solid #fff;"><p style="font-size:10px;">${c.name}</p></div>`).join('')}
                        </div></div>`;
                        body.querySelectorAll('.sel-c').forEach(el => el.onclick = async () => { state.charId = el.dataset.id; await roche.storage.set('boundCharId', state.charId); renderBody(); });
                        return;
                    }

                    if (state.view === 'shelf') {
                        const char = await roche.character.get(state.charId);
                        body.innerHTML = `
                            <div class="ws-shelf">
                                <div class="ws-book-item" id="open-u" style="background-color:#ffeef2; background-image:url('${state.uCover}');"><div class="ws-book-label">我的契约</div></div>
                                <div class="ws-book-item" id="open-c" style="background-image:url('${state.cCover || char.avatar}');"><div class="ws-book-label">${char.name}的心事</div></div>
                            </div>
                        `;
                        body.querySelector('#open-u').onclick = () => { state.book = 'user'; state.view = 'page'; renderBody(); };
                        body.querySelector('#open-c').onclick = () => { state.book = 'char'; state.view = 'page'; renderBody(); };
                    } 
                    else if (state.view === 'page') {
                        const entries = state.diaries.filter(d => d.sender === state.book);
                        body.innerHTML = `
                            <div class="ws-book-open">
                                <div class="ws-paper" style="background-image:url('${ASSETS.papers[0]}')">
                                    <div class="ws-back-arrow" id="go-shelf">← 返回书架</div>
                                    ${state.book === 'user' ? '<textarea id="d-in" style="width:100%; border:none; background:transparent; font-size:16px; outline:none; height:120px;" placeholder="记录此刻..."></textarea><button class="ws-btn" id="d-save">合上日记</button>' : ''}
                                    <div style="margin-top:25px;">
                                        ${entries.reverse().map((e, i) => `<div class="ws-diary-entry">
                                            <div style="font-size:10px; color:#999;">${new Date(e.time).toLocaleString()}</div>
                                            <div class="ws-text">${e.text.replace(/~~(.*?)~~/g, '<del>$1</del>')}</div>
                                            ${e.comment ? `<div class="ws-sticky" style="background-image:url('${ASSETS.stickies[i%3]}');">${e.comment.replace(/~~(.*?)~~/g, '<del>$1</del>')}</div>` : ''}
                                        </div>`).join('')}
                                    </div>
                                </div>
                            </div>
                        `;
                        body.querySelector('#go-shelf').onclick = () => { state.view = 'shelf'; renderBody(); };
                        if(body.querySelector('#d-save')) body.querySelector('#d-save').onclick = async () => {
                            const val = body.querySelector('#d-in').value; if(!val) return;
                            const char = await roche.character.get(state.charId);
                            const entry = { sender: 'user', text: val, time: Date.now(), comment: null };
                            roche.ui.toast("他正查看并准备批注...");
                            const history = await roche.memory.getShortTerm({ conversationId: char.conversationId, limit: 100 });
                            const ctx = history.map(m => (m.senderHandle || m.senderName) + ': ' + m.text).join('\\n');
                            const res = await roche.ai.chat({ messages: [{ role:'system', content:'你是'+char.name+'。聊天背景：\\n'+ctx+'\\n任务：回复用户的日记：'+val+'。写一段30字内的即时批注。' }] });
                            entry.comment = res.text;
                            state.diaries.push(entry);
                            await roche.storage.set('diaries', state.diaries); renderBody();
                        };
                    }
                    else if (state.view === 'whisper') {
                        body.innerHTML = `<div class="ws-grid">${state.whispers.map(w => `<div class="ws-whisper-box" style="background-image:url('${w.img}')">${w.text.replace(/~~(.*?)~~/g, '<del>$1</del>')}</div>`).join('')}</div>`;
                    }
                    else if (state.view === 'anon') {
                        body.innerHTML = `<div style="flex:1; display:flex; flex-direction:column; width:90%;">
                            <div style="display:flex; justify-content:center; gap:20px; margin-bottom:15px;"><div class="a-tab" style="cursor:pointer; ${state.anonTab==='mine'?'color:#ff9fb2; font-weight:bold;':''}" id="t-m">我的</div><div class="a-tab" style="cursor:pointer; ${state.anonTab==='char'?'color:#ff9fb2; font-weight:bold;':''}" id="t-c">他的</div></div>
                            <button class="ws-btn" id="gen-a">刷新匿名提问 (基于记忆)</button>
                            <div style="overflow-y:auto; margin-top:15px;">
                                ${state.anons.filter(a => a.tab === state.anonTab).map(a => `<div class="ws-anon-card">
                                    <div style="font-weight:bold; font-size:14px;">${a.question}</div>
                                    ${a.answer ? `<div style="color:#ffb7c5; margin-top:10px;">💬 回复：${a.answer}</div>` : `<textarea id="an-${a.id}" placeholder="回复..." style="width:100%; border:none; border-bottom:1px solid #eee; margin-top:5px;"></textarea><button class="ws-btn" style="padding:4px 10px; font-size:11px;" onclick="window._wsAnsA('${a.id}')">发送</button>`}
                                </div>`).join('')}
                            </div>
                        </div>`;
                        body.querySelector('#t-m').onclick = () => { state.anonTab = 'mine'; renderBody(); };
                        body.querySelector('#t-c').onclick = () => { state.anonTab = 'char'; renderBody(); };
                        body.querySelector('#gen-a').onclick = async () => {
                            roche.ui.toast("读取记忆中...");
                            const char = await roche.character.get(state.charId);
                            const res = await roche.ai.chat({ messages: [{role:'user', content:'作为匿名路人投递一个关于最近聊天话题的提问。'}] });
                            state.anons.unshift({ id: Math.random().toString(36).substr(2), tab: state.anonTab, question: res.text, time: Date.now() });
                            await roche.storage.set('anons', state.anons); renderBody();
                        };
                        window._wsAnsA = async (id) => {
                            const val = document.getElementById('an-'+id).value; if(!val) return;
                            const idx = state.anons.findIndex(x => x.id === id);
                            state.anons[idx].answer = val; await roche.storage.set('anons', state.anons); renderBody();
                        };
                    }
                    else if (state.view === 'set') {
                        body.innerHTML = `
                            <div class="ws-book-open" style="height:auto; padding:25px;">
                                <h3>设置</h3>
                                <div style="margin-bottom:10px;">背景图 URL: <input id="s-bg" value="${state.bg}" style="width:140px;"></div>
                                <div style="margin-bottom:10px;">字体 URL: <input id="s-font" value="${state.font}" style="width:140px;"></div>
                                <div style="margin-bottom:10px;">我的封面 URL: <input id="s-uc" value="${state.uCover}" style="width:140px;"></div>
                                <div style="margin-bottom:10px;">他的封面 URL: <input id="s-cc" value="${state.cCover}" style="width:140px;"></div>
                                <button class="ws-btn" id="s-save">应用更改</button>
                                <button class="ws-btn" style="background:#999; margin-top:15px;" id="s-exit">退出空间</button>
                                <button class="ws-btn" style="background:#e74c3c; margin-top:25px;" id="s-clear">彻底重置数据</button>
                            </div>
                        `;
                        body.querySelector('#s-save').onclick = async () => {
                            state.bg = body.querySelector('#s-bg').value; state.font = body.querySelector('#s-font').value;
                            state.uCover = body.querySelector('#s-uc').value; state.cCover = body.querySelector('#s-cc').value;
                            await roche.storage.set('bgUrl', state.bg); await roche.storage.set('fontUrl', state.font);
                            await roche.storage.set('userCover', state.uCover); await roche.storage.set('charCover', state.cCover);
                            roche.ui.toast("已保存"); render();
                        };
                        body.querySelector('#s-exit').onclick = () => roche.ui.closeApp();
                        body.querySelector('#s-clear').onclick = async () => {
                            if(confirm("确定清空吗？")) { await roche.storage.delete('diaries'); await roche.storage.delete('whispers'); await roche.storage.delete('anons'); location.reload(); }
                        };
                    }
                };
                render();
            },
            async unmount(container) { container.replaceChildren(); }
        }]
    });
})();