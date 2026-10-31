'use strict';

// =========================================================
// BOTCAKE AUTO - ULTRA FAST
// =========================================================

const sleep = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

const CONFIG = {
    TAB_READY: 180,

    EDITOR_RETRY: 30,
    EDITOR_CHECK: 20,

    AFTER_CLICK: 35,
    AFTER_SELECT: 20,
    AFTER_DELETE: 30,
    AFTER_INPUT: 80,

    AFTER_NEXT: 120,

    SCHEDULE_RETRY: 50,
    SCHEDULE_CHECK: 30,

    POPUP_CHECK: 20,

    AFTER_HOUR: 25,
    AFTER_MINUTE: 30,

    BEFORE_ENTER: 20,
    BETWEEN_ENTER: 35,
    AFTER_ENTER2: 40,

    BEFORE_SAVE: 80,
    SAVE_RETRY: 30,
    SAVE_CHECK: 30
};

// =========================================================
// URL
// =========================================================

function isBotcake(url) {
    try {
        return new URL(url).hostname === 'botcake.io';
    } catch (_) {
        return false;
    }
}

// =========================================================
// MESSAGE
// =========================================================

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (
            !message ||
            message.action !== 'RUN_BOTCAKE'
        ) {
            return;
        }

        runBotcake(message)
            .then(sendResponse)
            .catch(error => {
                console.error(
                    '[Botcake Auto]',
                    error
                );

                sendResponse({
                    ok: false,
                    error:
                        error?.message ||
                        String(error)
                });
            });

        return true;
    }
);

// =========================================================
// DEBUGGER
// =========================================================

async function attachDebugger(tabId) {

    const target = {
        tabId
    };

    try {
        await chrome.debugger.attach(
            target,
            '1.3'
        );
    } catch (error) {

        const message =
            String(
                error?.message ||
                error
            ).toLowerCase();

        if (
            !message.includes(
                'already'
            )
        ) {
            throw error;
        }
    }

    return target;
}

async function detachDebugger(target) {
    try {
        await chrome.debugger.detach(
            target
        );
    } catch (_) {}
}

async function cdp(
    target,
    method,
    params = {}
) {
    return chrome.debugger.sendCommand(
        target,
        method,
        params
    );
}

// =========================================================
// EVALUATE
// =========================================================

async function evaluatePage(
    target,
    expression
) {

    const response =
        await cdp(
            target,
            'Runtime.evaluate',
            {
                expression,
                returnByValue: true,
                awaitPromise: true
            }
        );

    if (
        response.exceptionDetails
    ) {
        throw new Error(
            'Lỗi JavaScript trong Botcake'
        );
    }

    return response.result?.value;
}

// =========================================================
// TEXT
// =========================================================

function normalizeInputText(value) {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
}

function normalizeCompareText(value) {
    return normalizeInputText(value)
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n+/g, '\n')
        .trim();
}

function textsMatch(
    expected,
    actual
) {
    return (
        normalizeCompareText(expected) ===
        normalizeCompareText(actual)
    );
}

// =========================================================
// FIND EDITOR
// =========================================================

async function findEditorPoint(target) {

    return evaluatePage(
        target,
        `
        (() => {

            const editor = [
                ...document.querySelectorAll(
                    '.block-card-item .rich-text-editor > div[data-slate-editor="true"][data-slate-node="value"][contenteditable="true"][role="textbox"]'
                )
            ].find(element => {

                const rect =
                    element.getBoundingClientRect();

                const style =
                    getComputedStyle(element);

                return (
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden'
                );
            });

            if (!editor) {
                return null;
            }

            editor.scrollIntoView({
                block: 'center',
                inline: 'nearest'
            });

            const rect =
                editor.getBoundingClientRect();

            return {
                x:
                    rect.left + 20,

                y:
                    rect.top +
                    Math.min(
                        15,
                        rect.height / 2
                    )
            };

        })()
        `
    );
}

async function waitEditor(target) {

    for (
        let i = 0;
        i < CONFIG.EDITOR_RETRY;
        i++
    ) {

        const point =
            await findEditorPoint(
                target
            );

        if (point) {
            return point;
        }

        await sleep(
            CONFIG.EDITOR_CHECK
        );
    }

    return null;
}

