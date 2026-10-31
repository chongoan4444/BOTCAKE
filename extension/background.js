'use strict';

// =========================================================
// BOTCAKE AUTO MULTI v6
// =========================================================

const sleep = (ms) =>
    new Promise(resolve =>
        setTimeout(resolve, ms)
    );

const CONFIG = {
    TAB_READY: 280,

    EDITOR_RETRY: 40,
    EDITOR_CHECK: 25,

    CLEAR_RETRY: 5,

    AFTER_EDITOR_CLICK: 60,
    AFTER_SELECT: 25,
    AFTER_DELETE: 45,

    AFTER_INPUT: 100,

    CONTENT_VERIFY_RETRY: 10,
    CONTENT_VERIFY_DELAY: 30,

    AFTER_NEXT: 120,

    SCHEDULE_RETRY: 60,
    SCHEDULE_CHECK: 30
};

// =========================================================
// URL
// =========================================================

function isBotcake(url) {

    try {

        const hostname = new URL(url).hostname;

        return (

            hostname === 'botcake.io' ||

            hostname === 'www.botcake.io'

        );

    } catch (_) {

        return false;

    }
}

// =========================================================
// ACTION -> WIDGET
// =========================================================

chrome.action.onClicked.addListener(
    async tab => {
        if (!tab?.id || !tab?.url) return;

        if (/^(chrome|edge|about|chrome-extension):/i.test(tab.url)) {
            return;
        }

        try {
            // Toolbar click always opens the full panel, even if the widget
            // was previously minimized or closed.
            await chrome.storage.local.set({
                bc_multi_visible_v6: true,
                bc_multi_minimized_v6: false
            });

            await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['widget.css']
            });

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['widget.js']
            });
        } catch (error) {
            console.error('[Botcake Widget]', error);
        }
    }
);

// =========================================================
// MESSAGE
// =========================================================

chrome.runtime.onMessage.addListener(
    (
        message,
        sender,
        sendResponse
    ) => {

        if (!message) {
            return;
        }

        // =================================================
        // GET TABS
        // =================================================

        if (
            message.action ===
            'GET_BOTCAKE_TABS'
        ) {

            getBotcakeTabs(
                sender
            )
                .then(sendResponse)
                .catch(error => {

                    sendResponse({
                        ok: false,
                        tabs: [],
                        error:
                            error.message
                    });
                });

            return true;
        }

        // =================================================
        // MULTI RUN
        // =================================================

        if (
            message.action ===
            'RUN_BOTCAKE_MULTI'
        ) {

            runBotcakeMulti(
                message,
                sender
            )
                .then(sendResponse)
                .catch(error => {

                    console.error(
                        '[Botcake Multi]',
                        error
                    );

                    sendResponse({
                        ok: false,
                        error:
                            error.message
                    });
                });

            return true;
        }

        // =================================================
        // COMPATIBILITY VỚI WIDGET CŨ
        // =================================================

        if (
            message.action ===
            'RUN_BOTCAKE'
        ) {

            runBotcakeMulti(
                {
                    action:
                        'RUN_BOTCAKE_MULTI',

                    message:
                        message.message,

                    autoSave:
                        message.autoSave,

                    startDate:
                        message.startDate,

                    endDate:
                        message.endDate,

                    jobs: [
                        {
                            botNumber:
                                message.botNumber,

                            startDate:
                                message.startDate,

                            endDate:
                                message.endDate
                        }
                    ]
                },
                sender
            )
                .then(sendResponse)
                .catch(error => {

                    sendResponse({
                        ok: false,
                        error:
                            error.message
                    });
                });

            return true;
        }
    }
);

// =========================================================
// GET WINDOW ID
// =========================================================

async function getWindowId(
    sender
) {

    if (
        typeof sender.tab?.windowId ===
        'number'
    ) {

        return sender.tab.windowId;
    }

    const tabs =
        await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

    return tabs[0]?.windowId;
}

// =========================================================
// GET BOTCAKE TABS
// =========================================================

async function getBotcakeTabs(
    sender
) {

    // Lấy windowId của sender (nếu có)
    let windowId = null;

    if (
        typeof sender.tab?.windowId ===
        'number'
    ) {

        windowId =
            sender.tab.windowId;
    }

    // Helper: lọc tab Botcake trong một danh sách
    const filterBotcake =
        tabs =>
            tabs
                .filter(tab =>
                    isBotcake(
                        tab.url || ''
                    )
                )
                .sort(
                    (a, b) =>
                        a.index -
                        b.index
                );

    // Thử lấy tab trong cửa sổ của sender trước
    let allTabs = [];

    if (
        typeof windowId ===
        'number'
    ) {

        allTabs =
            await chrome.tabs.query({
                windowId
            });
    }

    let botcakeTabs =
        filterBotcake(allTabs);

    // Nếu không tìm thấy tab Botcake nào trong cửa sổ sender,
    // quét toàn bộ các cửa sổ khác (popup có thể mở từ tab không phải Botcake)
    if (
        botcakeTabs.length === 0
    ) {

        allTabs =
            await chrome.tabs.query({});

        botcakeTabs =
            filterBotcake(allTabs);
    }

    if (
        botcakeTabs.length === 0
    ) {

        return {
            ok: true,
            tabs: []
        };
    }

    return {
        ok: true,

        tabs:
            botcakeTabs.map(
                (tab, index) => ({
                    number:
                        index + 1,

                    id:
                        tab.id,

                    index:
                        tab.index,

                    title:
                        tab.title || ''
                })
            )
    };
}

