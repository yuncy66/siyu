(function() {
    const PLUGIN_ID = 'whisper-space-v3';

    // === 1. 极致美化样式 (手帐感、安全区域、高级颜文字) ===
    const styles = `
        :root {
            --ws-pink: #ffb7c5;
            --ws-bg: #fff9fb;
            --ws-shadow: 0 8px 20px rgba(255, 183, 197, 0.3);
        }
        .ws-wrapper {
            position: absolute; inset: 0;
            padding-top: env(safe-area-inset-top);
            padding-bottom: env(safe-area-inset-bottom);
            background-color: var(--ws-bg);
            background-size: cover; background-position: center;
            font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
            display: flex; flex-direction: column; overflow: hidden;
            color: #5d5d5d;
        }

        /* 顶部安全区偏移 */
        .ws-header { height: 44px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; position: relative; }

        /* 底部液态颜文字导航 */
        .ws-tabbar {
            position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%);
            width: 85%; height: 60px;
            background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(15px);
            border-radius: 30px; display: flex; justify-content: space-around; align-items: center;
            box-shadow: var(--ws-shadow); border: 1.5px solid #fff; z-index: 1000;
        }
        .ws-tab-item { cursor: pointer; transition: 0.3s; display: flex; flex-direction: column; align-items: center; color: #888; }
        .ws-tab-item.active { color: #ff6b81; transform: scale(1.1); }
        .ws-tab-emoji { font-size: 18px; font-weight: bold; }
        .ws-tab-label { font-size: 10px; margin-top: 2px; }

        /* 书架布局 (参考图4) */
        .ws-bookshelf {
            display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; padding: 20px;
            flex: 1; overflow-y: auto; padding-bottom: 100px;
        }
        .ws-book-item {
            display: flex; flex-direction: column; align-items: center; cursor: pointer;
            transition: 0.3s;
        }
        .ws-book-item:active { transform: scale(0.95); }
        .ws-book-cover {
            width: 130px; height: 180px; background: #fff; border-radius: 10px 18px 18px 10px;
            box-shadow: 5px 8px 15px rgba(0,0,0,0.1); border-left: 8px solid rgba(0,0,0,0.05);
            background-size: cover; background-position: center; position: relative;
        }
        .ws-book-cover::after { content: ""; position: absolute; left: 10px; top: 0; bottom: 0; width: 1px; background: rgba(0,0,0,0.05); }
        .ws-book-title { margin-top: 10px; font-size: 13px; font-weight: 500; text-align: center; width: 130px; }

        /* 日记本内页交互 */
        .ws-diary-container {
            flex: 1; padding: 20px; display: flex; flex-direction: column; animation: openBook 0.4s ease-out;
        }
        @keyframes openBook { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        .ws-diary-paper {
            background: #fff; flex: 1; border-radius: 15px; box-shadow: var(--ws-shadow);
            padding: 25px; position: relative; overflow-y: auto;
            background-image: linear-gradient(#f1f1f1 1px, transparent 1px); background-size: 100% 30px;
            line-height: 30px;
        }
        .ws-diary-back { margin-bottom: 15px; cursor: pointer; font-size: 14px; color: #ff6b81; }

        /* 便利贴定制 */
        .ws-sticky {
            width: 145px; min-height: 145px; padding: 15px; margin: 10px;
            background-size: cover; background-position: center;
            box-shadow: 2px 4px 10px rgba(0,0,0,0.1);
            font-family: var(--ws-font, inherit); font-size: 13px;
            display: inline-block; transform: rotate(-1deg); vertical-align: top;
        }

        /* 按钮美化 */
        .ws-btn-primary { background: #ffb7c5; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: bold; cursor: pointer; }
        .ws-btn-grey { background: #dcdde1; color: #7f8c8d; border: none; padding: 10px 20px; border-radius: 20px; font-weight: bold; cursor: pointer; }
    `;

    async function startDaemon(roche) {
        if (window._wsDaemonActive) return;
        window._wsDaemonActive = true;
        const loop = async () => {
            const config = await roche.storage.get('config') || { mode: 'background', interval: 30 };
            const charId = await roche.storage.get('boundCharId');
            if (charId && config.mode === 'background' && Math.random() < 0.2) {
                const char = await roche.character.get(charId);
                const messages = await roche.memory.getShortTerm({ conversationId: char.conversationId, limit: 100 });
                const history = messages.map(m => `${m.senderHandle || m.senderName}: ${m.text}`).join('\n');
                const res = await roche.ai.chat({
                    messages: [{ role: 'system', content: `你是${char.name}。背景：${history}\n任务：写一篇秘密日记[DIARY]或匿名提问[ANON]。` }]
                });
                if (res.text.includes('[DIARY]')) {
                    const d = await roche.storage.get('diaries') || [];
                    d.push({ sender: 'char', text: res.text.replace('[DIARY]', '').trim(), time: Date.now() });
                    await roche.storage.set('diaries', d);
                }
                await roche.memory.write({ conversationId: char.conversationId, summaryText: `${char.name}在日记里偷偷写了心事。`, source: PLUGIN_ID });
            }
            setTimeout(loop, config.interval * 60 * 1000);
        };
        loop();
    }

    window.RochePlugin.register({
        id: PLUGIN_ID,
        name: "私语空间 v3",
        version: "3.0.0",
        apps: [{
            id: "whisper-space-main",
            name: "私语空间",
            icon: "book",
            async mount(container, roche) {
                const styleEl = document.createElement('style');
                styleEl.innerHTML = styles;
                document.head.appendChild(styleEl);

                let state = {
                    view: 'bookshelf', // bookshelf, diary_in, whisper, anon, set
                    currentBook: null, // user or char
                    charId: await roche.storage.get('boundCharId'),
                    config: await roche.storage.get('config') || { mode: 'background', interval: 30 },
                    bg: await roche.storage.get('bgUrl') || '',
                    noteBg: await roche.storage.get('noteBgUrl') || '',
                    diaries: await roche.storage.get('diaries') || [],
                    whispers: await roche.storage.get('whispers') || [],
                    anons: await roche.storage.get('anons') || []
                };

                startDaemon(roche);

                const render = () => {
                    container.innerHTML = `
                        <div class="ws-wrapper" style="background-image: url('${state.bg}');">
                            <div class="ws-header">${state.view === 'bookshelf' ? '我的珍藏' : ''}</div>
                            <div class="ws-bookshelf" id="ws-body"></div>
                            <div class="ws-tabbar">
                                <div class="ws-tab-item ${['bookshelf','diary_in'].includes(state.view)?'active':''}" onclick="window._wsV('bookshelf')">
                                    <span class="ws-tab-emoji">＞◡＜</span><span class="ws-tab-label">日记</span>
                                </div>
                                <div class="ws-tab-item ${state.view==='whisper'?'active':''}" onclick="window._wsV('whisper')">
                                    <span class="ws-tab-emoji">ｏ◡ｏ</span><span class="ws-tab-label">私语</span>
                                </div>
                                <div class="ws-tab-item ${state.view==='anon'?'active':''}" onclick="window._wsV('anon')">
                                    <span class="ws-tab-emoji">（ 📮 ）</span><span class="ws-tab-label">信箱</span>
                                </div>
                                <div class="ws-tab-item ${state.view==='set'?'active':''}" onclick="window._wsV('set')">
                                    <span class="ws-tab-emoji">（ ⚙️ ）</span><span class="ws-tab-label">设置</span>
                                </div>
                            </div>
                        </div>
                    `;
                    window._wsV = (v) => { state.view = v; render(); };
                    renderContent();
                };

                const renderContent = async () => {
                    const body = container.querySelector('#ws-body');
                    body.className = (state.view === 'bookshelf') ? 'ws-bookshelf' : 'ws-diary-container';

                    if (state.view === 'bookshelf') {
                        const char = state.charId ? await roche.character.get(state.charId) : null;
                        body.innerHTML = `
                            <div class="ws-book-item" onclick="window._wsOpen('user')">
                                <div class="ws-book-cover" style="background-color: #ffdae0; border: 2px solid #fff;"></div>
                                <div class="ws-book-title">我的交换日记</div>
                            </div>
                            <div class="ws-book-item" onclick="window._wsOpen('char')">
                                <div class="ws-book-cover" style="background-image: url('${char?.avatar || ''}'); background-color: #e3f2fd;"></div>
                                <div class="ws-book-title">${char ? char.name + '的日记' : '未绑定角色'}</div>
                            </div>
                        `;
                        window._wsOpen = (who) => { state.view = 'diary_in'; state.currentBook = who; render(); };
                    } 
                    else if (state.view === 'diary_in') {
                        const title = state.currentBook === 'user' ? "写下今日份的心情" : "偷偷翻看他的心事";
                        const entries = state.diaries.filter(d => d.sender === state.currentBook);
                        body.innerHTML = `
                            <div class="ws-diary-back" onclick="window._wsV('bookshelf')">← 返回书架</div>
                            <div class="ws-diary-paper">
                                <div class="ws-title">${title}</div>
                                ${state.currentBook === 'user' ? `
                                    <textarea id="ws-in" style="width:100%; border:none; background:transparent; font-size:15px; outline:none; height:200px;" placeholder="在这里记录..."></textarea>
                                    <button class="ws-btn-primary" id="ws-save">合上日记</button>
                                ` : ''}
                                <div style="margin-top:20px;">
                                    ${entries.reverse().map(e => `
                                        <div style="border-bottom: 1px dashed #eee; padding: 15px 0;">
                                            <div style="font-size:12px; color:#999;">${new Date(e.time).toLocaleString()}</div>
                                            <div style="margin-top:5px; line-height:1.6;">${e.text}</div>
                                        </div>
                                    `).join('') || '<p style="color:#bbb;">空空如也...</p>'}
                                </div>
                            </div>
                        `;
                        if(body.querySelector('#ws-save')) body.querySelector('#ws-save').onclick = async () => {
                            const val = body.querySelector('#ws-in').value; if(!val) return;
                            state.diaries.push({ sender: 'user', text: val, time: Date.now() });
                            await roche.storage.set('diaries', state.diaries);
                            roche.ui.toast("已记录在册~");
                            state.view = 'bookshelf'; render();
                        };
                    }
                    else if (state.view === 'whisper') {
                        body.innerHTML = `
                            <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:15px;">
                                <span style="font-weight:bold;">悄悄话墙</span>
                                <button class="ws-btn-primary" id="ws-add-w" style="padding: 5px 15px;">+ 贴一张</button>
                            </div>
                            <div style="overflow-y:auto; flex:1;">
                                ${state.whispers.map(w => `
                                    <div class="ws-sticky" style="background-image: url('${state.noteBg || 'https://img.js.design/assets/static/7afcff.png'}'); background-color:#fff;">
                                        ${w.text}<div style="position:absolute; bottom:5px; right:10px; font-size:10px;">— ${w.sender}</div>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                        body.querySelector('#ws-add-w').onclick = async () => {
                            const t = prompt("你想说什么？"); if(!t) return;
                            state.whispers.push({ sender: '我', text: t, time: Date.now() });
                            await roche.storage.set('whispers', state.whispers); render();
                        };
                    }
                    else if (state.view === 'anon') {
                        body.innerHTML = `
                            <button class="ws-btn-primary" style="width:100%; margin-bottom:20px;" id="ws-ai-an">召唤匿名提问箱</button>
                            <div style="overflow-y:auto;">
                                ${state.anons.map(a => `
                                    <div class="ws-diary-paper" style="margin-bottom:15px; min-height:auto;">
                                        <div style="color:#888; font-size:12px;">有人悄悄问：</div>
                                        <div style="font-weight:bold; margin:10px 0;">${a.question}</div>
                                        ${a.answer ? `<div style="color:#ff6b81;">💬 我的回答：${a.answer}</div>` : `
                                            <input id="ans-${a.id}" placeholder="回答一下..." style="border:1px solid #eee; border-radius:10px; padding:8px; width:80%;">
                                            <button class="ws-btn-primary" style="padding:5px 10px;" onclick="window._wsAns('${a.id}')">回</button>
                                        `}
                                    </div>
                                `).join('')}
                            </div>
                        `;
                        window._wsAns = async (id) => {
                            const val = body.querySelector(`#ans-${id}`).value; if(!val) return;
                            const idx = state.anons.findIndex(x => x.id === id);
                            state.anons[idx].answer = val;
                            await roche.storage.set('anons', state.anons); render();
                        };
                        body.querySelector('#ws-ai-an').onclick = async () => {
                            roche.ui.toast("AI 正在派送中...");
                            const char = await roche.character.get(state.charId);
                            const res = await roche.ai.chat({ messages: [{role:'user', content:'作为匿名路人给用户投递一个提问。'}] });
                            state.anons.unshift({ id: crypto.randomUUID(), question: res.text, time: Date.now() });
                            await roche.storage.set('anons', state.anons); render();
                        };
                    }
                    else if (state.view === 'set') {
                        body.innerHTML = `
                            <div class="ws-diary-paper">
                                <div class="ws-title">设置中心</div>
                                <div style="margin-bottom:15px;">绑定角色 ID: <input id="s-id" value="${state.charId || ''}" style="width:100px;"></div>
                                <div style="margin-bottom:15px;">背景图 URL: <input id="s-bg" value="${state.bg}" style="width:100px;"></div>
                                <div style="margin-bottom:15px;">便利贴图 URL: <input id="s-nbg" value="${state.noteBg}" style="width:100px;"></div>
                                <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
                                    <button class="ws-btn-primary" id="s-ok">保存设置 (不刷新)</button>
                                    <button class="ws-btn-grey" onclick="roche.ui.closeApp()">退出空间 (退出插件)</button>
                                    <button class="ws-btn-grey" style="color:red;" onclick="if(confirm('清空所有数据吗？')){roche.storage.delete('diaries');roche.storage.delete('whispers');roche.storage.delete('anons');location.reload();}">清空数据</button>
                                </div>
                            </div>
                        `;
                        body.querySelector('#s-ok').onclick = async () => {
                            state.charId = body.querySelector('#s-id').value;
                            state.bg = body.querySelector('#s-bg').value;
                            state.noteBg = body.querySelector('#s-nbg').value;
                            await roche.storage.set('boundCharId', state.charId);
                            await roche.storage.set('bgUrl', state.bg);
                            await roche.storage.set('noteBgUrl', state.noteBg);
                            roche.ui.toast("设置已保存 (。・ω・。) ");
                            render();
                        };
                    }
                };

                render();
            },
            async unmount(container) { container.replaceChildren(); }
        }]
    });
})();