// =========================================================
// CLICK
// =========================================================

async function nativeClick(
    target,
    x,
    y
) {

    await cdp(
        target,
        'Input.dispatchMouseEvent',
        {
            type: 'mousePressed',
            x,
            y,
            button: 'left',
            buttons: 1,
            clickCount: 1
        }
    );

    await cdp(
        target,
        'Input.dispatchMouseEvent',
        {
            type: 'mouseReleased',
            x,
            y,
            button: 'left',
            buttons: 0,
            clickCount: 1
        }
    );
}

// =========================================================
// CTRL+A
// =========================================================

async function selectAll(target) {

    await cdp(
        target,
        'Input.dispatchKeyEvent',
        {
            type: 'rawKeyDown',

            key: 'Control',
            code: 'ControlLeft',

            windowsVirtualKeyCode: 17,
            nativeVirtualKeyCode: 17,

            modifiers: 2
        }
    );

    await cdp(
        target,
        'Input.dispatchKeyEvent',
        {
            type: 'rawKeyDown',

            key: 'a',
            code: 'KeyA',

            windowsVirtualKeyCode: 65,
            nativeVirtualKeyCode: 65,

            modifiers: 2
        }
    );

    await cdp(
        target,
        'Input.dispatchKeyEvent',
        {
            type: 'keyUp',

            key: 'a',
            code: 'KeyA',

            windowsVirtualKeyCode: 65,

            modifiers: 2
        }
    );

    await cdp(
        target,
        'Input.dispatchKeyEvent',
        {
            type: 'keyUp',

            key: 'Control',
            code: 'ControlLeft',

            windowsVirtualKeyCode: 17,

            modifiers: 0
        }
    );
}

// =========================================================
// BACKSPACE
// =========================================================

async function backspace(target) {

    await cdp(
        target,
        'Input.dispatchKeyEvent',
        {
            type: 'rawKeyDown',

            key: 'Backspace',
            code: 'Backspace',

            windowsVirtualKeyCode: 8
        }
    );

    await cdp(
        target,
        'Input.dispatchKeyEvent',
        {
            type: 'keyUp',

            key: 'Backspace',
            code: 'Backspace',

            windowsVirtualKeyCode: 8
        }
    );
}

// =========================================================
// READ EDITOR
// =========================================================

async function readEditor(target) {

    return evaluatePage(
        target,
        `
        (() => {

            const editor = [
                ...document.querySelectorAll(
                    '.block-card-item .rich-text-editor > div[data-slate-editor="true"][contenteditable="true"][role="textbox"]'
                )
            ].find(element => {

                const rect =
                    element.getBoundingClientRect();

                return (
                    rect.width > 0 &&
                    rect.height > 0
                );
            });

            if (!editor) {
                return null;
            }

            return {
                text:
                    editor.innerText ||
                    editor.textContent ||
                    ''
            };

        })()
        `
    );
}

// =========================================================
// FILL EDITOR - ULTRA FAST
// =========================================================

async function fillEditor(
    target,
    text
) {

    const desiredText =
        normalizeInputText(
            text
        );

    if (!desiredText.trim()) {
        throw new Error(
            'Nội dung trống'
        );
    }

    // =====================================================
    // FIND
    // =====================================================

    const point =
        await waitEditor(
            target
        );

    if (!point) {
        throw new Error(
            'Không tìm thấy ô nội dung'
        );
    }

    // =====================================================
    // CLICK
    // =====================================================

    await nativeClick(
        target,
        point.x,
        point.y
    );

    await sleep(
        CONFIG.AFTER_CLICK
    );

    // =====================================================
    // CTRL+A
    // =====================================================

    await selectAll(
        target
    );

    await sleep(
        CONFIG.AFTER_SELECT
    );

    // =====================================================
    // DELETE
    // =====================================================

    await backspace(
        target
    );

    await sleep(
        CONFIG.AFTER_DELETE
    );

    // =====================================================
    // INSERT TEXT - 1 LẦN
    // =====================================================

    await cdp(
        target,
        'Input.insertText',
        {
            text:
                desiredText
        }
    );

    await sleep(
        CONFIG.AFTER_INPUT
    );

    // =====================================================
    // VERIFY
    // =====================================================

    const editorState =
        await readEditor(
            target
        );

    if (
        !editorState ||
        !textsMatch(
            desiredText,
            editorState.text
        )
    ) {

        throw new Error(
            'Botcake chưa nhận đúng nội dung'
        );
    }

    return true;
}

