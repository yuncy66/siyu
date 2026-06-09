(function() {
    const PLUGIN_ID = 'whisper-space-v4-2';

    // === 11张精选悄悄话背景素材与3张纸张/便利贴 ===
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
        .ws-root { position: absolute; inset: 0; background: #fef9f9; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; }
        .ws-nav { position: absolute; bottom: 30px; width: 85%; height: 65px; background: rgba(255,255,255,0.7); backdrop-filter: blur(15px); border-radius: 35px; display: flex; justify-content: space-around; align-items: center; box-shadow: 0 10px 25px rgba(255, 183, 197, 0.2); z-index: 1000; border: 1.5px solid #fff; }
        .ws-nav-item { cursor: pointer; transition: 0.3s; color: #a5a5a5; display: flex; flex-direction: column; align-items: center; }
        .ws-nav-item.active { color: #ff9fb2; transform: scale(1.1); }
        .ws-nav-icon { font-size: 18px; font-weight: bold; }
        .ws-nav-text { font-size: 10px; margin-top: 2px; }

        .ws-container { width: 92%; height: 80%; position: relative; display: flex; flex-direction: column; animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* 实体书翻开感 */
        .ws-paper-view { flex: 1; background: #fff; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); overflow-y: auto; padding: 25px; position: relative; scrollbar-width: none; }
        .ws-paper-view::-webkit-scrollbar { display: none; }
        
        .ws-diary-entry { margin-bottom: 35px; position: relative; border-bottom: 1px dashed rgba(0,0,0,0.05); padding-bottom: 15px; }
        .ws-text { font-family: var(--ws-font, inherit); color: #444; font-size: 15px; line-height: 1.8; white-space: pre-wrap; }
        .ws-text del { color: #ccc; text-decoration: line-through; opacity: 0.7; }

        /* 角色批注便利贴 */
        .ws-sticky-note { 
            width: 140px; min-height: 90px; padding: 15px; margin-top: -10px; margin-left: 35%;
            background-size: 100% 100%; font-family: var(--ws-font, inherit);
            font-size: 12px; transform: rotate(1deg); color: #555; line-height: 1.4;
        }

        /* 悄悄话墙布局 (手帐风) */
        .ws-wall { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; padding: 10px; }
        .ws-whisper-card { 
            width: 145px; height: 145px; padding: 20px; background-size: 100% 100%;
            display: flex; align-items: center; justify-content: center; text-align: center;
            font-family: var(--ws-font, inherit); font-size: 11px; transform: rotate(calc(-2deg + 4deg * Math.random()));
            line-height: 1.4; color: #444;
        }

        /* 匿名信箱 (巴达狗极简风) */
        .ws-anon-box { background: rgba(255,255,255,0.9); border-radius: 20px; padding: 20px; margin-bottom: 15px; }
        .ws-anon-header { display: flex; justify-content: center; gap: 40px; margin-bottom: 20px; }
        .ws-anon-tab { font-size: 14px; color: #999; cursor: pointer; padding-bottom: 5px; }
        .ws-anon-tab.active { color: #ff9fb2; border-bottom: 2px solid #ff9fb2; font-weight: bold; }

        .ws-back-btn { position: absolute; top: 15px; left: 15px; cursor: pointer; color: #ff9fb2; font-weight: bold; z-index: 1100; font-size: 14px; }
        .ws-btn-pink { background: #ff9fb2; color: white; border: none; padding: 8px 18px; border-radius: 20px; font-weight: bold; cursor: pointer; }
    `;

    // === 核心逻辑：读取100条记忆并生成拟人化内容 ===
    async function fetchAIGeneratedContent(roche, char, promptTask) {
        const history = await roche.memory.getShortTerm({ conversationId: char.conversationId, limit: 100 });
        const context = history.map(m => `${m.senderHandle || m.senderName}: ${m.text}`).join('\n');
        
        const systemPrompt = `你现在是${char.name}。
        人设：${char.persona}
        最近聊天背景：\n${context}\n
        任务：${promptTask}
        要求：
        1. 必须基于最近的互动氛围！
        2. 用第一人称，像真人在写私密话。
        3. 允许使用~~划掉内容~~来体现内心的犹豫或不敢表达。
        4. 语气要自然，禁止带有AI腔或过度的系统描述。`;

        const res = await roche.ai.chat({ messages: [{ role: 'system', content: systemPrompt }] });
        return res.text;
    }

    async function startDaemon(roche) {
        if (window._wsDaemonActive) return;
        window._wsDaemonActive = true;

        const daemonLoop = async () => {
            const charId = await roche.storage.get('boundCharId');
            if (!charId) return;
            const config = await roche.storage.get('config') || { interval: 25 };
            const char = await roche.character.get(charId);

            // 15% 概率执行自主行为
            if (Math.random() < 0.15) {
                const actionRes = await fetchAIGeneratedContent(roche, char, "请在[DIARY]写日记给用户看，或者在[WHISPER]贴一张你此时此刻内心深处真正想说的话。开头请标注类型。");
                
                if (actionRes.includes('[DIARY]')) {
                    const d = await roche.storage.get('diaries') || [];
                    d.push({ sender: 'char', text: actionRes.replace('[DIARY]', '').trim(), time: Date.now(), paper: Math.floor(Math.random()*3) });
                    await roche.storage.set('diaries', d);
                } else {
                    const w = await roche.storage.get('whispers') || [];
                    w.unshift({ text: actionRes.replace('[WHISPER]', '').trim() || actionRes, img: ASSETS.whispers[Math.floor(Math.random()*ASSETS.whispers.length)], time: Date.now() });
                    await roche.storage.set('whispers', w);
                }
                
                // 记忆注入，让聊天更有灵气
                await roche.memory.write({
                    conversationId: char.conversationId,
                    summaryText: `${char.name}刚才在空间里写下了对你未说出口的心声。`,
                    source: PLUGIN_ID
                });
            }
            setTimeout(daemonLoop, config.interval * 60 * 1000);
        };
        daemonLoop();
    }

    window.RochePlugin.register({
        id: PLUGIN_ID,
        name: "私语空间",
        version: "4.2.0",
        apps: [{
            id: "whisper-space-main",
            name: "私语空间",
            icon: "auto_stories",
            async mount(container, roche) {
                const styleEl = document.createElement('style');
                styleEl.innerHTML = styles;
                document.head.appendChild(styleEl);

                let state = {
                    view: 'bookshelf', // bookshelf, diary_in, whisper, anon, set
                    charId: await roche.storage.get('boundCharId'),
                    bookSide: 'user', 
                    anonTab: 'mine',
                    bg: await roche.storage.get('bgUrl') || '',
                    font: await roche.storage.get('fontUrl') || '',
                    diaries: await roche.storage.get('diaries') || [],
                    whispers: await roche.storage.get('whispers') || [],
                    anons: await roche.storage.get('anons') || []
                };

                startDaemon(roche);

                const render = () => {
                    container.innerHTML = `
                        <div class="ws-root" style="background-image:url('${state.bg}'); --ws-font:'${state.font?'WSFont':'inherit'}';">
                            <div class="ws-back-btn" onclick="window._wsBack()">🔙 返回</div>
                            <div class="ws-container" id="ws-body"></div>
                            <div class="ws-nav">
                                <div class="ws-nav-item ${state.view==='bookshelf'||state.view==='diary_in'?'active':''}" onclick="window._wsV('bookshelf')">
                                    <span class="ws-nav-icon">＞◡＜</span><span class="ws-nav-text">日记</span>
                                </div>
                                <div class="ws-nav-item ${state.view==='whisper'?'active':''}" onclick="window._wsV('whisper')">
                                    <span class="ws-nav-icon">ｏ◡ｏ</span><span class="ws-nav-text">私语</span>
                                </div>
                                <div class="ws-nav-item ${state.view==='anon'?'active':''}" onclick="window._wsV('anon')">
                                    <span class="ws-nav-icon">( (｡ì _ í｡) )</span><span class="ws-nav-text">信箱</span>
                                </div>
                                <div class="ws-nav-item ${state.view==='set'?'active':''}" onclick="window._wsV('set')">
                                    <span class="ws-nav-icon">( ꔷ × ꔷ )</span><span class="ws-nav-text">设置</span>
                                </div>
                            </div>
                        </div>
                    `;
                    window._wsV = (v) => { state.view = v; render(); };
                    window._wsBack = () => { if(state.view === 'diary_in') state.view = 'bookshelf'; else roche.ui.closeApp(); render(); };
                    renderContent();
                };

                const renderContent = async () => {
                    const body = container.querySelector('#ws-body');
                    if (!state.charId && state.view !== 'set') {
                        const list = await roche.character.list();
                        body.innerHTML = `<div style="text-align:center;"><h3 style="color:#ff9fb2;">选择与谁交换秘密</h3><div class="ws-wall" style="margin-top:20px;">
                            ${list.map(c => `<div onclick="window._wsBind('${c.id}')" style="cursor:pointer; width:80px;"><img src="${c.avatar}" style="width:50px; height:50px; border-radius:50%; border:2px solid #fff;"><p style="font-size:10px;">${c.name}</p></div>`).join('')}
                        </div></div>`;
                        window._wsBind = async (id) => { state.charId = id; await roche.storage.set('boundCharId', id); render(); };
                        return;
                    }

                    if (state.view === 'bookshelf') {
                        const char = await roche.character.get(state.charId);
                        body.innerHTML = `
                            <div class="ws-shelf" style="display:flex; gap:30px; justify-content:center; align-items:center;">
                                <div class="ws-book" style="background-color:#ffeef2;" onclick="window._wsOpen('user')"><div class="ws-book-title">我的交换日记</div></div>
                                <div class="ws-book" style="background-image:url('${char.avatar}');" onclick="window._wsOpen('char')"><div class="ws-book-title">${char.name}的心事簿</div></div>
                            </div>
                        `;
                        window._wsOpen = (side) => { state.bookSide = side; state.view = 'diary_in'; render(); };
                    } 
                    else if (state.view === 'diary_in') {
                        const entries = state.diaries.filter(d => d.sender === state.bookSide);
                        body.innerHTML = `
                            <div class="ws-paper-view" style="background-image:url('${ASSETS.papers[0]}'); background-size:100% 100%;">
                                <h4 style="margin:0 0 15px 0;">${state.bookSide==='user'?'给未来的秘密记录':'翻开他的内心告白'}</h4>
                                ${state.bookSide==='user' ? `<textarea id="ws-in" class="ws-text" style="width:100%; border:none; background:transparent; outline:none; height:150px;" placeholder="点击这里落笔..."></textarea><button class="ws-btn-pink" id="ws-save">合上日记</button>` : ''}
                                <div style="margin-top:25px;">
                                    ${entries.reverse().map((e, i) => `
                                        <div class="ws-diary-entry">
                                            <div style="font-size:10px; color:#999;">${new Date(e.time).toLocaleString()}</div>
                                            <div class="ws-text">${e.text.replace(/~~(.*?)~~/g, '<del>$1</del>')}</div>
                                            ${e.comment ? `<div class="ws-sticky-note" style="background-image:url('${ASSETS.stickies[i%3]}')">${e.comment.replace(/~~(.*?)~~/g, '<del>$1</del>')}</div>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                        if(body.querySelector('#ws-save')) body.querySelector('#ws-save').onclick = async () => {
                            const val = body.querySelector('#ws-in').value; if(!val) return;
                            const char = await roche.character.get(state.charId);
                            const entry = { sender:'user', text: val, time: Date.now(), comment: null };
                            // 立即触发回复 (日记批注我们保持相对及时)
                            roche.ui.toast("他正在悄悄查看并写下批注...");
                            entry.comment = await fetchAIGeneratedContent(roche, char, `用户刚才在日记里写了：${val}。请你在他的文字下面贴一张便利贴写下你的即时批注。字数30字以内。`);
                            state.diaries.push(entry);
                            await roche.storage.set('diaries', state.diaries); render();
                        };
                    }
                    else if (state.view === 'whisper') {
                        body.innerHTML = `<div class="ws-wall" style="overflow-y:auto; flex:1;">
                            ${state.whispers.map(w => `<div class="ws-whisper-card" style="background-image:url('${w.img}')">${w.text.replace(/~~(.*?)~~/g, '<del>$1</del>')}</div>`).join('')}
                        </div>`;
                    }
                    else if (state.view === 'anon') {
                        body.innerHTML = `
                            <div style="flex:1; display:flex; flex-direction:column;">
                                <div class="ws-anon-header">
                                    <div class="ws-anon-tab ${state.anonTab==='mine'?'active':''}" onclick="window._wsAn('mine')">我的提问箱</div>
                                    <div class="ws-anon-tab ${state.anonTab==='char'?'active':''}" onclick="window._wsAn('char')">给他的投递</div>
                                </div>
                                <div style="flex:1; overflow-y:auto; padding:10px;">
                                    <button class="ws-btn-pink" style="width:100%; margin-bottom:15px;" id="ws-gen-an">随机掉落新问题 (基于100条对话)</button>
                                    ${state.anons.filter(a => a.tab === state.anonTab).map(a => `
                                        <div class="ws-anon-box">
                                            <div style="font-weight:bold; font-size:14px; margin-bottom:8px;">${a.question}</div>
                                            ${a.answer ? `<div style="color:#ff9fb2; border-top:1px dashed #eee; padding-top:8px;">💬 回复：${a.answer}</div>` : `<textarea id="an-${a.id}" placeholder="在这里回复..." style="width:100%; border:none; border-bottom:1px solid #eee; background:transparent;"></textarea><button class="ws-btn-pink" style="margin-top:8px; font-size:12px; padding:5px 12px;" onclick="window._wsAnsAn('${a.id}')">发送</button>`}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                        window._wsAn = (t) => { state.anonTab = t; render(); };
                        window._wsAnsAn = async (id) => {
                            const val = body.querySelector(`#an-${id}`).value; if(!val) return;
                            const idx = state.anons.findIndex(x => x.id === id);
                            state.anons[idx].answer = val;
                            await roche.storage.set('anons', state.anons); render();
                        };
                        body.querySelector('#ws-gen-an').onclick = async () => {
                            roche.ui.toast("读取记忆中...");
                            const char = await roche.character.get(state.charId);
                            const res = await fetchAIGeneratedContent(roche, char, `请伪装成匿名投递人给${state.anonTab==='mine'?'用户':'你自己'}投递一个关于你们最近互动细节的问题。`);
                            state.anons.unshift({ id: crypto.randomUUID(), tab: state.anonTab, question: res, time: Date.now() });
                            await roche.storage.set('anons', state.anons); render();
                        };
                    }
                    else if (state.view === 'set') {
                        body.innerHTML = `
                            <div class="ws-paper-view" style="background:#fff; height:auto;">
                                <h3>空间设置中心</h3>
                                <div style="margin-bottom:10px;">背景 URL: <input id="s-bg" value="${state.bg}" style="width:140px;"></div>
                                <div style="margin-bottom:10px;">字体 URL: <input id="s-font" value="${state.font}" style="width:140px;"></div>
                                <div style="margin-top:20px;">
                                    <button class="ws-btn-pink" onclick="window._wsSaveS()">应用设置</button>
                                    <button class="ws-btn-pink" style="background:#999; margin-left:10px;" onclick="roche.ui.closeApp()">退出空间</button>
                                </div>
                                <button onclick="window._wsClearAll()" style="margin-top:30px; color:red; border:none; background:none; cursor:pointer;">[ 彻底删除空间所有记录 ]</button>
                            </div>
                        `;
                        window._wsSaveS = async () => {
                            state.bg = body.querySelector('#s-bg').value;
                            state.font = body.querySelector('#s-font').value;
                            await roche.storage.set('bgUrl', state.bg);
                            await roche.storage.set('fontUrl', state.font);
                            roche.ui.toast("保存成功 (。・ω・。) ");
                            render();
                        };
                        window._wsClearAll = async () => {
                            if(confirm("确定要删除所有交换日记和悄悄话吗？")) {
                                await roche.storage.delete('diaries'); await roche.storage.delete('whispers'); await roche.storage.delete('anons');
                                location.reload();
                            }
                        };
                    }
                };

                render();
            },
            async unmount(container) { container.replaceChildren(); }
        }]
    };

    window.RochePlugin.register(plugin);
})();