// =========================================================
// DEBUGGER
// =========================================================

async function attachDebugger(
    tabId
) {

    const target = {
        tabId
    };

    try {

        await chrome.debugger.attach(
            target,
            '1.3'
        );

    } catch (error) {

        const text =
            String(
                error?.message ||
                error
            )
                .toLowerCase();

        if (
            !text.includes(
                'already'
            )
        ) {

            throw error;
        }
    }

    return target;
}

async function detachDebugger(
    target
) {

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

        console.error(
            '[Botcake] Runtime error:',
            response.exceptionDetails
        );

        throw new Error(
            'Lỗi JavaScript trong Botcake'
        );
    }

    return response.result?.value;
}

// =========================================================
// TEXT
// =========================================================

function normalizeInputText(
    value
) {

    return String(
        value || ''
    )
        .replace(
            /\r\n/g,
            '\n'
        )
        .replace(
            /\r/g,
            '\n'
        );
}

function normalizeCompareText(
    value
) {

    return normalizeInputText(
        value
    )
        .replace(
            /\u00a0/g,
            ' '
        )
        .replace(
            /[ \t]+\n/g,
            '\n'
        )
        .replace(
            /\n[ \t]+/g,
            '\n'
        )
        .replace(
            /\n+/g,
            '\n'
        )
        .trim();
}

function textsMatch(
    a,
    b
) {

    return (
        normalizeCompareText(a) ===
        normalizeCompareText(b)
    );
}

// =========================================================
// EDITOR POINT
// =========================================================