// =========================================================
// NEXT
// =========================================================

async function findNextPoint(target) {

    return evaluatePage(
        target,
        `
        (() => {

            const buttons = [
                ...document.querySelectorAll(
                    'button'
                )
            ];

            const button =
                buttons.find(element => {

                    const rect =
                        element.getBoundingClientRect();

                    if (
                        rect.width <= 0 ||
                        rect.height <= 0 ||
                        element.disabled
                    ) {
                        return false;
                    }

                    const text =
                        (
                            element.innerText ||
                            element.textContent ||
                            ''
                        )
                            .replace(
                                /\\s+/g,
                                ' '
                            )
                            .trim();

                    return (
                        text ===
                        'Tiếp theo'
                    );
                });

            if (!button) {
                return null;
            }

            button.scrollIntoView({
                block: 'center',
                inline: 'nearest'
            });

            const rect =
                button.getBoundingClientRect();

            return {
                x:
                    rect.left +
                    rect.width / 2,

                y:
                    rect.top +
                    rect.height / 2
            };

        })()
        `
    );
}

async function clickNext(target) {

    let point = null;

    for (
        let i = 0;
        i < 30;
        i++
    ) {

        point =
            await findNextPoint(
                target
            );

        if (point) {
            break;
        }

        await sleep(20);
    }

    if (!point) {
        throw new Error(
            'Không tìm thấy Tiếp theo'
        );
    }

    await nativeClick(
        target,
        point.x,
        point.y
    );

    await sleep(
        CONFIG.AFTER_NEXT
    );
}

// =========================================================
// WAIT DATE
// =========================================================

async function waitEndDate(target) {

    for (
        let i = 0;
        i < CONFIG.SCHEDULE_RETRY;
        i++
    ) {

        const found =
            await evaluatePage(
                target,
                `
                (() => {

                    const input =
                        document.querySelector(
                            'input[placeholder="Ngày kết thúc"][date-range="end"]'
                        )
                        ||
                        document.querySelector(
                            'input[date-range="end"]'
                        )
                        ||
                        document.querySelector(
                            'input[placeholder="Ngày kết thúc"]'
                        );

                    if (!input) {
                        return false;
                    }

                    const rect =
                        input.getBoundingClientRect();

                    return (
                        rect.width > 0 &&
                        rect.height > 0
                    );

                })()
                `
            );

        if (found) {
            return;
        }

        await sleep(
            CONFIG.SCHEDULE_CHECK
        );
    }

    throw new Error(
        'Không thấy Ngày kết thúc'
    );
}

// =========================================================
// PAGE SCHEDULE
// =========================================================

