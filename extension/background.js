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
        return (
            new URL(url)
                .hostname ===
            'botcake.io'
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

        if (
            !tab?.id ||
            !tab?.url
        ) {
            return;
        }

        if (
            tab.url.startsWith('chrome://') ||
            tab.url.startsWith('chrome-extension://') ||
            tab.url.startsWith('edge://') ||
            tab.url.startsWith('about:')
        ) {
            return;
        }

        try {

            await chrome.scripting.insertCSS({
                target: {
                    tabId: tab.id
                },

                files: [
                    'widget.css'
                ]
            });

            await chrome.scripting.executeScript({
                target: {
                    tabId: tab.id
                },

                files: [
                    'widget.js'
                ]
            });

        } catch (error) {

            console.error(
                '[Botcake Widget]',
                error
            );
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

                    jobs: [
                        {
                            botNumber:
                                message.botNumber,

                            hour:
                                message.hour,

                            minute:
                                message.minute
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

    const tabs =
        await chrome.tabs.query({
            windowId
        });

    const botcakeTabs =
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

    function today() {

        const d =
            new Date();

        return (
            pad(d.getDate()) +
            '/' +
            pad(
                d.getMonth() + 1
            ) +
            '/' +
            d.getFullYear()
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

    try {

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
            today() +
            ' ' +
            pad(data.hour) +
            ':' +
            pad(data.minute);

        input.focus();

        setValue(
            input,
            full
        );

        await wait(10);

        click(
            input
        );

        // =================================================
        // DROPDOWN
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

            // HOUR
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
            full
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
    hour,
    minute,
    autoSave
) {

    const expression =
        '(' +
        pageSchedule.toString() +
        ')(' +
        JSON.stringify({
            hour,
            minute,
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

        // CONTENT
        await fillEditor(
            target,
            message
        );

        // NEXT
        await clickNext(
            target
        );

        // WAIT DATE
        await waitEndDate(
            target
        );

        // TIME + SAVE
        const schedule =
            await setSchedule(
                target,
                Math.max(
                    0,
                    Math.min(
                        23,
                        Number(
                            job.hour
                        ) || 0
                    )
                ),
                Math.max(
                    0,
                    Math.min(
                        59,
                        Number(
                            job.minute
                        ) || 0
                    )
                ),
                autoSave
            );

        return {
            ok: true,

            botNumber:
                job.botNumber,

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

                hour:
                    Math.max(
                        0,
                        Math.min(
                            23,
                            parseInt(
                                job.hour,
                                10
                            ) || 0
                        )
                    ),

                minute:
                    Math.max(
                        0,
                        Math.min(
                            59,
                            parseInt(
                                job.minute,
                                10
                            ) || 0
                        )
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

        console.log(
            `[Botcake Multi] ${i + 1}/${targets.length} - Botcake #${item.job.botNumber} - ${item.job.hour}:${item.job.minute}`
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