(function() {
    const PLUGIN_ID = 'whisper-space-v4-2-final';

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
        .ws-root { position: absolute; inset: 0; background: #fff9fb; display: flex; flex-direction: column; overflow: hidden; padding-top: env(safe-area-inset-top); font-family: "PingFang SC", sans-serif; }
        .ws-nav { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); width: 88%; height: 65px; background: rgba(255,255,255,0.7); backdrop-filter: blur(15px); border-radius: 35px; border: 1px solid #fff; display: flex; justify-content: space-around; align-items: center; box-shadow: 0 10px 25px rgba(255,183,197,0.15); z-index: 1000; }
        .ws-nav-item { cursor: pointer; color: #a5a5a5; display: flex; flex-direction: column; align-items: center; transition: 0.3s; }
        .ws-nav-item.active { color: #ff9fb2; transform: scale(1.1); }
        .ws-nav-icon { font-size: 18px; font-weight: bold; }
        .ws-nav-text { font-size: 10px; margin-top: 2px; }

        .ws-body { flex: 1; display: flex; justify-content: center; align-items: center; padding-bottom: 80px; }
        .ws-shelf { display: flex; gap: 35px; }
        .ws-book { width: 145px; height: 210px; background: #fff; border-radius: 4px 15px 15px 4px; box-shadow: 10px 15px 30px rgba(0,0,0,0.12); cursor: pointer; transition: 0.4s; border-left: 10px solid rgba(0,0,0,0.08); display: flex; align-items: flex-end; position: relative; }
        .ws-book:hover { transform: translateY(-10px) rotateY(-10deg); }
        .ws-book-title { width: 100%; background: rgba(255,255,255,0.8); padding: 8px; font-size: 12px; font-weight: bold; text-align: center; }

        .ws-page-box { width: 92%; height: 85%; background: #fff; border-radius: 8px; box-shadow: 0 15px 40px rgba(0,0,0,0.1); position: relative; overflow: hidden; display: flex; flex-direction: column; animation: flipOpen 0.5s ease-out; }
        @keyframes flipOpen { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        .ws-page-content { flex: 1; padding: 25px; overflow-y: auto; position: relative; z-index: 1; scrollbar-width: none; }
        .ws-page-content::-webkit-scrollbar { display: none; }
        
        .ws-back-btn { margin-bottom: 15px; color: #ff9fb2; font-weight: bold; cursor: pointer; font-size: 14px; position: relative; z-index: 10; }
        .ws-entry-item { margin-bottom: 35px; border-bottom: 1px dashed rgba(0,0,0,0.05); padding-bottom: 15px; line-height: 2; }
        .ws-text { color: #444; font-size: 15px; white-space: pre-wrap; font-family: var(--ws-font, inherit); }
        .ws-text del { color: #ccc; text-decoration: line-through; opacity: 0.7; }
        
        .ws-sticky { width: 140px; min-height: 85px; padding: 15px; margin-left: 35%; margin-top: -10px; background-size: 100% 100%; font-size: 12px; color: #555; line-height: 1.4; transform: rotate(1deg); }

        .ws-wall { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; padding: 10px; overflow-y: auto; }
        .ws-whisper-card { width: 145px; height: 145px; padding: 20px; background-size: 100% 100%; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 11px; line-height: 1.5; color: #444; }

        .ws-anon-tab-box { display: flex; justify-content: center; gap: 30px; margin-bottom: 15px; }
        .ws-anon-tab { font-size: 14px; color: #999; cursor: pointer; padding: 5px 15px; border-radius: 20px; }
        .ws-anon-tab.active { background: #ffb7c5; color: white; font-weight: bold; }
        .ws-anon-card { background: #fff; border-radius: 15px; padding: 20px; margin-bottom: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.03); border: 1px solid #fef0f2; }

        .ws-btn-main { background: #ffb7c5; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: bold; }
    `;

    // === 后台读取百条记忆逻辑 (v4.2 核心) ===
    async function fetchAILogic(roche, char, task) {
        const history = await roche.memory.getShortTerm({ conversationId: char.conversationId, limit: 100 });
        const context = history.map(m => (m.senderHandle || m.senderName) + ': ' + m.text).join('\\n');
        const system = '你是' + char.name + '。基于最近100条聊天氛围：\\n' + context + '\\n任务：' + task + '\\n要求：第一人称真人语气，纠结处请用~~划掉内容~~。';
        const res = await roche.ai.chat({ messages: [{ role: 'system', content: system }] });
        return res.text;
    }

    async function startDaemon(roche) {
        if (window._wsDaemonActive) return;
        window._wsDaemonActive = true;
        const tick = async () => {
            const charId = await roche.storage.get('boundCharId');
            if (charId && Math.random() < 0.15) {
                const char = await roche.character.get(charId);
                const result = await fetchAILogic(roche, char, '请选择在[DIARY]写日记或在[WHISPER]贴悄悄话。');
                if (result.includes('[DIARY]')) {
                    const d = await roche.storage.get('diaries') || [];
                    d.push({ sender: 'char', text: result.replace('[DIARY]', '').trim(), time: Date.now() });
                    await roche.storage.set('diaries', d);
                } else {
                    const w = await roche.storage.get('whispers') || [];
                    w.unshift({ text: result.replace('[WHISPER]', '').trim() || result, img: ASSETS.whispers[Math.floor(Math.random() * 11)], time: Date.now() });
                    await roche.storage.set('whispers', w);
                }
                await roche.memory.write({ conversationId: char.conversationId, summaryText: char.name + '更新了日记空间。', source: PLUGIN_ID });
            }
            setTimeout(tick, 1000 * 60 * 25);
        };
        tick();
    }

    window.RochePlugin.register({
        id: PLUGIN_ID,
        name: "私语空间",
        version: "4.2.2",
        apps: [{
            id: "whisper-space-main",
            name: "私语空间",
            icon: "auto_stories",
            async mount(container, roche) {
                const styleEl = document.createElement('style');
                styleEl.innerHTML = styles;
                document.head.appendChild(styleEl);

                let state = {
                    view: 'shelf', charId: await roche.storage.get('boundCharId'), bookSide: 'user', anonTab: 'mine',
                    bg: await roche.storage.get('bgUrl') || '', font: await roche.storage.get('fontUrl') || '',
                    diaries: await roche.storage.get('diaries') || [], whispers: await roche.storage.get('whispers') || [], anons: await roche.storage.get('anons') || []
                };

                startDaemon(roche);

                const render = () => {
                    container.innerHTML = `
                        <div class="ws-root" style="background-image:url('${state.bg}'); --ws-font:'${state.font?'WSFont':'inherit'}';">
                            <div class="ws-body" id="ws-content"></div>
                            <div class="ws-nav">
                                <div class="ws-nav-item ${['shelf','diary'].includes(state.view)?'active':''}" id="btn-diary"><span class="ws-nav-icon">＞◡＜</span><span class="ws-nav-text">日记</span></div>
                                <div class="ws-nav-item ${state.view==='whisper'?'active':''}" id="btn-whisper"><span class="ws-nav-icon">ｏ◡ｏ</span><span class="ws-nav-text">私语</span></div>
                                <div class="ws-nav-item ${state.view==='anon'?'active':''}" id="btn-anon"><span class="ws-nav-icon">( 📮 )</span><span class="ws-nav-text">信箱</span></div>
                                <div class="ws-nav-item ${state.view==='set'?'active':''}" id="btn-set"><span class="ws-nav-icon">( ⚙️ )</span><span class="ws-nav-text">设置</span></div>
                            </div>
                        </div>
                    `;
                    // 绑定事件解决安装报错中的 token 问题
                    container.querySelector('#btn-diary').onclick = () => { state.view = 'shelf'; render(); };
                    container.querySelector('#btn-whisper').onclick = () => { state.view = 'whisper'; render(); };
                    container.querySelector('#btn-anon').onclick = () => { state.view = 'anon'; render(); };
                    container.querySelector('#btn-set').onclick = () => { state.view = 'set'; render(); };
                    renderBody();
                };

                const renderBody = async () => {
                    const body = container.querySelector('#ws-content');
                    if (!state.charId && state.view !== 'set') {
                        const list = await roche.character.list();
                        body.innerHTML = `<div style="text-align:center;"><h3 style="color:#ffb7c5;">选择谁开启秘密契约？</h3><div class="ws-wall">
                            ${list.map(c => `<div class="ws-c-card" data-id="${c.id}" style="cursor:pointer; width:80px;"><img src="${c.avatar}" style="width:55px; height:55px; border-radius:50%; border:2px solid #fff;"><p style="font-size:10px; margin-top:5px;">${c.name}</p></div>`).join('')}
                        </div></div>`;
                        body.querySelectorAll('.ws-c-card').forEach(el => el.onclick = async () => { state.charId = el.dataset.id; await roche.storage.set('boundCharId', state.charId); render(); });
                        return;
                    }

                    if (state.view === 'shelf') {
                        const char = await roche.character.get(state.charId);
                        body.innerHTML = `
                            <div class="ws-shelf">
                                <div class="ws-book" id="open-u" style="background:#ffeef2;"><div class="ws-book-title">我的交换日记</div></div>
                                <div class="ws-book" id="open-c" style="background-image:url('${char.avatar}'); background-size:cover;"><div class="ws-book-title">${char.name}的心事本</div></div>
                            </div>
                        `;
                        body.querySelector('#open-u').onclick = () => { state.bookSide = 'user'; state.view = 'diary'; render(); };
                        body.querySelector('#open-c').onclick = () => { state.bookSide = 'char'; state.view = 'diary'; render(); };
                    } 
                    else if (state.view === 'diary') {
                        const entries = state.diaries.filter(d => d.sender === state.bookSide);
                        body.innerHTML = `
                            <div class="ws-page">
                                <div style="position:absolute; inset:0; background-image:url('${ASSETS.papers[0]}'); background-size:100% 100%; opacity:0.9;"></div>
                                <div class="ws-page-content">
                                    <div class="ws-back-arrow" id="back-shelf">← 返回书架</div>
                                    ${state.bookSide==='user' ? '<textarea id="di-in" style="width:100%; border:none; background:transparent; font-size:16px; outline:none; height:120px; position:relative; z-index:5;" placeholder="点击记录此时此刻..."></textarea><button class="ws-btn-main" id="di-save">落笔合上</button>' : ''}
                                    <div style="margin-top:25px;">
                                        ${entries.reverse().map((e, i) => `
                                            <div class="ws-entry-item">
                                                <div style="font-size:10px; color:#999;">${new Date(e.time).toLocaleString()}</div>
                                                <div class="ws-text">${e.text.replace(/~~(.*?)~~/g, '<del>$1</del>')}</div>
                                                ${e.comment ? `<div class="ws-sticky" style="background-image:url('${ASSETS.stickies[i%3]}'); background-size:100% 100%;">${e.comment.replace(/~~(.*?)~~/g, '<del>$1</del>')}</div>` : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        `;
                        body.querySelector('#back-shelf').onclick = () => { state.view = 'shelf'; render(); };
                        if(body.querySelector('#di-save')) body.querySelector('#di-save').onclick = async () => {
                            const val = body.querySelector('#di-in').value; if(!val) return;
                            const char = await roche.character.get(state.charId);
                            const entry = { sender:'user', text: val, time: Date.now(), comment: null };
                            roche.ui.toast("他正悄悄查看并留下批注...");
                            entry.comment = await fetchAILogic(roche, char, '用户写了日记：' + val + '。请写一段30字内的即时批注。');
                            state.diaries.push(entry); await roche.storage.set('diaries', state.diaries); render();
                        };
                    }
                    else if (state.view === 'whisper') {
                        body.innerHTML = `<div class="ws-wall" style="width:100%; height:100%; overflow-y:auto; padding-bottom:100px;">
                            ${state.whispers.map(w => `<div class="ws-whisper-card" style="background-image:url('${w.img}'); background-size:100% 100%; transform:rotate(${(Math.random()*6-3).toFixed(1)}deg);">${w.text.replace(/~~(.*?)~~/g, '<del>$1</del>')}</div>`).join('')}
                        </div>`;
                    }
                    else if (state.view === 'anon') {
                        body.innerHTML = `
                            <div style="width:90%; height:90%; display:flex; flex-direction:column;">
                                <div class="ws-anon-tab-box">
                                    <div class="ws-anon-tab ${state.anonTab==='mine'?'active':''}" id="tab-m">我的信箱</div>
                                    <div class="ws-anon-tab ${state.anonTab==='char'?'active':''}" id="tab-c">他的投递</div>
                                </div>
                                <div style="flex:1; overflow-y:auto; padding-bottom:80px;">
                                    <button class="ws-btn-main" style="width:100%; margin-bottom:15px;" id="ai-an">掉落匿名提问 (基于100条记忆)</button>
                                    ${state.anons.filter(a => a.tab === state.anonTab).map(a => `
                                        <div class="ws-anon-card">
                                            <div style="font-weight:bold; font-size:14px;">${a.question}</div>
                                            ${a.answer ? `<div style="color:#ffb7c5; margin-top:10px; border-top:1px dashed #eee; padding-top:10px;">💬 回复：${a.answer}</div>` : `<textarea id="an-${a.id}" placeholder="输入回复..." style="width:100%; border:none; background:transparent; border-bottom:1px solid #ffb7c5;"></textarea><button class="ws-btn-main" style="margin-top:10px; padding:5px 12px; font-size:12px;" onclick="window._wsAnsA('${a.id}')">发送</button>`}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                        body.querySelector('#tab-m').onclick = () => { state.anonTab='mine'; render(); };
                        body.querySelector('#tab-c').onclick = () => { state.anonTab='char'; render(); };
                        window._wsAnsA = async (id) => {
                            const val = document.getElementById('an-'+id).value; if(!val) return;
                            const idx = state.anons.findIndex(x => x.id === id);
                            state.anons[idx].answer = val; await roche.storage.set('anons', state.anons); render();
                        };
                        body.querySelector('#ai-an').onclick = async () => {
                            const char = await roche.character.get(state.charId);
                            const res = await fetchAILogic(roche, char, '伪装投递一个带有性格破绽的匿名提问给' + (state.anonTab==='mine'?'我':'你') + '。');
                            state.anons.unshift({ id: Math.random().toString(36).substr(2), tab: state.anonTab, question: res, time: Date.now() });
                            await roche.storage.set('anons', state.anons); render();
                        };
                    }
                    else if (state.view === 'set') {
                        body.innerHTML = `
                            <div class="ws-page" style="height:auto; padding:25px;">
                                <h3 style="color:#ffb7c5;">设置中心</h3>
                                <div style="margin-bottom:15px;">背景图 URL: <input id="s-bg" value="${state.bg}" style="width:140px;"></div>
                                <div style="margin-bottom:15px;">自定义字体 URL: <input id="s-font" value="${state.font}" style="width:140px;"></div>
                                <button class="ws-btn-main" style="width:100%;" id="s-save">应用更改</button>
                                <button class="ws-btn-main" style="background:#999; margin-top:15px; width:100%;" onclick="roche.ui.closeApp()">退出空间</button>
                                <button class="ws-btn-main" style="background:#e74c3c; margin-top:30px; width:100%;" onclick="if(confirm('重置将彻底删除所有交换日记？')){roche.storage.delete('diaries');roche.storage.delete('whispers');roche.storage.delete('anons');location.reload();}">彻底清空数据</button>
                            </div>
                        `;
                        body.querySelector('#s-save').onclick = async () => {
                            state.bg = body.querySelector('#s-bg').value; state.font = body.querySelector('#s-font').value;
                            await roche.storage.set('bgUrl', state.bg); await roche.storage.set('fontUrl', state.font);
                            roche.ui.toast("设置已保存 (。・ω・。) "); render();
                        };
                    }
                };
                render();
            },
            async unmount(container) { container.replaceChildren(); }
        }]
    });
})();