async function pageSchedule(data) {

    const wait =
        ms =>
            new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        ms
                    )
            );

    const pad =
        value =>
            String(value)
                .padStart(
                    2,
                    '0'
                );

    function visible(element) {

        if (!element) {
            return false;
        }

        const rect =
            element.getBoundingClientRect();

        const style =
            getComputedStyle(element);

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
        );
    }

    function today() {

        const date =
            new Date();

        return (
            pad(
                date.getDate()
            )
            +
            '/'
            +
            pad(
                date.getMonth() + 1
            )
            +
            '/'
            +
            date.getFullYear()
        );
    }

    function click(element) {

        if (!element) {
            return;
        }

        element.scrollIntoView({
            block: 'center'
        });

        const rect =
            element.getBoundingClientRect();

        const options = {
            bubbles: true,
            cancelable: true,
            view: window,

            clientX:
                rect.left +
                rect.width / 2,

            clientY:
                rect.top +
                rect.height / 2
        };

        element.dispatchEvent(
            new MouseEvent(
                'mousedown',
                options
            )
        );

        element.dispatchEvent(
            new MouseEvent(
                'mouseup',
                options
            )
        );

        element.click();
    }

    function setValue(
        element,
        value
    ) {

        const descriptor =
            Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value'
            );

        descriptor.set.call(
            element,
            value
        );

        element.dispatchEvent(
            new Event(
                'input',
                {
                    bubbles: true
                }
            )
        );

        element.dispatchEvent(
            new Event(
                'change',
                {
                    bubbles: true
                }
            )
        );
    }

    function enter(element) {

        const options = {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        };

        element.dispatchEvent(
            new KeyboardEvent(
                'keydown',
                options
            )
        );

        element.dispatchEvent(
            new KeyboardEvent(
                'keypress',
                options
            )
        );

        element.dispatchEvent(
            new KeyboardEvent(
                'keyup',
                options
            )
        );
    }

    try {

        // =================================================
        // INPUT
        // =================================================

        const input =
            document.querySelector(
                'input[placeholder="Ngày kết thúc"][date-range="end"]'
            )
            ||
            document.querySelector(
                'input[date-range="end"]'
            )
            ||
            document.querySelector(
                'input[placeholder="Ngày kết thúc"]'
            );

        if (!input) {
            throw new Error(
                'Không thấy Ngày kết thúc'
            );
        }

        const full =
            today()
            +
            ' '
            +
            pad(data.hour)
            +
            ':'
            +
            pad(data.minute);

        // =================================================
        // SET
        // =================================================

        input.focus();

        setValue(
            input,
            full
        );

        await wait(10);

        click(input);

        // =================================================
        // PICKER
        // =================================================

        let dropdown =
            null;

        for (
            let i = 0;
            i < 30;
            i++
        ) {

            await wait(15);

            dropdown = [
                ...document.querySelectorAll(
                    '.ant-picker-dropdown'
                )
            ].find(
                visible
            );

            if (dropdown) {
                break;
            }
        }

        if (dropdown) {

            // =============================================
            // HOUR
            // =============================================

            let hourCell =
                dropdown.querySelector(
                    `.ant-picker-time-panel-column[data-type="hour"] li[data-value="${data.hour}"]`
                )
                ||
                dropdown.querySelector(
                    `.ant-picker-time-panel-column:nth-child(1) li[data-value="${data.hour}"]`
                );

            if (hourCell) {

                click(
                    hourCell.querySelector(
                        '.ant-picker-time-panel-cell-inner'
                    )
                    ||
                    hourCell
                );
            }

            await wait(25);

            dropdown = [
                ...document.querySelectorAll(
                    '.ant-picker-dropdown'
                )
            ].find(
                visible
            )
            ||
            dropdown;

            // =============================================
            // MINUTE
            // =============================================

            let minuteCell =
                dropdown.querySelector(
                    `.ant-picker-time-panel-column[data-type="minute"] li[data-value="${data.minute}"]`
                )
                ||
                dropdown.querySelector(
                    `.ant-picker-time-panel-column:nth-child(2) li[data-value="${data.minute}"]`
                );

            if (minuteCell) {

                click(
                    minuteCell.querySelector(
                        '.ant-picker-time-panel-cell-inner'
                    )
                    ||
                    minuteCell
                );
            }

            await wait(30);
        }

        // =================================================
        // FINAL
        // =================================================

        input.focus();

        setValue(
            input,
            full
        );

        await wait(20);

        // OK 1
        enter(input);

        await wait(35);

        // OK 2
        let active =
            document.activeElement;

        if (
            !active ||
            active === document.body ||
            active === document.documentElement
        ) {

            input.focus();

            active =
                input;
        }

        enter(active);

        await wait(40);

        try {
            input.blur();
        } catch (_) {}

        // =================================================
        // SAVE
        // =================================================

        if (
            data.autoSave
        ) {

            const PATH =
                'M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32';

            let saveButton =
                null;

            // Đợi tối đa ~1 giây
            for (
                let i = 0;
                i < 30;
                i++
            ) {

                if (
                    i === 0
                ) {
                    await wait(80);
                } else {
                    await wait(30);
                }

                const paths = [
                    ...document.querySelectorAll(
                        'svg path'
                    )
                ];

                const savePath =
                    paths.find(
                        path =>
                            (
                                path.getAttribute(
                                    'd'
                                ) || ''
                            )
                                .startsWith(
                                    PATH
                                )
                    );

                if (savePath) {

                    const button =
                        savePath.closest(
                            'button'
                        );

                    if (
                        button &&
                        visible(button) &&
                        !button.disabled
                    ) {

                        saveButton =
                            button;

                        break;
                    }
                }
            }

            if (!saveButton) {
                throw new Error(
                    'Không tìm thấy Save'
                );
            }

            click(
                saveButton
            );
        }

        return {
            ok: true,
            full
        };

    } catch (error) {

        return {
            ok: false,
            error:
                error?.message ||
                String(error)
        };
    }
}

