(function() {
    const PLUGIN_ID = 'whisper-space-pro';

    // === 1. 样式表 (包含液态玻璃、手写纸张、便利贴) ===
    const styles = `
        .ws-root {
            --primary-pink: #ffb7c5;
            --glass: rgba(255, 255, 255, 0.4);
            position: absolute; inset: 0;
            background-size: cover; background-position: center;
            display: flex; flex-direction: column; overflow: hidden;
            font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
        }
        .ws-nav {
            position: absolute; bottom: 25px; left: 50%; transform: translateX(-50%);
            width: 90%; height: 65px; background: var(--glass); backdrop-filter: blur(20px) saturate(180%);
            border-radius: 35px; border: 1px solid rgba(255,255,255,0.4);
            display: flex; justify-content: space-around; align-items: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1); z-index: 100;
        }
        .ws-nav-item { font-size: 24px; cursor: pointer; transition: 0.3s; display: flex; flex-direction: column; align-items: center; color: #444; }
        .ws-nav-item.active { color: #ff6b81; transform: scale(1.15) translateY(-5px); }
        .ws-nav-label { font-size: 10px; margin-top: 2px; }

        .ws-main { flex: 1; padding: 20px; overflow-y: auto; padding-bottom: 110px; scrollbar-width: none; }
        .ws-main::-webkit-scrollbar { display: none; }

        /* 日记页 */
        .ws-paper {
            background: #fff; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.08);
            min-height: 300px; padding: 25px; margin-bottom: 20px;
            background-image: repeating-linear-gradient(transparent, transparent 30px, #f2f2f2 31px);
            line-height: 31px; position: relative;
        }
        .ws-title { font-size: 18px; font-weight: bold; border-bottom: 3px solid #ffb7c5; display: inline-block; margin-bottom: 15px; color: #333; }
        .ws-handwritten { font-family: var(--ws-font, inherit); color: #444; white-space: pre-wrap; font-size: 16px; }

        /* 便利贴墙 */
        .ws-wall { display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; }
        .ws-note {
            width: 145px; height: 145px; padding: 15px; position: relative; box-shadow: 3px 3px 10px rgba(0,0,0,0.1);
            font-size: 13px; line-height: 1.5; overflow: hidden; font-family: var(--ws-font, inherit);
        }
        .ws-note-1 { background: #ffcfdf; transform: rotate(-2deg); }
        .ws-note-2 { background: #feff9c; transform: rotate(3deg); }
        .ws-note-3 { background: #7afcff; transform: rotate(-1deg); }

        /* 匿名箱与按钮 */
        .ws-card { background: rgba(255,255,255,0.85); border-radius: 20px; padding: 18px; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .ws-thought { margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.04); border-radius: 10px; font-style: italic; font-size: 12px; color: #6a6a6a; border-left: 3px solid #ff6b81; }
        .ws-btn { background: #ff6b81; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: bold; }
        .ws-input { width: 100%; border: none; background: transparent; font-size: 16px; outline: none; resize: none; }
        
        .ws-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
    `;

    // === 2. 后台生成逻辑 (核心：读取100条记忆) ===
    async function getAIGeneratedAction(roche, char, userPrompt) {
        // 读取最近100条聊天记录
        const messages = await roche.memory.getShortTerm({
            conversationId: char.conversationId,
            limit: 100
        });

        const history = messages.map(m => `${m.senderHandle || m.senderName}: ${m.text}`).join('\n');

        const systemPrompt = `
            你现在是${char.name}。
            人设设定：${char.persona || char.bio || "无"}
            
            【最近100条聊天背景】
            ${history || "暂无记录"}

            【你的任务】
            ${userPrompt}

            要求：
            1. 必须基于你们最近的聊天氛围！如果聊天里有暧昧、争吵或特定的事，要在内容里体现出来。
            2. 不要复读，要写出由于最近的互动，你心里产生的新想法。
            3. 如果是匿名提问，要带上你性格里的一点点“破绽”。
        `;

        const res = await roche.ai.chat({
            messages: [{ role: 'system', content: systemPrompt }]
        });
        return res.text;
    }

    async function startDaemon(roche) {
        if (window._wsDaemonActive) return;
        window._wsDaemonActive = true;

        const loop = async () => {
            const config = await roche.storage.get('config') || { mode: 'background', interval: 30 };
            const charId = await roche.storage.get('boundCharId');
            if (!charId || config.mode !== 'background') return;

            // 15% 概率触发
            if (Math.random() < 0.15) {
                const char = await roche.character.get(charId);
                const diaries = await roche.storage.get('diaries') || [];
                const res = await getAIGeneratedAction(roche, char, "请在[DIARY]日记、[ANON]匿名提问、[WHISPER]悄悄话中选一个进行创作。内容开头请标注类型。");

                if (res.includes('[DIARY]')) {
                    diaries.push({ sender: 'char', text: res.replace('[DIARY]', '').trim(), time: Date.now() });
                    await roche.storage.set('diaries', diaries);
                } else if (res.includes('[ANON]')) {
                    const anons = await roche.storage.get('anons') || [];
                    anons.unshift({ id: crypto.randomUUID(), question: res.replace('[ANON]', '').trim(), isFromChar: true, time: Date.now() });
                    await roche.storage.set('anons', anons);
                }

                await roche.memory.write({
                    conversationId: char.conversationId,
                    summaryText: `${char.name}由于受最近聊天记录的影响，在私语空间里产生了一次自主互动。`,
                    source: PLUGIN_ID
                });
            }
            setTimeout(loop, config.interval * 60 * 1000);
        };
        loop();
    }

    // === 3. 插件 App 定义 ===
    const plugin = {
        id: PLUGIN_ID,
        name: "私语空间 Pro",
        version: "2.1.0",
        apps: [{
            id: "whisper-space-main",
            name: "私语空间",
            icon: "favorite",
            async mount(container, roche) {
                const styleEl = document.createElement('style');
                styleEl.innerHTML = styles;
                document.head.appendChild(styleEl);

                let state = {
                    view: 'diary',
                    charId: await roche.storage.get('boundCharId'),
                    config: await roche.storage.get('config') || { mode: 'background', interval: 30 },
                    bg: await roche.storage.get('bgUrl') || 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=1000',
                    font: await roche.storage.get('fontUrl') || '',
                    diaries: await roche.storage.get('diaries') || [],
                    whispers: await roche.storage.get('whispers') || [],
                    anons: await roche.storage.get('anons') || []
                };

                startDaemon(roche);

                // 加载自定义字体
                if (state.font) {
                    const f = new FontFace('WSFont', `url(${state.font})`);
                    f.load().then(loaded => { document.fonts.add(loaded); document.documentElement.style.setProperty('--ws-font', 'WSFont'); });
                }

                const refresh = () => {
                    container.innerHTML = `
                        <div class="ws-root" style="background-image: url('${state.bg}');">
                            <div class="ws-main" id="ws-body"></div>
                            <div class="ws-nav">
                                <div class="ws-nav-item ${state.view==='diary'?'active':''}" onclick="window._wsTab('diary')">📖<span class="ws-nav-label">日记</span></div>
                                <div class="ws-nav-item ${state.view==='whisper'?'active':''}" onclick="window._wsTab('whisper')">💬<span class="ws-nav-label">私语</span></div>
                                <div class="ws-nav-item ${state.view==='anon'?'active':''}" onclick="window._wsTab('anon')">📮<span class="ws-nav-label">信箱</span></div>
                                <div class="ws-nav-item ${state.view==='set'?'active':''}" onclick="window._wsTab('set')">⚙️<span class="ws-nav-label">设置</span></div>
                            </div>
                        </div>
                    `;
                    window._wsTab = (v) => { state.view = v; refresh(); };
                    renderBody();
                };

                const renderBody = async () => {
                    const body = container.querySelector('#ws-body');
                    if (!state.charId && state.view !== 'set') {
                        const chars = await roche.character.list();
                        body.innerHTML = `<h3 style="color:white; text-align:center; margin-top:50px;">点击头像开始交换日记</h3>
                            <div class="ws-wall" style="margin-top:20px;">
                                ${chars.map(c => `<div class="ws-card" style="cursor:pointer; width:90px; text-align:center;" onclick="window._wsBind('${c.id}')">
                                    <img src="${c.avatar}" style="width:50px; height:50px; border-radius:50%;"><p style="font-size:12px;">${c.handle || c.name}</p>
                                </div>`).join('')}
                            </div>`;
                        window._wsBind = async (id) => { state.charId = id; await roche.storage.set('boundCharId', id); refresh(); };
                        return;
                    }

                    if (state.view === 'diary') {
                        body.innerHTML = `
                            <div class="ws-paper">
                                <div class="ws-title">我的记录</div>
                                <textarea id="di-in" class="ws-input" style="height:180px;" placeholder="今天聊得怎么样..."></textarea>
                                <button class="ws-btn" id="save-di">合上日记</button>
                            </div>
                            ${state.diaries.filter(d => d.sender === 'char').reverse().map(d => `
                                <div class="ws-paper">
                                    <div class="ws-title">他的私密心事</div>
                                    <div class="ws-handwritten">${d.text}</div>
                                    <div style="font-size:10px; color:#999; margin-top:10px;">${new Date(d.time).toLocaleString()}</div>
                                </div>
                            `).join('')}
                        `;
                        body.querySelector('#save-di').onclick = async () => {
                            const val = body.querySelector('#di-in').value; if (!val) return;
                            state.diaries.push({ sender: 'user', text: val, time: Date.now() });
                            await roche.storage.set('diaries', state.diaries);
                            roche.ui.toast("已存档");
                            if (state.config.mode === 'immediate') {
                                roche.ui.toast("他正在根据聊天记忆回应...");
                                const char = await roche.character.get(state.charId);
                                const res = await getAIGeneratedAction(roche, char, `用户刚写了日记：${val}。请写出你的日记回应。`);
                                state.diaries.push({ sender: 'char', text: res, time: Date.now() });
                                await roche.storage.set('diaries', state.diaries);
                                refresh();
                            }
                        };
                    } 
                    else if (state.view === 'whisper') {
                        body.innerHTML = `<div class="ws-wall">${state.whispers.map(w => `<div class="ws-note ws-note-${w.c}">${w.t}<div style="position:absolute; bottom:5px; right:10px; font-size:9px;">— ${w.s}</div></div>`).join('')}</div>
                            <button class="ws-btn" style="position:fixed; bottom:100px; right:30px;" id="add-wh">+ 贴一张</button>`;
                        body.querySelector('#add-wh').onclick = async () => {
                            const t = prompt("悄悄话："); if (!t) return;
                            const w = { s: '我', t, c: Math.floor(Math.random()*3)+1, time: Date.now() };
                            state.whispers.push(w); await roche.storage.set('whispers', state.whispers); refresh();
                        };
                    }
                    else if (state.view === 'anon') {
                        body.innerHTML = `
                            <button class="ws-btn" style="width:100%; margin-bottom:15px;" id="ai-an">让AI派送他的匿名信 (基于100条聊天)</button>
                            ${state.anons.map(a => `
                                <div class="ws-card">
                                    <div style="font-size:11px; color:#888;">📬 匿名投递：</div>
                                    <div style="margin:5px 0;">${a.question}</div>
                                    ${a.answer ? `
                                        <div style="color:#ff6b81; border-top:1px solid #eee; padding-top:8px;">💬 我的回答：${a.answer}</div>
                                        ${a.thought ? `<div class="ws-thought">窥视内心：${a.thought}</div>` : `<button class="ws-btn" style="padding:4px 8px; font-size:10px; background:#aaa; margin-top:5px;" onclick="window._wsPeek('${a.id}')">窥视他的第一反应</button>`}
                                    ` : `<textarea id="ans-${a.id}" class="ws-input" placeholder="输入回答..."></textarea><button class="ws-btn" onclick="window._wsDoAns('${a.id}')">回答</button>`}
                                </div>
                            `).join('')}
                        `;
                        window._wsDoAns = async (id) => {
                            const ans = body.querySelector(`#ans-${id}`).value; if (!ans) return;
                            const idx = state.anons.findIndex(x => x.id === id);
                            state.anons[idx].answer = ans;
                            await roche.storage.set('anons', state.anons); refresh();
                        };
                        window._wsPeek = async (id) => {
                            const idx = state.anons.findIndex(x => x.id === id);
                            const char = await roche.character.get(state.charId);
                            const res = await getAIGeneratedAction(roche, char, `你刚才发的匿名提问是：“${state.anons[idx].question}”，用户回答了：“${state.anons[idx].answer}”。请写出你最真实的内心OS。`);
                            state.anons[idx].thought = res;
                            await roche.storage.set('anons', state.anons); refresh();
                        };
                        body.querySelector('#ai-an').onclick = async () => {
                            roche.ui.toast("正在读取百条记忆中...");
                            const char = await roche.character.get(state.charId);
                            const res = await getAIGeneratedAction(roche, char, "请伪装成路人投一个带有你性格破绽的匿名提问。");
                            state.anons.unshift({ id: crypto.randomUUID(), question: res, isFromChar: true, time: Date.now() });
                            await roche.storage.set('anons', state.anons); refresh();
                        };
                    }
                    else if (state.view === 'set') {
                        body.innerHTML = `
                            <div class="ws-card">
                                <div class="ws-title">空间控制台</div>
                                <div class="ws-row"><span>模式</span><select id="s-mode"><option value="immediate" ${state.config.mode==='immediate'?'selected':''}>及时回复</option><option value="background" ${state.config.mode==='background'?'selected':''}>后台惊喜</option></select></div>
                                <div class="ws-row"><span>检测频率(分)</span><input type="number" id="s-int" value="${state.config.interval}" style="width:50px;"></div>
                                <div class="ws-row"><span>背景URL</span><input type="text" id="s-bg" value="${state.bg}" style="width:120px;"></div>
                                <div class="ws-row"><span>手写字体URL</span><input type="text" id="s-font" value="${state.font}" style="width:120px;"></div>
                                <button class="ws-btn" style="width:100%; margin-top:20px;" id="s-save">应用更改</button>
                                <button class="ws-btn" style="width:100%; margin-top:10px; background:#999;" onclick="roche.ui.closeApp()">退出空间</button>
                                <button class="ws-btn" style="width:100%; margin-top:10px; background:#e74c3c;" onclick="if(confirm('重置将清空所有日记！')){roche.storage.delete('diaries');location.reload();}">清空数据</button>
                            </div>
                        `;
                        body.querySelector('#s-save').onclick = async () => {
                            state.config.mode = body.querySelector('#s-mode').value;
                            state.config.interval = parseInt(body.querySelector('#s-int').value);
                            state.bg = body.querySelector('#s-bg').value;
                            state.font = body.querySelector('#s-font').value;
                            await roche.storage.set('config', state.config);
                            await roche.storage.set('bgUrl', state.bg);
                            await roche.storage.set('fontUrl', state.font);
                            roche.ui.toast("保存成功，重新加载中...");
                            location.reload();
                        };
                    }
                };

                refresh();
            },
            async unmount(container) { container.replaceChildren(); }
        }]
    };

    window.RochePlugin.register(plugin);
})();