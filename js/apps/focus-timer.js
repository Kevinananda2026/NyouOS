/**
 * 专注计时器（Pomodoro 番茄钟）应用
 *
 * 纯本地实现：
 * - 番茄工作法：专注 → 短休息 → 长休息，自动循环
 * - 圆形进度环倒计时 + 开始/暂停/重置
 * - 完成时系统通知 + 本地合成提示音（Web Audio，无音频文件）
 * - 学习统计按天记录，保存在 localStorage（不联网、无账号）
 * - 任务栏时间区显示专注剩余时间徽章
 *
 * 全局对象：FocusTimerApp（单例，由 WindowManager 挂载）
 */
const FocusTimerApp = {
    windowId: null,
    container: null,
    frame: null,

    // 时长设置（秒）
    durations: { focus: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 },
    longBreakInterval: 4, // 每 4 个专注轮次后进入长休息

    // 运行状态
    phase: 'focus', // 'focus' | 'shortBreak' | 'longBreak'
    state: 'idle', // 'idle' | 'running' | 'paused'
    phaseSecondsTotal: 0,
    phaseRemaining: 0,
    completedFocusInCycle: 0, // 本轮已完成专注次数
    focusSessionTotal: 0,     // 总专注轮次（用于统计展示）

    // 定时器
    ticker: null,
    lastTickAt: 0,

    // 统计（localStorage: focus-timer-stats）
    stats: { day: '', completedToday: 0, totalCompleted: 0 },

    _unsubscribeLanguage: null,
    _titleInterval: null,

    init(windowId) {
        this.windowId = windowId || `window-${Date.now()}`;
        this.container = document.getElementById(`${this.windowId}-content`);
        this.loadStats();
        this.restoreRunningState();
        if (this.phaseRemaining <= 0) this.startPhase('focus', false);
        this.render();

        this._unsubscribeLanguage?.();
        this._unsubscribeLanguage = State.on('languageChange', () => {
            if (this.container?.isConnected) this.render();
        });
    },

    openData() {
        this.render();
    },

    beforeClose() {
        // 计时不随窗口关闭而停止：持久化剩余时间与到期时间戳
        this.persistRunningState();
        this._stopTicker();
        this._clearTitleTimer();
        if (this.frame && typeof this.frame.destroy === 'function') {
            this.frame.destroy();
            this.frame = null;
        }
        this._unsubscribeLanguage?.();
        this._unsubscribeLanguage = null;
        this.container = null;
        this.windowId = null;
        return true;
    },

    // ---------- 持久化（设置 + 统计都走 Storage） ----------
    loadStats() {
        const saved = Storage.get('focus-timer-settings', null);
        if (saved?.durations) {
            this.durations = {
                focus: this._clampMinutes(saved.durations.focus, 5, 120) * 60,
                shortBreak: this._clampMinutes(saved.durations.shortBreak, 1, 60) * 60,
                longBreak: this._clampMinutes(saved.durations.longBreak, 1, 120) * 60
            };
        }
        const stats = Storage.get('focus-timer-stats', null);
        if (stats) {
            this.stats = {
                day: String(stats.day || ''),
                completedToday: Number(stats.completedToday) || 0,
                totalCompleted: Number(stats.totalCompleted) || 0
            };
        }
        this._ensureStatsDay();
    },

    saveSettings() {
        Storage.set('focus-timer-settings', { durations: { ...this.durations } });
    },

    _clampMinutes(value, min, max) {
        const n = Number(value);
        if (!Number.isFinite(n)) return min;
        return Math.max(min, Math.min(max, Math.round(n)));
    },

    _todayKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    _ensureStatsDay() {
        const today = this._todayKey();
        if (this.stats.day !== today) {
            this.stats = { day: today, completedToday: 0, totalCompleted: this.stats.totalCompleted || 0 };
        }
    },

    saveStats() {
        Storage.set('focus-timer-stats', this.stats);
    },

    // 运行中状态跨窗口开关持久化（关闭窗口再打开可继续计时）
    _persistKey() {
        return 'focus-timer-running';
    },

    persistRunningState() {
        if (this.state !== 'running') {
            Storage.remove(this._persistKey());
            this._clearTaskbarBadge();
            return;
        }
        Storage.set(this._persistKey(), {
            phase: this.phase,
            phaseSecondsTotal: this.phaseSecondsTotal,
            phaseRemaining: Math.max(0, this.phaseRemaining),
            completedFocusInCycle: this.completedFocusInCycle,
            focusSessionTotal: this.focusSessionTotal,
            savedAt: Date.now()
        });
        this._updateTaskbarBadge();
    },

    restoreRunningState() {
        const saved = Storage.get(this._persistKey(), null);
        if (!saved || saved.phaseSecondsTotal <= 0) return;
        const elapsed = Math.floor((Date.now() - (Number(saved.savedAt) || 0)) / 1000);
        const remaining = (Number(saved.phaseRemaining) || 0) - elapsed;
        if (remaining > 0) {
            this.phase = saved.phase;
            this.phaseSecondsTotal = saved.phaseSecondsTotal;
            this.phaseRemaining = remaining;
            this.completedFocusInCycle = Number(saved.completedFocusInCycle) || 0;
            this.focusSessionTotal = Number(saved.focusSessionTotal) || 0;
            this.state = 'running';
            this._startTicker();
            this._updateTaskbarBadge();
        } else {
            // 期间已到期：直接结算
            Storage.remove(this._persistKey());
            this._handlePhaseComplete();
        }
    },

    // ---------- 计时核心 ----------
    startPhase(phase, autoStart = true) {
        this.phase = phase;
        const seconds = phase === 'focus' ? this.durations.focus
            : phase === 'shortBreak' ? this.durations.shortBreak
            : this.durations.longBreak;
        this.phaseSecondsTotal = seconds;
        this.phaseRemaining = seconds;
        this.state = autoStart ? 'running' : 'idle';
        if (autoStart) {
            this._startTicker();
        } else {
            this._stopTicker();
        }
        this._updateTaskbarBadge();
        this._updateTitleTimer();
        if (this.container?.isConnected) this.render();
    },

    start() {
        if (this.state === 'running') return;
        if (this.state === 'idle' || this.state === 'paused') {
            if (this.phaseRemaining <= 0) this.startPhase(this.phase, false);
            this.state = 'running';
            this._startTicker();
            this._updateTaskbarBadge();
            this._updateTitleTimer();
            if (this.container?.isConnected) this.render();
        }
    },

    pause() {
        if (this.state !== 'running') return;
        this.state = 'paused';
        this._stopTicker();
        this.persistRunningState();
        this._clearTaskbarBadge();
        this._clearTitleTimer();
        if (this.container?.isConnected) this.render();
    },

    reset() {
        this._stopTicker();
        this.state = 'idle';
        this.completedFocusInCycle = 0;
        this.focusSessionTotal = 0;
        this.startPhase('focus', false);
        Storage.remove(this._persistKey());
        this._clearTaskbarBadge();
        this._clearTitleTimer();
        if (this.container?.isConnected) this.render();
    },

    _startTicker() {
        this._stopTicker();
        this.lastTickAt = Date.now();
        this.ticker = setInterval(() => this._tick(), 500);
        this._tick();
    },

    _stopTicker() {
        if (this.ticker) {
            clearInterval(this.ticker);
            this.ticker = null;
        }
    },

    _tick() {
        const now = Date.now();
        const elapsed = Math.floor((now - this.lastTickAt) / 1000);
        if (elapsed <= 0) return;
        this.lastTickAt = now;
        this.phaseRemaining = Math.max(0, this.phaseRemaining - elapsed);
        this._updateTaskbarBadge();
        if (this.phaseRemaining <= 0) {
            this._handlePhaseComplete();
        } else if (this.container?.isConnected) {
            this._updateDisplay();
        }
    },

    _handlePhaseComplete() {
        this._stopTicker();
        this._playCompletionSound();

        if (this.phase === 'focus') {
            this.completedFocusInCycle += 1;
            this.focusSessionTotal += 1;
            this._ensureStatsDay();
            this.stats.completedToday += 1;
            this.stats.totalCompleted += 1;
            this.saveStats();

            if (this.completedFocusInCycle >= this.longBreakInterval) {
                this._notifyPhaseDone('focus');
                this.startPhase('longBreak');
            } else {
                this._notifyPhaseDone('focus');
                this.startPhase('shortBreak');
            }
        } else {
            this._notifyPhaseDone(this.phase);
            if (this.phase === 'longBreak') this.completedFocusInCycle = 0;
            this.startPhase('focus');
        }
    },

    _notifyPhaseDone(finishedPhase) {
        if (finishedPhase === 'focus') {
            State.addNotification({
                title: t('focusTimer.notification-title'),
                message: t('focusTimer.notification-focus-done'),
                type: 'success'
            });
        } else {
            State.addNotification({
                title: t('focusTimer.notification-title'),
                message: t('focusTimer.notification-break-done'),
                type: 'info'
            });
        }
        this._updateTitleTimer();
    },

    // 本地合成提示音（两短一长，表示"时间到"），不依赖任何音频文件
    _playCompletionSound() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const play = (freq, startAt, dur) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
                gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + startAt + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + dur);
                osc.connect(gain).connect(ctx.destination);
                osc.start(ctx.currentTime + startAt);
                osc.stop(ctx.currentTime + startAt + dur + 0.05);
            };
            play(880, 0, 0.18);
            play(880, 0.25, 0.18);
            play(1318, 0.5, 0.4);
            setTimeout(() => ctx.close().catch(() => {}), 2000);
        } catch (_) {
            // 音频不可用时静默跳过，通知仍会显示
        }
    },

    // ---------- 任务栏徽章与窗口标题 ----------
    _updateTaskbarBadge() {
        const el = document.getElementById('taskbar-focus-badge');
        if (!el) return;
        if (this.state === 'running' && this.phase === 'focus' && this.phaseRemaining > 0) {
            el.textContent = this._formatClock(this.phaseRemaining);
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    },

    _clearTaskbarBadge() {
        const el = document.getElementById('taskbar-focus-badge');
        if (el) el.style.display = 'none';
    },

    _clearTitleTimer() {
        if (this._titleInterval) {
            clearInterval(this._titleInterval);
            this._titleInterval = null;
        }
    },

    _updateTitleTimer() {
        this._clearTitleTimer();
        const original = document.title || 'NyouOS';
        const self = this;
        const render = () => {
            if (self.state === 'running') {
                const phaseLabel = self.phase === 'focus'
                    ? t('focusTimer.phase-focus')
                    : (self.phase === 'longBreak' ? t('focusTimer.phase-long') : t('focusTimer.phase-short'));
                document.title = `⏳ ${self._formatClock(self.phaseRemaining)} ${phaseLabel} - ${original}`;
            } else {
                document.title = original;
            }
        };
        render();
        this._titleInterval = setInterval(render, 1000);
    },

    _formatClock(totalSeconds) {
        const s = Math.max(0, Math.floor(totalSeconds));
        const m = String(Math.floor(s / 60)).padStart(2, '0');
        const sec = String(s % 60).padStart(2, '0');
        return `${m}:${sec}`;
    },

    // ---------- 渲染 ----------
    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        if (this.frame && typeof this.frame.destroy === 'function') {
            this.frame.destroy();
            this.frame = null;
        }

        if (typeof FluentUI === 'undefined' || typeof FluentUI.createPage !== 'function') {
            // 无 FluentWindow 框架时的简写降级（与其他应用保持一致的健壮性）
            this.container.classList.add('focus-timer-app');
            this._renderBody(this.container);
            this.addStyles();
            this.bindEvents();
            return;
        }

        this.container.classList.add('focus-timer-app');
        this._renderBody(this.container);
        this.addStyles();
        this.bindEvents();
        if (this.state === 'running') this._updateTaskbarBadge();
    },

    _renderBody(root) {
        const phaseLabels = {
            focus: t('focusTimer.phase-focus'),
            shortBreak: t('focusTimer.phase-short'),
            longBreak: t('focusTimer.phase-long')
        };
        const dots = Array.from({ length: this.longBreakInterval }, (_, i) =>
            `<span class="ft-dot${i < this.completedFocusInCycle ? ' on' : ''}"></span>`
        ).join('');

        root.innerHTML = `
            <div class="ft-main">
                <div class="ft-phase-strip">
                    <button class="ft-phase-chip${this.phase === 'focus' ? ' active' : ''}" data-phase="focus" type="button">
                        <img src="Theme/Icon/Symbol_icon/fill/Timer.svg" alt="">${phaseLabels.focus}
                    </button>
                    <button class="ft-phase-chip${this.phase === 'shortBreak' ? ' active' : ''}" data-phase="shortBreak" type="button">
                        <img src="Theme/Icon/Symbol_icon/stroke/Refresh.svg" alt="">${phaseLabels.shortBreak}
                    </button>
                    <button class="ft-phase-chip${this.phase === 'longBreak' ? ' active' : ''}" data-phase="longBreak" type="button">
                        <img src="Theme/Icon/Symbol_icon/fill/Clock.svg" alt="">${phaseLabels.longBreak}
                    </button>
                </div>

                <div class="ft-circle-wrap">
                    <svg class="ft-ring" viewBox="0 0 200 200" aria-hidden="true">
                        <circle class="ft-ring-bg" cx="100" cy="100" r="90" fill="none" stroke-width="10"/>
                        <circle class="ft-ring-fg" cx="100" cy="100" r="90" fill="none" stroke-width="10"
                                stroke-linecap="round" transform="rotate(-90 100 100)"/>
                    </svg>
                    <div class="ft-circle-center">
                        <div class="ft-time" id="ft-time-display">${this._formatClock(this.phaseRemaining)}</div>
                        <div class="ft-state-label" id="ft-state-label">
                            ${this.state === 'idle' ? t('focusTimer.idle')
                                : this.state === 'paused' ? t('clock.pause')
                                : t('focusTimer.running')}
                        </div>
                    </div>
                </div>

                <div class="ft-controls">
                    <button class="ft-action-btn primary" id="ft-toggle-btn" type="button">
                        <img src="${this.state === 'running' ? 'Theme/Icon/Symbol_icon/fill/Pause.svg' : 'Theme/Icon/Symbol_icon/fill/Play.svg'}" alt="">
                        <span>${this.state === 'running' ? t('clock.pause') : (this.state === 'paused' ? t('clock.continue') : t('clock.start'))}</span>
                    </button>
                    <button class="ft-action-btn" id="ft-reset-btn" type="button">
                        <img src="Theme/Icon/Symbol_icon/stroke/Refresh.svg" alt="">
                        <span>${t('clock.reset')}</span>
                    </button>
                </div>

                <div class="ft-cycle">
                    <span class="ft-cycle-label">${t('focusTimer.cycle')}</span>
                    <div class="ft-cycle-dots">${dots}</div>
                </div>

                <div class="ft-stats-row">
                    <div class="ft-stat-card">
                        <div class="ft-stat-value">${this.stats.completedToday}</div>
                        <div class="ft-stat-label">${t('focusTimer.stat-today')}</div>
                    </div>
                    <div class="ft-stat-card">
                        <div class="ft-stat-value">${this.stats.totalCompleted}</div>
                        <div class="ft-stat-label">${t('focusTimer.stat-total')}</div>
                    </div>
                </div>

                <div class="ft-settings">
                    <div class="ft-settings-title-row">
                        <img src="Theme/Icon/Symbol_icon/stroke/Settings.svg" alt="">
                        <span>${t('focusTimer.settings')}</span>
                        <button class="ft-mini-btn" id="ft-save-settings" type="button">${t('clock.done')}</button>
                    </div>
                    <div class="ft-settings-grid">
                        <label class="ft-setting">
                            <span>${t('focusTimer.focus-duration')}</span>
                            <input type="number" id="ft-dur-focus" min="5" max="120" step="1"
                                   value="${Math.round(this.durations.focus / 60)}">
                        </label>
                        <label class="ft-setting">
                            <span>${t('focusTimer.short-duration')}</span>
                            <input type="number" id="ft-dur-short" min="1" max="60" step="1"
                                   value="${Math.round(this.durations.shortBreak / 60)}">
                        </label>
                        <label class="ft-setting">
                            <span>${t('focusTimer.long-duration')}</span>
                            <input type="number" id="ft-dur-long" min="1" max="120" step="1"
                                   value="${Math.round(this.durations.longBreak / 60)}">
                        </label>
                    </div>
                </div>
            </div>
        `;

        this._updateRing();
    },

    _updateRing() {
        const ring = this.container?.querySelector('.ft-ring-fg');
        if (!ring || this.phaseSecondsTotal <= 0) return;
        const C = 2 * Math.PI * 90;
        const progress = Math.max(0, Math.min(1, this.phaseRemaining / this.phaseSecondsTotal));
        ring.style.strokeDasharray = String(C);
        ring.style.strokeDashoffset = String(C * (1 - progress));
        // 专注时强调色，休息时绿色
        ring.style.stroke = this.phase === 'focus' ? 'var(--accent)' : '#107c10';
        const timeEl = this.container?.querySelector('#ft-time-display');
        if (timeEl) timeEl.textContent = this._formatClock(this.phaseRemaining);
    },

    _updateDisplay() {
        if (!this.container?.isConnected) return;
        this._updateRing();
        const label = this.container.querySelector('#ft-state-label');
        if (label) {
            label.textContent = this.state === 'running' ? t('focusTimer.running')
                : this.state === 'paused' ? t('clock.pause') : t('focusTimer.idle');
        }
        const toggle = this.container.querySelector('#ft-toggle-btn');
        if (toggle) {
            const img = toggle.querySelector('img');
            const span = toggle.querySelector('span');
            if (img) img.src = this.state === 'running'
                ? 'Theme/Icon/Symbol_icon/fill/Pause.svg'
                : 'Theme/Icon/Symbol_icon/fill/Play.svg';
            if (span) span.textContent = this.state === 'running' ? t('clock.pause')
                : (this.state === 'paused' ? t('clock.continue') : t('clock.start'));
        }
        this._updateTaskbarBadge();
    },

    addStyles() {
        if (document.getElementById('focus-timer-app-styles')) return;
        const style = document.createElement('style');
        style.id = 'focus-timer-app-styles';
        style.textContent = `
            .focus-timer-app {
                display: flex;
                height: 100%;
                overflow-y: auto;
                padding: 24px;
                box-sizing: border-box;
            }
            .ft-main {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 18px;
            }
            /* 阶段切换 */
            .ft-phase-strip { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
            .ft-phase-chip {
                display: inline-flex; align-items: center; gap: 6px;
                padding: 6px 14px; border-radius: 999px;
                border: 1px solid var(--border, rgba(0,0,0,.08));
                background: var(--surface-2, #f0f0f0);
                font-size: 13px; cursor: pointer; transition: .18s;
                color: inherit;
            }
            .ft-phase-chip img { width: 14px; height: 14px; }
            .ft-phase-chip.active {
                background: var(--accent); color: var(--accent-contrast, #fff);
                border-color: transparent;
            }
            .ft-phase-chip:not(.active):hover { background: var(--surface-2, #e8e8e8); }

            /* 圆环倒计时 */
            .ft-circle-wrap { position: relative; width: 220px; height: 220px; }
            .ft-ring { width: 100%; height: 100%; display: block; }
            .ft-ring-bg { stroke: var(--surface-2, rgba(0,0,0,.08)); }
            .ft-ring-fg { stroke: var(--accent); transition: stroke-dashoffset .5s linear; }
            .ft-circle-center {
                position: absolute; inset: 0;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
            }
            .ft-time { font-size: 52px; font-weight: 700; letter-spacing: 1px; font-variant-numeric: tabular-nums; }
            .ft-state-label { font-size: 14px; opacity: .7; margin-top: 2px; }

            /* 控制按钮 */
            .ft-controls { display: flex; gap: 12px; }
            .ft-action-btn {
                display: inline-flex; align-items: center; gap: 8px;
                padding: 10px 22px; border-radius: 10px; border: 1px solid var(--border, rgba(0,0,0,.08));
                background: var(--surface, #fff); cursor: pointer; font-size: 14px; transition: .18s;
                color: inherit;
            }
            .ft-action-btn img { width: 16px; height: 16px; }
            .ft-action-btn:hover { background: var(--surface-2, #f0f0f0); }
            .ft-action-btn.primary { background: var(--accent); color: var(--accent-contrast, #fff); border-color: transparent; }
            .ft-action-btn.primary:hover { filter: brightness(1.08); }

            /* 循环指示 */
            .ft-cycle { display: flex; align-items: center; gap: 10px; }
            .ft-cycle-label { font-size: 13px; opacity: .7; }
            .ft-cycle-dots { display: flex; gap: 6px; }
            .ft-dot {
                width: 10px; height: 10px; border-radius: 999px;
                background: var(--surface-2, rgba(0,0,0,.12)); transition: .2s;
            }
            .ft-dot.on { background: var(--accent); }

            /* 统计 */
            .ft-stats-row { display: flex; gap: 14px; }
            .ft-stat-card {
                min-width: 110px; padding: 14px 18px; border-radius: 12px;
                background: var(--surface, #fff); border: 1px solid var(--border, rgba(0,0,0,.08));
                text-align: center;
            }
            .ft-stat-value { font-size: 26px; font-weight: 700; color: var(--accent); }
            .ft-stat-label { font-size: 12px; opacity: .7; margin-top: 2px; }

            /* 设置 */
            .ft-settings {
                width: 100%; max-width: 420px;
                border: 1px solid var(--border, rgba(0,0,0,.08));
                background: var(--surface, #fff);
                border-radius: 12px; padding: 14px 16px;
            }
            .ft-settings-title-row {
                display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600;
                margin-bottom: 10px;
            }
            .ft-settings-title-row img { width: 15px; height: 15px; }
            .ft-settings-title-row .ft-mini-btn {
                margin-left: auto; border: none; background: transparent;
                color: var(--accent); font-size: 13px; cursor: pointer; font-weight: 600;
            }
            .ft-settings-grid {
                display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
            }
            .ft-setting { display: flex; flex-direction: column; gap: 4px; font-size: 12px; opacity: .85; }
            .ft-setting input {
                padding: 7px 9px; border-radius: 8px;
                border: 1px solid var(--border, rgba(0,0,0,.08));
                background: var(--surface-2, #f5f5f5); color: inherit; font-size: 14px;
                width: 100%; box-sizing: border-box;
            }
            @media (max-width: 480px) {
                .ft-settings-grid { grid-template-columns: 1fr; }
                .ft-circle-wrap { width: 190px; height: 190px; }
                .ft-time { font-size: 44px; }
            }
        `;
        document.head.appendChild(style);
    },

    bindEvents() {
        const root = this.container;
        if (!root) return;

        root.querySelectorAll('.ft-phase-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const phase = chip.dataset.phase;
                if (phase === this.phase) return;
                // 切换阶段：保留暂停/运行语义，时长取当前设置
                this.startPhase(phase, this.state === 'running');
            });
        });

        const toggleBtn = root.querySelector('#ft-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                if (this.state === 'running') this.pause();
                else this.start();
            });
        }

        const resetBtn = root.querySelector('#ft-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }

        const saveBtn = root.querySelector('#ft-save-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const focusMin = this._clampMinutes(root.querySelector('#ft-dur-focus').value, 5, 120);
                const shortMin = this._clampMinutes(root.querySelector('#ft-dur-short').value, 1, 60);
                const longMin = this._clampMinutes(root.querySelector('#ft-dur-long').value, 1, 120);
                const wasRunning = this.state === 'running';
                this.durations = { focus: focusMin * 60, shortBreak: shortMin * 60, longBreak: longMin * 60 };
                this.saveSettings();
                if (this.state !== 'running') {
                    this.startPhase(this.phase, false);
                } else {
                    this._stopTicker();
                    this.startPhase(this.phase, true);
                }
                if (this.container?.isConnected) this.render();
                if (typeof FluentUI !== 'undefined' && FluentUI.Toast) {
                    FluentUI.Toast({ title: t('focusTimer.settings-saved'), type: 'success' });
                }
            });
        }
    }
};

if (typeof window !== 'undefined') {
    window.FocusTimerApp = FocusTimerApp;
}