// =========================================================
// SET SCHEDULE
// =========================================================

async function setSchedule(
    target,
    hour,
    minute,
    autoSave
) {

    const expression =
        '('
        +
        pageSchedule.toString()
        +
        ')('
        +
        JSON.stringify({
            hour,
            minute,
            autoSave
        })
        +
        ')';

    const response =
        await cdp(
            target,
            'Runtime.evaluate',
            {
                expression,
                awaitPromise: true,
                returnByValue: true
            }
        );

    if (
        response.exceptionDetails
    ) {
        throw new Error(
            'Lỗi đặt giờ'
        );
    }

    const pageResult =
        response.result?.value;

    if (
        !pageResult ||
        !pageResult.ok
    ) {

        throw new Error(
            pageResult?.error ||
            'Không đặt được giờ'
        );
    }

    return pageResult;
}

// =========================================================
// MAIN
// =========================================================

async function runBotcake(data) {

    const activeTabs =
        await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

    const currentTab =
        activeTabs[0];

    if (!currentTab) {
        throw new Error(
            'Không xác định được cửa sổ'
        );
    }

    // =====================================================
    // BOTCAKE TABS
    // =====================================================

    const tabs =
        await chrome.tabs.query({
            windowId:
                currentTab.windowId
        });

    const botcakeTabs =
        tabs
            .filter(
                tab =>
                    isBotcake(
                        tab.url || ''
                    )
            )
            .sort(
                (a, b) =>
                    a.index - b.index
            );

    if (!botcakeTabs.length) {
        throw new Error(
            'Không có tab Botcake'
        );
    }

    // =====================================================
    // SELECT
    // =====================================================

    const number =
        Math.max(
            1,
            parseInt(
                data.botNumber,
                10
            ) || 1
        );

    const targetTab =
        botcakeTabs[
            number - 1
        ];

    if (!targetTab) {
        throw new Error(
            `Không có Botcake #${number}`
        );
    }

    // =====================================================
    // ACTIVATE
    // =====================================================

    if (
        !targetTab.active
    ) {

        await chrome.tabs.update(
            targetTab.id,
            {
                active: true
            }
        );

        await chrome.windows.update(
            targetTab.windowId,
            {
                focused: true
            }
        );

        await sleep(
            CONFIG.TAB_READY
        );
    }

    // =====================================================
    // ATTACH
    // =====================================================

    const debuggerTarget =
        await attachDebugger(
            targetTab.id
        );

    try {

        // =================================================
        // DATA
        // =================================================

        const message =
            normalizeInputText(
                data.message
            );

        const hour =
            Math.max(
                0,
                Math.min(
                    23,
                    Number(data.hour) ||
                    0
                )
            );

        const minute =
            Math.max(
                0,
                Math.min(
                    59,
                    Number(data.minute) ||
                    0
                )
            );

        const autoSave =
            Boolean(
                data.autoSave
            );

        // =================================================
        // STEP 1
        // =================================================

        await fillEditor(
            debuggerTarget,
            message
        );

        // =================================================
        // STEP 2
        // =================================================

        await clickNext(
            debuggerTarget
        );

        // =================================================
        // STEP 3
        // =================================================

        await waitEndDate(
            debuggerTarget
        );

        // =================================================
        // STEP 4
        // =================================================

        const scheduleResult =
            await setSchedule(
                debuggerTarget,
                hour,
                minute,
                autoSave
            );

        /*
         * Không hiển thị bất kỳ
         * thông báo "thành công" nào.
         */

        return {
            ok: true,
            botNumber:
                number,
            fullDateTime:
                scheduleResult.full
        };

    } finally {

        await detachDebugger(
            debuggerTarget
        );
    }
}