async function findEditorPoint(
    target
) {

    return evaluatePage(
        target,
        `
        (() => {

            const selector =
                '.block-card-item ' +
                '.rich-text-editor > ' +
                'div[data-slate-editor="true"]' +
                '[data-slate-node="value"]' +
                '[contenteditable="true"]' +
                '[role="textbox"]';

            const editors = [
                ...document.querySelectorAll(
                    selector
                )
            ];

            const editor =
                editors.find(element => {

                    const rect =
                        element.getBoundingClientRect();

                    const style =
                        getComputedStyle(
                            element
                        );

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

async function waitEditor(
    target
) {

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
// NATIVE CLICK
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
            type:
                'mouseMoved',

            x,
            y
        }
    );

    await cdp(
        target,
        'Input.dispatchMouseEvent',
        {
            type:
                'mousePressed',

            x,
            y,

            button:
                'left',

            buttons:
                1,

            clickCount:
                1
        }
    );

    await cdp(
        target,
        'Input.dispatchMouseEvent',
        {
            type:
                'mouseReleased',

            x,
            y,

            button:
                'left',

            buttons:
                0,

            clickCount:
                1
        }
    );
}

// =========================================================
// CTRL+A
// =========================================================

async function selectAll(
    target
) {

    await cdp(
        target,
        'Input.dispatchKeyEvent',
        {
            type:
                'rawKeyDown',

            key:
                'Control',

            code:
                'ControlLeft',

            windowsVirtualKeyCode:
                17,

            nativeVirtualKeyCode:
                17,

            modifiers:
                2
        }
    );

    await cdp(
        target,
        'Input.dispatchKeyEvent',
        {
            type:
                'rawKeyDown',

            key:
                'a',

            code:
                'KeyA',

            windowsVirtualKeyCode:
                65,

            nativeVirtualKeyCode:
                65,

            modifiers:
                2
        }
    );

    await cdp(
        target,
        'Input.dispatchKeyEvent',
        {
            type:
                'keyUp',

            key:
                'a',

            code:
                'KeyA',

            windowsVirtualKeyCode:
                65,

            modifiers:
                2
        }
    );

    await cdp(
        target,
        'Input.dispatchKeyEvent',
        {
            type:
                'keyUp',

            key:
                'Control',

            code:
                'ControlLeft',

            windowsVirtualKeyCode:
                17,

            modifiers:
                0
        }
    );
}

// =========================================================
// BACKSPACE
// =========================================================

async function backspace(
    target
) {

    await cdp(
        target,
        'Input.dispatchKeyEvent',
        {
            type:
                'rawKeyDown',

            key:
                'Backspace',

            code:
                'Backspace',

            windowsVirtualKeyCode:
                8
        }
    );

    await cdp(
        target,
        'Input.dispatchKeyEvent',
        {
            type:
                'keyUp',

            key:
                'Backspace',

            code:
                'Backspace',

            windowsVirtualKeyCode:
                8
        }
    );
}

// =========================================================
// READ EDITOR
// =========================================================

async function readEditor(
    target
) {

    return evaluatePage(
        target,
        `
        (() => {

            const editors = [
                ...document.querySelectorAll(
                    '.block-card-item .rich-text-editor > div[data-slate-editor="true"][contenteditable="true"][role="textbox"]'
                )
            ];

            const editor =
                editors.find(element => {

                    const rect =
                        element.getBoundingClientRect();

                    const style =
                        getComputedStyle(
                            element
                        );

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
// CLEAR EDITOR CHẮC CHẮN
// =========================================================

async function clearEditorSafely(
    target
) {

    for (
        let attempt = 0;
        attempt < CONFIG.CLEAR_RETRY;
        attempt++
    ) {

        const point =
            await waitEditor(
                target
            );

        if (!point) {

            throw new Error(
                'Không tìm thấy ô nội dung'
            );
        }

        await nativeClick(
            target,
            point.x,
            point.y
        );

        await sleep(
            attempt === 0
                ? CONFIG.AFTER_EDITOR_CLICK
                : 30
        );

        await selectAll(
            target
        );

        await sleep(
            CONFIG.AFTER_SELECT
        );

        await backspace(
            target
        );

        await sleep(
            CONFIG.AFTER_DELETE
        );

        const state =
            await readEditor(
                target
            );

        if (
            state &&
            normalizeCompareText(
                state.text
            ) === ''
        ) {

            return true;
        }
    }

    throw new Error(
        'Không xóa được nội dung cũ'
    );
}

// =========================================================
// FILL EDITOR
// =========================================================

async function fillEditor(
    target,
    message
) {

    const text =
        normalizeInputText(
            message
        );

    if (
        !text.trim()
    ) {

        throw new Error(
            'Nội dung trống'
        );
    }

    // =====================================================
    // CLEAR FIRST
    // =====================================================

    await clearEditorSafely(
        target
    );

    // =====================================================
    // INSERT WHOLE TEXT
    // =====================================================

    await cdp(
        target,
        'Input.insertText',
        {
            text
        }
    );

    await sleep(
        CONFIG.AFTER_INPUT
    );

    // =====================================================
    // VERIFY
    // =====================================================

    let state =
        await readEditor(
            target
        );

    if (
        state &&
        textsMatch(
            text,
            state.text
        )
    ) {

        return true;
    }

    /*
     * React đôi khi render chậm vài chục ms.
     */

    for (
        let i = 0;
        i <
            CONFIG.CONTENT_VERIFY_RETRY;
        i++
    ) {

        await sleep(
            CONFIG.CONTENT_VERIFY_DELAY
        );

        state =
            await readEditor(
                target
            );

        if (
            state &&
            textsMatch(
                text,
                state.text
            )
        ) {

            return true;
        }
    }

    throw new Error(
        'Botcake chưa nhận đúng nội dung'
    );
}

// =========================================================
// NEXT
// =========================================================

async function findNextPoint(
    target
) {

    return evaluatePage(
        target,
        `
        (() => {

            function visible(element) {

                if (!element) {
                    return false;
                }

                const rect =
                    element.getBoundingClientRect();

                return (
                    rect.width > 0 &&
                    rect.height > 0
                );
            }

            let button = [
                ...document.querySelectorAll(
                    'button'
                )
            ].find(element => {

                if (
                    !visible(element) ||
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

                const pathStart =
                    'M221.66,133.66l-72,72';

                const path = [
                    ...document.querySelectorAll(
                        'button svg path'
                    )
                ].find(element =>
                    (
                        element.getAttribute(
                            'd'
                        ) || ''
                    ).startsWith(
                        pathStart
                    )
                );

                if (path) {

                    button =
                        path.closest(
                            'button'
                        );
                }
            }

            if (
                !button ||
                !visible(button) ||
                button.disabled
            ) {

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

async function clickNext(
    target
) {

    let point =
        null;

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
// WAIT END DATE
// =========================================================

async function waitEndDate(
    target
) {

    for (
        let i = 0;
        i < CONFIG.SCHEDULE_RETRY;
        i++
    ) {

        const exists =
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

        if (exists) {
            return true;
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

async function pageSchedule(
    data
) {

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

    // Unix timestamp (giây) -> chuỗi DD/MM/YYYY HH:mm
    function formatDateTime(
        unixSeconds
    ) {

        if (!unixSeconds) {
            return null;
        }

        const d =
            new Date(
                unixSeconds * 1000
            );

        return {
            full:
                pad(d.getDate()) +
                '/' +
                pad(
                    d.getMonth() + 1
                ) +
                '/' +
                d.getFullYear() +
                ' ' +
                pad(d.getHours()) +
                ':' +
                pad(d.getMinutes()),

            hour:
                pad(d.getHours()),

            minute:
                pad(d.getMinutes()),

            date:
                pad(d.getDate()) +
                '/' +
                pad(
                    d.getMonth() + 1
                ) +
                '/' +
                d.getFullYear()
        };
    }

    function visible(
        element
    ) {

        if (!element) {
            return false;
        }

        const rect =
            element.getBoundingClientRect();

        const style =
            getComputedStyle(
                element
            );

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
        );
    }

    function click(
        element
    ) {

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

        if (
            descriptor?.set
        ) {

            descriptor.set.call(
                element,
                value
            );

        } else {

            element.value =
                value;
        }

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

    function enter(
        element
    ) {

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

    // Chọn giờ/phút trong time panel của Ant DatePicker
    async function pickTime(
        dropdown,
        hour,
        minute
    ) {

        // HOUR
        let hourCell =
            dropdown.querySelector(
                `.ant-picker-time-panel-column[data-type="hour"] li[data-value="${hour}"]`
            )
            ||
            dropdown.querySelector(
                `.ant-picker-time-panel-column:nth-child(1) li[data-value="${hour}"]`
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

        dropdown =
            [
                ...document.querySelectorAll(
                    '.ant-picker-dropdown'
                )
            ].find(
                element =>
                    visible(element) &&
                    !element.classList.contains(
                        'ant-picker-dropdown-hidden'
                    )
            )
            ||
            dropdown;

        // MINUTE
        let minuteCell =
            dropdown.querySelector(
                `.ant-picker-time-panel-column[data-type="minute"] li[data-value="${minute}"]`
            )
            ||
            dropdown.querySelector(
                `.ant-picker-time-panel-column:nth-child(2) li[data-value="${minute}"]`
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

    // Đặt giá trị ngày giờ cho một input datepicker + chọn giờ/phút + enter xong
    async function setOneDateTime(
        selectors,
        dateTime
    ) {

        // selectors: mảng các chuỗi CSS selector, thử lần lượt
        let input = null;

        for (const sel of selectors) {

            input =
                document.querySelector(sel);

            if (input) {
                break;
            }
        }

        if (!input) {

            return {
                ok: false,
                error: `Không thấy input (selectors: ${selectors.join(', ')})`
            };
        }

        const full =
            dateTime.full;

        input.focus();

        setValue(
            input,
            full
        );

        await wait(10);

        click(
            input
        );

        // Mở dropdown
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
                element =>
                    visible(element) &&
                    !element.classList.contains(
                        'ant-picker-dropdown-hidden'
                    )
            );

            if (dropdown) {
                break;
            }
        }

        if (dropdown) {

            await pickTime(
                dropdown,
                dateTime.hour,
                dateTime.minute
            );
        }

        // Xác nhận giá trị cuối
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
            active ===
                document.body ||
            active ===
                document.documentElement
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

        return {
            ok: true,
            full
        };
    }

    try {

        const start =
            formatDateTime(
                data.startDate
            );

        const end =
            formatDateTime(
                data.endDate
            );

        if (!end) {

            throw new Error(
                'Không có ngày giờ kết thúc'
            );
        }

        // =================================================
        // NGÀY GIỜ BẮT ĐẦU (nếu có)
        // =================================================

        if (start) {

            const startResult =
                await setOneDateTime(
                    [
                        'input[placeholder="Ngày bắt đầu"][date-range="start"]',
                        'input[date-range="start"]',
                        'input[placeholder="Ngày bắt đầu"]'
                    ],
                    start
                );

            if (!startResult.ok) {

                // Nếu không có input bắt đầu riêng, bỏ qua (UI chỉ có kết thúc)
                console.warn(
                    '[Botcake pageSchedule] ' +
                    startResult.error
                );
            }
        }

        // =================================================
        // NGÀY GIỜ KẾT THÚC
        // =================================================

        const endResult =
            await setOneDateTime(
                [
                    'input[placeholder="Ngày kết thúc"][date-range="end"]',
                    'input[date-range="end"]',
                    'input[placeholder="Ngày kết thúc"]'
                ],
                end
            );

        if (!endResult.ok) {

            throw new Error(
                endResult.error
            );
        }

        // =================================================
        // SAVE
        // =================================================

        if (
            data.autoSave
        ) {

            const savePathStart =
                'M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32';

            let saveButton =
                null;

            for (
                let i = 0;
                i < 30;
                i++
            ) {

                await wait(
                    i === 0
                        ? 80
                        : 30
                );

                const path = [
                    ...document.querySelectorAll(
                        'svg path'
                    )
                ].find(element =>
                    (
                        element.getAttribute(
                            'd'
                        ) || ''
                    ).startsWith(
                        savePathStart
                    )
                );

                if (path) {

                    const candidate =
                        path.closest(
                            'button'
                        )
                        ||
                        path.closest(
                            '.ant-btn'
                        );

                    if (
                        candidate &&
                        visible(candidate) &&
                        !candidate.disabled
                    ) {

                        saveButton =
                            candidate;

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

            full:
                end.full,

            startDate:
                start ? start.full : null,

            endDate:
                end.full
        };

    } catch (error) {

        return {
            ok: false,

            error:
                error.message
        };
    }
}

// =========================================================
// SET SCHEDULE
// =========================================================

async function setSchedule(
    target,
    startDate,
    endDate,
    autoSave
) {

    const expression =
        '(' +
        pageSchedule.toString() +
        ')(' +
        JSON.stringify({
            startDate,
            endDate,
            autoSave
        }) +
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
        !pageResult?.ok
    ) {

        throw new Error(
            pageResult?.error ||
            'Không đặt được giờ'
        );
    }

    return pageResult;
}

// =========================================================
// FILTER CONDITIONS (như script F6)
// =========================================================

async function setFilterConditions(
    target,
    startDate,
    endDate
) {

    const expression =
        '(' +
        setFilterConditionsPage.toString() +
        ')(' +
        JSON.stringify({
            startDate,
            endDate
        }) +
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
            'Lỗi đặt điều kiện lọc'
        );
    }

    const pageResult = response.result?.value;
    if (!pageResult?.ok) {
        throw new Error(pageResult?.error || 'Không hoàn tất điều kiện lọc');
    }
    return pageResult;
}

async function setFilterConditionsPage(data) {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const waitFor = (getValue, timeout = 10000, description = 'điều kiện lọc') =>
        new Promise((resolve, reject) => {
            const started = Date.now();
            const poll = () => {
                let value;
                try {
                    value = getValue();
                } catch (error) {
                    reject(error);
                    return;
                }
                if (value) {
                    resolve(value);
                } else if (Date.now() - started >= timeout) {
                    reject(new Error(`Hết thời gian chờ ${description}`));
                } else {
                    setTimeout(poll, 100);
                }
            };
            poll();
        });

    const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
    const text = element => clean(element?.textContent);
    const visible = element => {
        if (!element?.isConnected) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const equals = (a, b) => clean(a).toLocaleLowerCase('vi') === clean(b).toLocaleLowerCase('vi');

    const buttons = label => [...document.querySelectorAll('button')]
        .filter(button => text(button) === label && !button.disabled && visible(button));

    const panel = () => {
        const clearButton = buttons('Xóa tất cả lọc')[0];
        return clearButton?.closest('.rounded-xl') || null;
    };

    const rows = () => {
        const body = panel()?.querySelector('.data-collapsible');
        if (!body) return [];
        return [...body.querySelectorAll('.flex.gap-12')]
            .filter(row => row.querySelector(':scope > .ant-dropdown-trigger'));
    };

    const rowAt = index => {
        const row = rows()[index];
        if (!row) throw new Error(`Không tìm thấy dòng điều kiện thứ ${index + 1}`);
        return row;
    };

    const selects = row => [...row.querySelectorAll(':scope > .w-full .ant-select')];
    const chosen = select => text(select?.querySelector('.ant-select-selection-item'));

    const popupSelector = '.ant-dropdown, .ant-select-dropdown, .ant-popover, [role="menu"], [role="listbox"], .rc-virtual-list';
    const itemSelector = '.ant-dropdown-menu-item, .ant-select-item-option, [role="menuitem"], [role="option"], .rc-virtual-list-holder-inner > *';

    const popupOption = labels => {
        const wanted = Array.isArray(labels) ? labels : [labels];
        for (const label of wanted) {
            for (const popup of document.querySelectorAll(popupSelector)) {
                if (!visible(popup) || popup.classList.contains('ant-dropdown-hidden') || popup.classList.contains('ant-select-dropdown-hidden')) continue;
                const items = [...popup.querySelectorAll(itemSelector)];
                const match = items.find(item => visible(item) && equals(text(item), label));
                if (match) return match;
                const leaf = [...popup.querySelectorAll('span, div, li, button')]
                    .find(item => visible(item) && equals(text(item), label));
                if (leaf) return leaf.closest(`${itemSelector}, li, button, .cursor-pointer`) || leaf;
            }
        }
        return null;
    };

    const choose = async (trigger, labels, kind = 'select') => {
        if (!trigger || !visible(trigger)) {
            const label = Array.isArray(labels) ? labels.join('/') : labels;
            throw new Error(`Không tìm thấy ô chọn “${label}”`);
        }

        trigger.click();
        let option = await waitFor(() => popupOption(labels), 1200, 'menu lựa chọn').catch(() => null);

        if (!option) {
            trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, buttons: 1 }));
            trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
            option = await waitFor(() => popupOption(labels), 2500, 'menu lựa chọn').catch(() => null);
        }

        if (!option && kind === 'tag') {
            const search = trigger.closest('.ant-select')?.querySelector('input.ant-select-selection-search-input:not([readonly])');
            if (search) {
                search.focus();
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                setter.call(search, Array.isArray(labels) ? labels[0] : labels);
                search.dispatchEvent(new Event('input', { bubbles: true }));
                option = await waitFor(() => popupOption(labels), 6000, 'thẻ Chặn').catch(() => null);
            }
        }

        if (!option) {
            const label = Array.isArray(labels) ? labels.join('/') : labels;
            throw new Error(`Không thấy lựa chọn “${label}” trong danh sách Botcake`);
        }
        option.click();
    };

    const ensureField = async (index, labels) => {
        const wanted = Array.isArray(labels) ? labels : [labels];
        const trigger = () => rowAt(index).querySelector(':scope > .ant-dropdown-trigger');
        const current = text(trigger());
        if (wanted.some(label => equals(current, label))) return;
        if (current && current !== 'Chọn điều kiện lọc') {
            throw new Error(`Dòng ${index + 1} đang chọn “${current}”, không ghi đè điều kiện có sẵn`);
        }
        await choose(trigger(), wanted, 'dropdown');
        await waitFor(() => wanted.some(label => equals(text(trigger()), label)), 5000, `trường ${wanted.join('/')}`);
    };

    const ensureOperator = async (index, labels) => {
        const wanted = Array.isArray(labels) ? labels : [labels];
        const select = () => selects(rowAt(index))[0];
        if (!select()) throw new Error(`Không tìm thấy kiểu lọc tại dòng ${index + 1}`);
        if (wanted.some(label => equals(chosen(select()), label))) return;
        await choose(select().querySelector('.ant-select-selector'), wanted, 'select');
        await waitFor(() => wanted.some(label => equals(chosen(select()), label)), 5000, `kiểu lọc ${wanted.join('/')}`);
    };

    const ensureRow = async index => {
        while (rows().length <= index) {
            const before = rows().length;
            const add = buttons('Thêm điều kiện').find(button => panel()?.contains(button));
            if (!add) throw new Error('Không tìm thấy nút “Thêm điều kiện”');
            add.click();
            await waitFor(() => rows().length > before, 10000, `dòng điều kiện ${index + 1}`);
        }
    };

    const formatFilterDate = timestamp => {
        const date = new Date(Number(timestamp) * 1000);
        const pad = value => String(value).padStart(2, '0');
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const setDateRange = async row => {
        const range = await waitFor(
            () => {
                const picker = row.querySelector('.ant-picker-range');
                return picker && visible(picker) ? picker : null;
            },
            10000,
            'ô ngày giờ đăng ký dạng Khoảng'
        );
        const inputs = [...range.querySelectorAll('.ant-picker-input input')].filter(visible);
        if (inputs.length < 2) {
            throw new Error('Ô lọc ngày giờ không có đủ hai trường bắt đầu/kết thúc');
        }
        if (!data.startDate || !data.endDate) {
            throw new Error('Thiếu ngày bắt đầu hoặc ngày kết thúc cho điều kiện lọc');
        }

        const values = [formatFilterDate(data.startDate), formatFilterDate(data.endDate)];
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        inputs.slice(0, 2).forEach((input, index) => {
            input.focus();
            setter.call(input, values[index]);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        });
        await sleep(300);

        const actual = [...range.querySelectorAll('.ant-picker-input input')].slice(0, 2).map(input => input.value);
        if (actual[0] !== values[0] || actual[1] !== values[1]) {
            throw new Error('Botcake chưa nhận đủ ngày bắt đầu/kết thúc ở điều kiện lọc');
        }
    };

    try {
        // This function is called only after “Tiếp theo”; do not try to open
        // the message form again. Wait for the real filter screen.
        await waitFor(() => panel(), 15000, 'màn hình điều kiện lọc sau khi bấm Tiếp theo');
        await ensureRow(0);

        // 1) Thẻ != Chặn
        await ensureField(0, 'Thẻ');
        await ensureOperator(0, 'Không bằng');
        const tagSelect = selects(rowAt(0))[1];
        const addTagButton = [...rowAt(0).querySelectorAll('button')].find(button => text(button) === 'Thêm thẻ');
        const tagTrigger = tagSelect?.querySelector('.ant-select-selector') || addTagButton;
        if (!tagTrigger) throw new Error('Không tìm thấy ô chọn thẻ ở dòng đầu');
        const tagIsSelected = () => {
            const selected = chosen(selects(rowAt(0))[1]);
            return equals(selected, 'Chặn') || [...rowAt(0).querySelectorAll('.ant-select-selection-item, .ant-tag')].some(item => equals(text(item), 'Chặn'));
        };
        if (!tagIsSelected()) {
            await choose(tagTrigger, 'Chặn', 'tag');
            await waitFor(tagIsSelected, 5000, 'thẻ Chặn');
        }

        // 2) Số điện thoại = Không có
        await ensureRow(1);
        await ensureField(1, 'Số điện thoại');
        await ensureOperator(1, ['Không có', 'Không']);

        // 3) Ngày giờ đăng ký = Khoảng, rồi mới điền đủ hai mốc ngày giờ.
        await ensureRow(2);
        await ensureField(2, ['Ngày giờ đăng ký', 'Ngày giờ đăng']);
        await ensureOperator(2, ['Khoảng', 'Khoảng thời gian']);
        await setDateRange(rowAt(2));

        return { ok: true };
    } catch (error) {
        return { ok: false, error: error?.message || String(error) };
    }
}

// =========================================================
// OPEN CREATE FORM (TẠO MỚI)
// =========================================================

async function openCreateForm(
    target
) {

    const expression =
        '(' +
        openCreateFormPage.toString() +
        ')()';

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
            'Lỗi mở form tạo mới'
        );
    }

    return response.result?.value;
}

async function openCreateFormPage() {

    const wait =
        ms =>
            new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        ms
                    )
            );

    const text =
        el =>
            (el?.textContent || '')
                .replace(
                    /\s+/g,
                    ' '
                )
                .trim();

    const visible =
        el => {
            if (
                !el ||
                !el.isConnected
            ) {
                return false;
            }

            const style =
                getComputedStyle(
                    el
                );

            return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                el.getBoundingClientRect().width > 0 &&
                el.getBoundingClientRect().height > 0
            );
        };

    const buttons =
        label =>
            [
                ...document.querySelectorAll(
                    'button'
                )
            ].filter(
                el =>
                    text(el) === label &&
                    !el.disabled &&
                    visible(el)
            );

    // Kiểm tra xem có đang ở giao diện tạo lọc (có panel "Xóa tất cả lọc")
    const isFilterInterface = () => {

        const clear =
            buttons('Xóa tất cả lọc').find(
                el => visible(el)
            );

        return clear
            ? clear.closest('.rounded-xl') !== null
            : false;
    };

    // Kiểm tra xem có đang ở giao diện điền câu (có nút "Tiếp theo")
    const isMessageInterface = () =>
        buttons('Tiếp theo').length > 0;

    // Nhấn nút quay lại (back) trên giao diện tạo lọc
    // SVG path: M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80...
    const clickBack = () => {

        const backBtns = [
            ...document.querySelectorAll(
                'button'
            )
        ].filter(el => {

            const svg =
                el.querySelector('svg');

            if (!svg) {
                return false;
            }

            const path =
                svg.querySelector('path');

            if (!path) {
                return false;
            }

            const d =
                path.getAttribute('d') || '';

            return d.startsWith('M165.66,202.34');
        });

        if (
            backBtns.length > 0 &&
            visible(backBtns[0])
        ) {

            backBtns[0].click();

            return true;
        }

        return false;
    };

    // Nhấn nút "Tiếp theo" trên giao diện điền câu
    const clickTiepTheo = () => {

        const btns =
            buttons('Tiếp theo');

        if (
            btns.length > 0
        ) {

            btns[0].click();

            return true;
        }

        return false;
    };

    try {

        // Bước 1: Nhấn "Tạo mới"
        const createBtn =
            buttons('Tạo mới').find(
                el => visible(el)
            );

        if (!createBtn) {

            return {
                ok: false,
                error:
                    'Không tìm thấy nút “Tạo mới”'
            };
        }

        createBtn.click();

        // Chờ trang ổn định
        await wait(1000);

        // Bước 2: Nếu đang ở giao diện tạo lọc → nhấn nút quay lại (back) để về giao diện điền câu
        if (isFilterInterface()) {

            if (!clickBack()) {

                return {
                    ok: false,
                    error:
                        'Không tìm thấy nút quay lại (back) trên giao diện tạo lọc'
                };
            }

            await wait(1000);
        }

        // Bước 3: Xác nhận đang ở giao diện điền câu (có nút "Tiếp theo")
        if (!isMessageInterface()) {

            return {
                ok: false,
                error:
                    'Không ở giao diện điền câu (không tìm thấy nút “Tiếp theo”)'
            };
        }

        return {
            ok: true
        };

    } catch (error) {

        return {
            ok: false,
            error: error.message
        };
    }
}

// =========================================================
// PROCESS ONE TAB
// =========================================================

async function processOneBotcake(
    tab,
    job,
    message,
    autoSave
) {

    // =====================================================
    // ACTIVE TAB
    // =====================================================

    await chrome.tabs.update(
        tab.id,
        {
            active: true
        }
    );

    await chrome.windows.update(
        tab.windowId,
        {
            focused: true
        }
    );

    /*
     * Quan trọng với tab nằm nền lâu:
     * cho Slate tỉnh lại một chút.
     */
    await sleep(
        CONFIG.TAB_READY
    );

    const target =
        await attachDebugger(
            tab.id
        );

    try {

        // Mở form, nhập tin nhắn, rồi chuyển sang bước điều kiện lọc.
        const openResult = await openCreateForm(target);
        if (!openResult?.ok) {
            throw new Error(openResult?.error || 'Không mở được form tạo mới');
        }

        await fillEditor(target, message);
        await clickNext(target);

        // Không được đi tiếp tới phần lên lịch nếu bất kỳ điều kiện lọc nào lỗi.
        const filterResult = await setFilterConditions(
            target,
            job.startDate || null,
            job.endDate || null
        );
        if (!filterResult?.ok) {
            throw new Error(filterResult?.error || 'Không tạo đủ điều kiện lọc');
        }

        // WAIT DATE
        await waitEndDate(
            target
        );

        // TIME + SAVE (ngày giờ bắt đầu + kết thúc)
        const schedule =
            await setSchedule(
                target,
                job.startDate || null,
                job.endDate || null,
                autoSave
            );

        return {
            ok: true,

            botNumber:
                job.botNumber,

            startDate:
                job.startDate || null,

            endDate:
                job.endDate || null,

            full:
                schedule.full
        };

    } finally {

        await detachDebugger(
            target
        );
    }
}

// =========================================================
// MULTI RUN
// =========================================================

async function runBotcakeMulti(
    data,
    sender
) {

    const message =
        normalizeInputText(
            data.message
        );

    if (
        !message.trim()
    ) {

        throw new Error(
            'Nội dung trống'
        );
    }

    if (
        !Array.isArray(
            data.jobs
        ) ||
        data.jobs.length === 0
    ) {

        throw new Error(
            'Chưa chọn Botcake'
        );
    }

    const windowId =
        await getWindowId(
            sender
        );

    if (
        typeof windowId !==
        'number'
    ) {

        throw new Error(
            'Không xác định được cửa sổ'
        );
    }

    // =====================================================
    // SNAPSHOT DANH SÁCH TAB
    //
    // Cực kỳ quan trọng:
    // Không query/đánh số lại giữa quá trình.
    // =====================================================

    const allTabs =
        await chrome.tabs.query({
            windowId
        });

    const botcakeTabs =
        allTabs
            .filter(tab =>
                isBotcake(
                    tab.url || ''
                )
            )
            .sort(
                (a, b) =>
                    a.index -
                    b.index
            );

    if (
        botcakeTabs.length === 0
    ) {

        throw new Error(
            'Không có tab Botcake'
        );
    }

    // =====================================================
    // VALIDATE + SORT JOB
    // =====================================================

    const startDate =
        Math.max(
            0,
            parseInt(
                data.startDate,
                10
            ) || 0
        );

    const endDate =
        Math.max(
            0,
            parseInt(
                data.endDate,
                10
            ) || 0
        );

    if (
        endDate &&
        startDate &&
        endDate <= startDate
    ) {

        throw new Error(
            'Giờ kết thúc phải sau giờ bắt đầu'
        );
    }

    const jobs =
        data.jobs
            .map(job => ({
                botNumber:
                    Math.max(
                        1,
                        parseInt(
                            job.botNumber,
                            10
                        ) || 1
                    ),

                startDate:
                    Math.max(
                        0,
                        parseInt(
                            job.startDate,
                            10
                        ) || startDate || 0
                    ),

                endDate:
                    Math.max(
                        0,
                        parseInt(
                            job.endDate,
                            10
                        ) || endDate || 0
                    )
            }))
            .sort(
                (a, b) =>
                    a.botNumber -
                    b.botNumber
            );

    /*
     * Tạo mapping # -> tab ID ngay lúc bắt đầu.
     * Việc active tab sau đó không làm mapping thay đổi.
     */

    const targets =
        jobs.map(job => {

            const tab =
                botcakeTabs[
                    job.botNumber - 1
                ];

            if (!tab) {

                throw new Error(
                    `Không có Botcake #${job.botNumber}`
                );
            }

            return {
                job,

                tab: {
                    id:
                        tab.id,

                    windowId:
                        tab.windowId,

                    index:
                        tab.index
                }
            };
        });

    // =====================================================
    // PROCESS SEQUENTIAL
    // =====================================================

    const results = [];

    const autoSave =
        Boolean(
            data.autoSave
        );

    for (
        let i = 0;
        i < targets.length;
        i++
    ) {

        const item =
            targets[i];

        const startSec =
            item.job.startDate || 0;

        const endSec =
            item.job.endDate || 0;

        const startD =
            startSec
                ? new Date(
                    startSec * 1000
                )
                : null;

        const endD =
            endSec
                ? new Date(
                    endSec * 1000
                )
                : null;

        console.log(
            `[Botcake Multi] ${i + 1}/${targets.length} - Botcake #${item.job.botNumber} - ${startD ? startD.toLocaleString('vi-VN') : '-'} -> ${endD ? endD.toLocaleString('vi-VN') : '-'}`
        );

        try {

            const oneResult =
                await processOneBotcake(
                    item.tab,
                    item.job,
                    message,
                    autoSave
                );

            results.push(
                oneResult
            );

        } catch (error) {

            console.error(
                `[Botcake Multi] Botcake #${item.job.botNumber} failed:`,
                error
            );

            /*
             * Dừng ngay nếu một tab lỗi.
             *
             * Tránh tiếp tục hàng loạt khi trạng thái
             * Botcake không như mong đợi.
             */

            throw new Error(
                `Botcake #${item.job.botNumber}: ${error.message}`
            );
        }
    }

    // =====================================================
    // DONE
    // =====================================================

    return {
        ok: true,

        completed:
            results.length,

        total:
            targets.length,

        results
    };
}