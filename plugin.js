(function() {
    const PLUGIN_ID = 'whisper-space-v4-fixed';

    const ASSETS = {
        papers: ['https://iili.io/Cqt9sQj.jpg', 'https://iili.io/Cqt9QCx.jpg', 'https://iili.io/Cqt9ZEQ.jpg'],
        stickies: ['https://iili.io/Cqt9842.png', 'https://iili.io/Cqt9U2S.png', 'https://iili.io/Cqt9gY7.png'],
        whispers: [
            'https://iili.io/Cqt97mg.png', 'https://iili.io/Cqt91BR.png', 'https://iili.io/Cqt9R71.png',
            'https://iili.io/Cqt9chJ.png', 'https://iili.io/Cqt9hpn.png', 'https://iili.io/Cqt9wIs.png',
            'https://iili.io/Cqt9XkX.png', 'https://iili.io/Cqt9OQf.png', 'https://iili.io/Cqt9rv9.png',
            'https://iili.io/Cqt9PTu.png', 'https://iili.io/Cqt9ihb.png'
        ]
    };

    const styles = `
        .ws-root { position: absolute; inset: 0; background: #fef9f9; display: flex; flex-direction: column; align-items: center; overflow: hidden; font-family: 'PingFang SC', sans-serif; padding-top: 50px; }
        .ws-nav { position: absolute; bottom: 30px; width: 85%; height: 60px; background: rgba(255,255,255,0.8); backdrop-filter: blur(10px); border-radius: 30px; display: flex; justify-content: space-around; align-items: center; box-shadow: 0 10px 20px rgba(255, 183, 197, 0.15); z-index: 1000; border: 1px solid #fff; }
        .ws-nav-item { cursor: pointer; transition: 0.3s; color: #a5a5a5; display: flex; flex-direction: column; align-items: center; }
        .ws-nav-item.active { color: #ff9fb2; transform: scale(1.1); }
        .ws-nav-icon { font-size: 18px; font-weight: bold; }
        .ws-nav-text { font-size: 10px; margin-top: 2px; }

        .ws-view-box { width: 92%; height: 75%; position: relative; display: flex; flex-direction: column; }
        .ws-paper { flex: 1; background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); overflow-y: auto; padding: 25px; scrollbar-width: none; }
        .ws-paper::-webkit-scrollbar { display: none; }
        
        .ws-entry { margin-bottom: 30px; border-bottom: 1px dashed rgba(0,0,0,0.05); padding-bottom: 15px; }
        .ws-text { font-family: var(--ws-font, inherit); color: #444; font-size: 15px; line-height: 1.8; white-space: pre-wrap; }
        .ws-text del { color: #ccc; text-decoration: line-through; opacity: 0.8; }

        .ws-annotation-note { width: 140px; min-height: 80px; padding: 15px; margin-top: -10px; margin-left: 35%; background-size: 100% 100%; font-family: var(--ws-font, inherit); font-size: 12px; color: #555; }

        .ws-wall-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; padding: 10px; overflow-y: auto; height: 100%; }
        .ws-whisper-box { width: 140px; height: 140px; padding: 20px; background-size: 100% 100%; display: flex; align-items: center; justify-content: center; text-align: center; font-family: var(--ws-font, inherit); font-size: 11px; color: #444; }

        .ws-anon-header { display: flex; justify-content: center; gap: 30px; margin-bottom: 15px; }
        .ws-anon-tab { font-size: 14px; color: #999; cursor: pointer; padding-bottom: 4px; }
        .ws-anon-tab.active { color: #ff9fb2; border-bottom: 2px solid #ff9fb2; font-weight: bold; }
        .ws-anon-item { background: #fff; border-radius: 15px; padding: 15px; margin-bottom: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }

        .ws-btn-soft { background: #ffb7c5; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: bold; cursor: pointer; }
        .ws-back-arrow { position: absolute; top: -40px; left: 0; cursor: pointer; color: #ff9fb2; font-size: 14px; font-weight: bold; }
    `;

    async function fetchAI(roche, char, task) {
        const history = await roche.memory.getShortTerm({ conversationId: char.conversationId, limit: 100 });
        const context = history.map(m => `${m.senderHandle || m.senderName}: ${m.text}`).join('\n');
        const res = await roche.ai.chat({
            messages: [{ role: 'system', content: `你是${char.name}。聊天背景：\n${context}\n设定：${char.persona}\n任务：${task}\n要求：第一人称，真实感，允许使用~~划掉内容~~。` }]
        });
        return res.text;
    }

    async function startDaemon(roche) {
        if (window._wsDaemonOn) return;
        window._wsDaemonOn = true;
        const loop = async () => {
            const cid = await roche.storage.get('boundId');
            if (cid && Math.random() < 0.15) {
                const char = await roche.character.get(cid);
                const res = await fetchAI(roche, char, "随机写日记[DIARY]或悄悄话[WHISPER]。");
                if (res.includes('[DIARY]')) {
                    const d = await roche.storage.get('diaries') || [];
                    d.push({ sender: 'char', text: res.replace('[DIARY]', '').trim(), time: Date.now() });
                    await roche.storage.set('diaries', d);
                } else {
                    const w = await roche.storage.get('whispers') || [];
                    w.unshift({ text: res.replace('[WHISPER]', '').trim() || res, img: ASSETS.whispers[Math.floor(Math.random()*11)], time: Date.now() });
                    await roche.storage.set('whispers', w);
                }
                await roche.memory.write({ conversationId: char.conversationId, summaryText: `${char.name}在私语空间留下了新内容。`, source: PLUGIN_ID });
            }
            setTimeout(loop, 1000 * 60 * 25);
        };
        loop();
    }

    window.RochePlugin.register({
        id: PLUGIN_ID,
        name: "私语空间",
        version: "4.2.1",
        apps: [{
            id: "whisper-space-main",
            name: "私语空间",
            icon: "auto_stories",
            async mount(container, roche) {
                const styleEl = document.createElement('style');
                styleEl.innerHTML = styles;
                document.head.appendChild(styleEl);

                let state = {
                    view: 'shelf', charId: await roche.storage.get('boundId'), book: 'user', tab: 'mine',
                    bg: await roche.storage.get('bgUrl') || '', font: await roche.storage.get('fontUrl') || '',
                    diaries: await roche.storage.get('diaries') || [], whispers: await roche.storage.get('whispers') || [], anons: await roche.storage.get('anons') || []
                };

                startDaemon(roche);

                const render = () => {
                    container.innerHTML = `
                        <div class="ws-root" style="background-image:url('${state.bg}'); --ws-font:'${state.font?'WSFont':'inherit'}';">
                            <div class="ws-view-box">
                                <div class="ws-back-arrow" id="ws-back">🔙 返回主屏</div>
                                <div id="ws-inner" style="flex:1; display:flex; flex-direction:column;"></div>
                            </div>
                            <div class="ws-nav">
                                <div class="ws-nav-item ${state.view==='shelf'||state.view==='diary'?'active':''}" id="nav-d"><span class="ws-nav-icon">＞◡＜</span><span class="ws-nav-text">日记</span></div>
                                <div class="ws-nav-item ${state.view==='whisper'?'active':''}" id="nav-w"><span class="ws-nav-icon">ｏ◡ｏ</span><span class="ws-nav-text">私语</span></div>
                                <div class="ws-nav-item ${state.view==='anon'?'active':''}" id="nav-a"><span class="ws-nav-icon">( 📮 )</span><span class="ws-nav-text">信箱</span></div>
                                <div class="ws-nav-item ${state.view==='set'?'active':''}" id="nav-s"><span class="ws-nav-icon">( ⚙️ )</span><span class="ws-nav-text">设置</span></div>
                            </div>
                        </div>
                    `;
                    container.querySelector('#ws-back').onclick = () => { if(state.view==='diary') {state.view='shelf'; render();} else roche.ui.closeApp(); };
                    container.querySelector('#nav-d').onclick = () => { state.view='shelf'; render(); };
                    container.querySelector('#nav-w').onclick = () => { state.view='whisper'; render(); };
                    container.querySelector('#nav-a').onclick = () => { state.view='anon'; render(); };
                    container.querySelector('#nav-s').onclick = () => { state.view='set'; render(); };
                    renderBody();
                };

                const renderBody = async () => {
                    const inner = container.querySelector('#ws-inner');
                    if (!state.charId && state.view !== 'set') {
                        const list = await roche.character.list();
                        inner.innerHTML = `<h3 style="text-align:center; color:#ff9fb2;">选择角色开启空间</h3><div class="ws-wall-grid">
                            ${list.map(c => `<div class="ws-char-card" data-id="${c.id}" style="cursor:pointer; text-align:center; margin:10px;"><img src="${c.avatar}" style="width:60px; height:60px; border-radius:50%; border:2px solid #fff;"><p style="font-size:12px;">${c.name}</p></div>`).join('')}
                        </div>`;
                        inner.querySelectorAll('.ws-char-card').forEach(el => {
                            el.onclick = async () => { state.charId = el.dataset.id; await roche.storage.set('boundId', state.charId); render(); };
                        });
                        return;
                    }

                    if (state.view === 'shelf') {
                        const char = await roche.character.get(state.charId);
                        inner.innerHTML = `<div style="display:flex; gap:30px; justify-content:center; align-items:center; flex:1;">
                            <div class="ws-book-ui" id="book-u" style="width:140px; height:200px; background:#ffeef2; border-radius:5px 15px 15px 5px; box-shadow:5px 10px 20px rgba(0,0,0,0.1); cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:bold;">我的日记</div>
                            <div class="ws-book-ui" id="book-c" style="width:140px; height:200px; background-image:url('${char.avatar}'); background-size:cover; border-radius:5px 15px 15px 5px; box-shadow:5px 10px 20px rgba(0,0,0,0.1); cursor:pointer; display:flex; align-items:flex-end;"><div style="background:rgba(255,255,255,0.7); width:100%; padding:5px; text-align:center; font-size:12px; font-weight:bold;">${char.name}的心事</div></div>
                        </div>`;
                        inner.querySelector('#book-u').onclick = () => { state.book='user'; state.view='diary'; render(); };
                        inner.querySelector('#book-c').onclick = () => { state.book='char'; state.view='diary'; render(); };
                    } 
                    else if (state.view === 'diary') {
                        const entries = state.diaries.filter(d => d.sender === state.book);
                        inner.innerHTML = `<div class="ws-paper" style="background-image:url('${ASSETS.papers[0]}'); background-size:100% 100%;">
                            ${state.book==='user' ? `<textarea id="di-in" style="width:100%; border:none; background:transparent; outline:none; height:120px; font-size:15px;" placeholder="记录此刻..."></textarea><button class="ws-btn-soft" id="di-save">落笔</button>` : ''}
                            <div style="margin-top:20px;">
                                ${entries.reverse().map((e, i) => `<div class="ws-entry">
                                    <div style="font-size:10px; color:#999;">${new Date(e.time).toLocaleString()}</div>
                                    <div class="ws-text">${e.text.replace(/~~(.*?)~~/g, '<del>$1</del>')}</div>
                                    ${e.comment ? `<div class="ws-annotation-note" style="background-image:url('${ASSETS.stickies[i%3]}'); background-size:100% 100%;">${e.comment.replace(/~~(.*?)~~/g, '<del>$1</del>')}</div>` : ''}
                                </div>`).join('')}
                            </div>
                        </div>`;
                        if(inner.querySelector('#di-save')) inner.querySelector('#di-save').onclick = async () => {
                            const val = inner.querySelector('#di-in').value; if(!val) return;
                            const char = await roche.character.get(state.charId);
                            const entry = { sender:'user', text: val, time: Date.now(), comment: null };
                            roche.ui.toast("他已读到并正在批注...");
                            entry.comment = await fetchAI(roche, char, `用户日记：${val}。写一段30字内的即时批注。`);
                            state.diaries.push(entry); await roche.storage.set('diaries', state.diaries); render();
                        };
                    }
                    else if (state.view === 'whisper') {
                        inner.innerHTML = `<div class="ws-wall-grid">${state.whispers.map(w => `<div class="ws-whisper-box" style="background-image:url('${w.img}'); background-size:100% 100%; transform:rotate(${(Math.random()*6-3).toFixed(1)}deg);">${w.text.replace(/~~(.*?)~~/g, '<del>$1</del>')}</div>`).join('')}</div>`;
                    }
                    else if (state.view === 'anon') {
                        inner.innerHTML = `<div style="flex:1; display:flex; flex-direction:column;">
                            <div class="ws-anon-header"><div class="ws-anon-tab ${state.tab==='mine'?'active':''}" id="tab-m">我的信箱</div><div class="ws-anon-tab ${state.tab==='char'?'active':''}" id="tab-c">他的投递</div></div>
                            <div style="flex:1; overflow-y:auto; padding:5px;"><button class="ws-btn-soft" style="width:100%; margin-bottom:15px;" id="gen-an">读取百条对话并掉落新提问</button>
                                ${state.anons.filter(a => a.tab === state.tab).map(a => `<div class="ws-anon-item">
                                    <div style="font-weight:bold; font-size:13px;">${a.question}</div>
                                    ${a.answer ? `<div style="color:#ff9fb2; margin-top:8px; border-top:1px dashed #eee; padding-top:5px;">💬 回复：${a.answer}</div>` : `<textarea id="an-${a.id}" placeholder="输入回复..." style="width:100%; border:none; border-bottom:1px solid #eee; margin-top:5px;"></textarea><button class="ws-btn-soft" style="font-size:11px; padding:4px 10px; margin-top:5px;" onclick="window._wsAnsA('${a.id}')">发送</button>`}
                                </div>`).join('')}
                            </div>
                        </div>`;
                        inner.querySelector('#tab-m').onclick = () => { state.tab='mine'; render(); };
                        inner.querySelector('#tab-c').onclick = () => { state.tab='char'; render(); };
                        inner.querySelector('#gen-an').onclick = async () => {
                            const char = await roche.character.get(state.charId);
                            const res = await fetchAI(roche, char, `伪装投递一个关于最近聊天的话题给${state.tab==='mine'?'我':'他'}。`);
                            state.anons.unshift({ id: Math.random().toString(36).substr(2), tab: state.tab, question: res, time: Date.now() });
                            await roche.storage.set('anons', state.anons); render();
                        };
                        window._wsAnsA = async (id) => {
                            const val = document.getElementById(`an-${id}`).value; if(!val) return;
                            const idx = state.anons.findIndex(x => x.id === id);
                            state.anons[idx].answer = val; await roche.storage.set('anons', state.anons); render();
                        };
                    }
                    else if (state.view === 'set') {
                        inner.innerHTML = `<div class="ws-paper" style="background:#fff; height:auto;">
                            <h3>空间设置</h3>
                            <div style="margin-bottom:10px;">背景 URL: <input id="s-bg" value="${state.bg}" style="width:140px;"></div>
                            <div style="margin-bottom:10px;">字体 URL: <input id="s-font" value="${state.font}" style="width:140px;"></div>
                            <button class="ws-btn-soft" id="s-save">应用更改</button>
                            <button class="ws-btn-soft" style="background:#e74c3c; margin-top:20px; width:100%;" id="s-clear">彻底重置空间数据</button>
                        </div>`;
                        inner.querySelector('#s-save').onclick = async () => {
                            state.bg = inner.querySelector('#s-bg').value;
                            state.font = inner.querySelector('#s-font').value;
                            await roche.storage.set('bgUrl', state.bg); await roche.storage.set('fontUrl', state.font);
                            roche.ui.toast("已保存 (。・ω・。) "); render();
                        };
                        inner.querySelector('#s-clear').onclick = async () => {
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