(() => {
    'use strict';

    console.log('[Botcake Auto] content.js v3.0 loaded');

    // =========================================================
    // CONFIG
    // =========================================================

    const sleep = (ms) =>
        new Promise(resolve => setTimeout(resolve, ms));

    const pad = (n) =>
        String(n).padStart(2, '0');

    const DELAY = {
        FIND_EDITOR: 100,
        AFTER_SCROLL: 400,
        AFTER_FILL: 800,

        AFTER_NEXT: 500,
        SCHEDULE_CHECK: 100,
        SCHEDULE_RETRY: 120,

        POPUP_CHECK: 30,
        AFTER_OPEN: 50,
        AFTER_HOUR: 70,
        AFTER_MINUTE: 80,

        BEFORE_ENTER: 60,
        BETWEEN_ENTER: 100,
        AFTER_ENTER2: 150,

        BEFORE_SAVE: 350,
        SAVE_CHECK: 100,
        SAVE_RETRY: 40
    };

    // =========================================================
    // DATE
    // =========================================================

    function getTodayString() {
        const d = new Date();
        return (
            `${pad(d.getDate())}/` +
            `${pad(d.getMonth() + 1)}/` +
            `${d.getFullYear()}`
        );
    }

    // =========================================================
    // VISIBLE
    // =========================================================

    function isVisible(element) {
        if (!element) return false;
        const r = element.getBoundingClientRect();
        const s = window.getComputedStyle(element);
        return (
            element.isConnected &&
            r.width > 0 &&
            r.height > 0 &&
            s.display !== 'none' &&
            s.visibility !== 'hidden'
        );
    }

    // =========================================================
    // STATUS
    // =========================================================

    function showStatus(text, color = '#74c0fc') {
        let toast = document.getElementById('bc-extension-status');

        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'bc-extension-status';
            toast.style.cssText = `
                position:fixed !important;
                top:20px !important;
                right:20px !important;
                z-index:2147483647 !important;
                min-width:250px !important;
                max-width:420px !important;
                padding:11px 14px !important;
                background:#1a1b1e !important;
                border:1px solid #343a40 !important;
                border-radius:9px !important;
                font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important;
                font-size:12px !important;
                font-weight:600 !important;
                box-shadow:0 5px 20px rgba(0,0,0,.45) !important;
                pointer-events:none !important;
            `;
            document.documentElement.appendChild(toast);
        }

        toast.textContent = text;
        toast.style.color = color;
        toast.style.borderColor = color;
    }

    // =========================================================
    // CLICK
    // =========================================================

    function simulateRealClick(element) {
        if (!element) return false;

        try {
            element.scrollIntoView({
                block: 'center',
                inline: 'nearest'
            });
        } catch (_) {}

        const rect = element.getBoundingClientRect();
        const opts = {
            bubbles: true, cancelable: true, composed: true,
            view: window,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
        };

        try { element.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch (_) {}
        element.dispatchEvent(new MouseEvent('mousedown', opts));
        try { element.dispatchEvent(new PointerEvent('pointerup', opts)); } catch (_) {}
        element.dispatchEvent(new MouseEvent('mouseup', opts));
        element.click();

        return true;
    }

    // =========================================================
    // NORMALIZE
    // =========================================================

    function normalizeText(value) {
        return String(value || '')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\u00a0/g, ' ')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .trim();
    }

    // =========================================================
    // SLATE EDITOR
    // =========================================================

    function findMessageEditor() {
        const editors = [
            ...document.querySelectorAll(
                '.block-card-item .rich-text-editor > div[data-slate-editor="true"][data-slate-node="value"][contenteditable="true"][role="textbox"]'
            )
        ].filter(isVisible);

        if (!editors.length) return null;

        editors.sort((a, b) => {
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            return ra.top - rb.top;
        });

        return editors[0];
    }

    async function waitForMessageEditor() {
        for (let i = 0; i < 100; i++) {
            const editor = findMessageEditor();
            if (editor) return editor;
            await sleep(DELAY.FIND_EDITOR);
        }
        throw new Error('Không tìm thấy ô nhập nội dung');
    }

    // =========================================================
    // FILL MESSAGE
    //
    // execCommand từ isolated world KHÔNG kích hoạt Slate.
    // Phải nhờ background chạy chrome.scripting.executeScript
    // với world: 'MAIN' - giống hệt Console.
    // =========================================================

    async function fillMessage(text) {
        text = String(text || '');

        if (!text.trim()) {
            throw new Error('Nội dung đang trống');
        }

        showStatus('1/4 • Đang tìm ô nội dung...', '#74c0fc');

        let editor = await waitForMessageEditor();

        // Scroll editor vào màn hình
        editor.scrollIntoView({ block: 'center', inline: 'nearest' });
        await sleep(DELAY.AFTER_SCROLL);

        // Re-find sau scroll
        editor = findMessageEditor() || editor;

        showStatus('1/4 • Đang nhập nội dung...', '#74c0fc');

        // Gửi lệnh điền sang MAIN WORLD
        const result = await chrome.runtime.sendMessage({
            action: 'FILL_SLATE_MAIN',
            text
        });

        if (!result || !result.ok) {
            throw new Error(result?.error || 'Không nhập được nội dung');
        }

        await sleep(DELAY.AFTER_FILL);

        // Re-find sau Slate render
        editor = findMessageEditor() || editor;

        // Verify
        const actual = normalizeText(result.actual || editor.innerText);
        const expected = normalizeText(text);

        console.log('[Botcake Auto] Verify:', { expected, actual });

        if (actual !== expected) {
            const simpleActual = actual.replace(/\n+/g, '\n');
            const simpleExpected = expected.replace(/\n+/g, '\n');

            if (simpleActual !== simpleExpected) {
                throw new Error('Nội dung Botcake sau khi nhập không đúng');
            }
        }

        // Blur để commit
        try { editor.blur(); } catch (_) {}
        await sleep(400);

        showStatus('1/4 • ✅ Đã điền nội dung', '#51cf66');
        return true;
    }

    // =========================================================
    // NEXT BUTTON
    // =========================================================

    const NEXT_PATH_START = 'M221.66,133.66l-72,72';

    function findNextButton() {
        // Text "Tiếp theo"
        const buttons = [...document.querySelectorAll('button')];

        const byText = buttons.find(button => {
            if (!isVisible(button) || button.disabled) return false;
            const text = (button.innerText || button.textContent || '')
                .replace(/\s+/g, ' ')
                .trim();
            return text === 'Tiếp theo';
        });

        if (byText) return byText;

        // SVG path
        const paths = document.querySelectorAll('button svg path');

        for (const path of paths) {
            const d = path.getAttribute('d') || '';

            if (d.startsWith(NEXT_PATH_START)) {
                const button = path.closest('button');

                if (button && isVisible(button) && !button.disabled) {
                    return button;
                }
            }
        }

        return null;
    }

    async function clickNext() {
        showStatus('2/4 • Đang tìm Tiếp theo...', '#74c0fc');

        let button = null;

        for (let i = 0; i < 70; i++) {
            button = findNextButton();
            if (button) break;
            await sleep(100);
        }

        if (!button) {
            throw new Error('Không tìm thấy nút Tiếp theo');
        }

        showStatus('2/4 • Đang bấm Tiếp theo...', '#74c0fc');
        simulateRealClick(button);
        await sleep(DELAY.AFTER_NEXT);
    }

    // =========================================================
    // END DATE INPUT
    // =========================================================

    function getEndDateInput() {
        return (
            document.querySelector('input[placeholder="Ngày kết thúc"][date-range="end"]') ||
            document.querySelector('input[date-range="end"]') ||
            document.querySelector('input[placeholder="Ngày kết thúc"]')
        );
    }

    async function waitForEndDateInput() {
        showStatus('3/4 • Chờ màn hình đặt lịch...', '#74c0fc');

        for (let i = 0; i < DELAY.SCHEDULE_RETRY; i++) {
            const input = getEndDateInput();
            if (input && isVisible(input)) return input;
            await sleep(DELAY.SCHEDULE_CHECK);
        }

        throw new Error('Không thấy ô Ngày kết thúc');
    }

    // =========================================================
    // NATIVE VALUE
    // =========================================================

    function setNativeValue(element, value) {
        const descriptor = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value'
        );

        if (descriptor && descriptor.set) {
            descriptor.set.call(element, value);
        } else {
            element.value = value;
        }

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // =========================================================
    // ENTER
    // =========================================================

    function pressEnter(element) {
        if (!element) return;

        const opts = {
            key: 'Enter', code: 'Enter',
            keyCode: 13, which: 13,
            bubbles: true, cancelable: true
        };

        element.dispatchEvent(new KeyboardEvent('keydown', opts));
        element.dispatchEvent(new KeyboardEvent('keypress', opts));
        element.dispatchEvent(new KeyboardEvent('keyup', opts));
    }

    // =========================================================
    // PICKER
    // =========================================================

    function getVisibleDropdown() {
        const dropdowns = [
            ...document.querySelectorAll('.ant-picker-dropdown')
        ];

        return dropdowns.find(
            el =>
                isVisible(el) &&
                !el.classList.contains('ant-picker-dropdown-hidden')
        ) || null;
    }

    // =========================================================
    // SAVE
    // =========================================================

    const SAVE_PATH_START =
        'M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32';

    function findSaveButton() {
        const paths = document.querySelectorAll('svg path');

        for (const path of paths) {
            const d = path.getAttribute('d') || '';

            if (!d.startsWith(SAVE_PATH_START)) continue;

            let btn = path.closest('button');
            if (!btn) btn = path.closest('.ant-btn');
            if (!btn) btn = path.closest('[role="button"]');
            if (!btn) btn = path.closest('a');

            if (btn && isVisible(btn)) return btn;
        }

        return null;
    }

    async function clickSaveButton() {
        await sleep(DELAY.BEFORE_SAVE);

        for (let i = 0; i < DELAY.SAVE_RETRY; i++) {
            const btn = findSaveButton();

            if (btn) {
                if (
                    btn.disabled ||
                    btn.getAttribute('aria-disabled') === 'true'
                ) {
                    await sleep(DELAY.SAVE_CHECK);
                    continue;
                }

                simulateRealClick(btn);
                return true;
            }

            await sleep(DELAY.SAVE_CHECK);
        }

        return false;
    }

    // =========================================================
    // SCHEDULE
    // =========================================================

    async function setSchedule(targetInput, hour, minute, autoSave) {
        const timeStr = `${pad(hour)}:${pad(minute)}`;
        const fullDateTime = `${getTodayString()} ${timeStr}`;

        showStatus(`4/4 • Đang đặt ${timeStr}...`, '#74c0fc');

        targetInput.scrollIntoView({ block: 'center', inline: 'nearest' });
        targetInput.focus();
        setNativeValue(targetInput, fullDateTime);
        await sleep(30);
        simulateRealClick(targetInput);

        // Wait picker
        let dropdown = null;
        for (let i = 0; i < 30; i++) {
            await sleep(DELAY.POPUP_CHECK);
            dropdown = getVisibleDropdown();
            if (dropdown) break;
        }

        if (dropdown) {
            await sleep(DELAY.AFTER_OPEN);

            // Hour
            let hourCell = dropdown.querySelector(
                `.ant-picker-time-panel-column[data-type="hour"] li[data-value="${hour}"]`
            );

            if (!hourCell) {
                hourCell = dropdown.querySelector(
                    `.ant-picker-time-panel-column:nth-child(1) li[data-value="${hour}"]`
                );
            }

            if (hourCell) {
                simulateRealClick(
                    hourCell.querySelector('.ant-picker-time-panel-cell-inner') || hourCell
                );
            }

            await sleep(DELAY.AFTER_HOUR);
            dropdown = getVisibleDropdown() || dropdown;

            // Minute
            let minuteCell = dropdown.querySelector(
                `.ant-picker-time-panel-column[data-type="minute"] li[data-value="${minute}"]`
            );

            if (!minuteCell) {
                minuteCell = dropdown.querySelector(
                    `.ant-picker-time-panel-column:nth-child(2) li[data-value="${minute}"]`
                );
            }

            if (minuteCell) {
                simulateRealClick(
                    minuteCell.querySelector('.ant-picker-time-panel-cell-inner') || minuteCell
                );
            }

            await sleep(DELAY.AFTER_MINUTE);
        }

        // Final value
        targetInput.focus();
        setNativeValue(targetInput, fullDateTime);
        await sleep(DELAY.BEFORE_ENTER);

        // OK 1
        showStatus('4/4 • OK 1...', '#74c0fc');
        pressEnter(targetInput);
        await sleep(DELAY.BETWEEN_ENTER);

        // OK 2
        showStatus('4/4 • OK 2...', '#74c0fc');
        let enterTarget = document.activeElement;

        if (
            !enterTarget ||
            enterTarget === document.body ||
            enterTarget === document.documentElement
        ) {
            targetInput.focus();
            enterTarget = targetInput;
        }

        pressEnter(enterTarget);
        await sleep(DELAY.AFTER_ENTER2);

        if (document.activeElement === targetInput) {
            targetInput.blur();
        }

        // Save
        if (autoSave) {
            showStatus('💾 Đang tự lưu...', '#ffd43b');
            const saved = await clickSaveButton();

            if (!saved) {
                throw new Error('Không tìm thấy nút Save');
            }

            showStatus(`✅ Đã lưu ${fullDateTime}`, '#51cf66');
        } else {
            showStatus(`✅ Đã đặt ${fullDateTime} • Chưa lưu`, '#74c0fc');
        }
    }

    // =========================================================
    // MAIN
    // =========================================================

    let running = false;

    async function execute(message, hour, minute, autoSave) {
        if (running) {
            throw new Error('Botcake đang chạy');
        }

        running = true;

        try {
            hour = Math.max(0, Math.min(23, Number(hour) || 0));
            minute = Math.max(0, Math.min(59, Number(minute) || 0));

            await fillMessage(message);
            await sleep(500);

            await clickNext();

            const targetInput = await waitForEndDateInput();

            await setSchedule(targetInput, hour, minute, Boolean(autoSave));

        } finally {
            running = false;
        }
    }

    // =========================================================
    // MESSAGE
    // =========================================================

    chrome.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {
            if (!message || message.action !== 'EXECUTE_BOTCAKE') return;

            execute(
                message.message,
                message.hour,
                message.minute,
                message.autoSave
            )
                .then(() => sendResponse({ ok: true }))
                .catch(err => {
                    console.error('[Botcake Auto]', err);
                    showStatus(`❌ ${err.message}`, '#ff6b6b');
                    sendResponse({ ok: false, error: err.message });
                });

            return true;
        }
    );

})();