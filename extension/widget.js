(() => {
    'use strict';

    // =========================================================
    // ĐÃ CÓ WIDGET -> HIỆN LẠI
    // =========================================================

    const existing =
        document.getElementById(
            'bc-floating-root'
        );

    if (existing) {
        existing.style.display = 'block';
        return;
    }

    // =========================================================
    // STORAGE
    // =========================================================

    const STORAGE = {
        POSITION:
            'bc_multi_position_v6',

        MINIMIZED:
            'bc_multi_minimized_v6',

        MESSAGE:
            'bc_multi_message_v6',

        AUTO_SAVE:
            'bc_multi_autosave_v6',

        SELECTED:
            'bc_multi_selected_v6',

        TIMES:
            'bc_multi_times_v6'
    };

    // =========================================================
    // BASIC
    // =========================================================

    const pad = (n) =>
        String(n).padStart(2, '0');

    function getDefaultTime() {
        const now = new Date();

        const start = new Date(now);
        start.setMinutes(
            now.getMinutes() + 15
        );

        const end = new Date(now);
        end.setMinutes(
            now.getMinutes() + 45
        );

        return {
            startDate: Math.floor(start.getTime() / 1000),
            endDate: Math.floor(end.getTime() / 1000)
        };
    }

    function clampHour(value) {
        value =
            parseInt(value, 10);

        if (
            Number.isNaN(value)
        ) {
            value = 0;
        }

        return Math.max(
            0,
            Math.min(
                23,
                value
            )
        );
    }

    function clampMinute(value) {
        value =
            parseInt(value, 10);

        if (
            Number.isNaN(value)
        ) {
            value = 0;
        }

        return Math.max(
            0,
            Math.min(
                59,
                value
            )
        );
    }

    // =========================================================
    // STATE
    // =========================================================

    let botcakeTabs = [];

    let selectedNumbers =
        new Set();

    let savedTimes = {};

    // =========================================================
    // ROOT
    // =========================================================

    const root =
        document.createElement(
            'div'
        );

    root.id =
        'bc-floating-root';

    root.innerHTML = `

        <div id="bc-floating-panel">

            <!-- HEADER -->
            <div
                id="bc-drag-handle"
                class="bc-header"
            >

                <div class="bc-header-title">
                    ⏰ BOTCAKE AUTO
                </div>

                <div class="bc-header-actions">

                    <button
                        id="bc-refresh-tabs"
                        class="bc-window-btn"
                        type="button"
                        title="Làm mới danh sách Botcake"
                    >
                        ↻
                    </button>

                    <button
                        id="bc-minimize"
                        class="bc-window-btn"
                        type="button"
                        title="Thu nhỏ"
                    >
                        −
                    </button>

                    <button
                        id="bc-close"
                        class="bc-window-btn bc-close-btn"
                        type="button"
                        title="Đóng"
                    >
                        ×
                    </button>

                </div>

            </div>

            <!-- BODY -->
            <div class="bc-body">

                <!-- MESSAGE -->
                <div class="bc-section">

                    <div class="bc-section-title">
                        NỘI DUNG TIN NHẮN
                    </div>

                    <textarea
                        id="bc-message"
                        maxlength="1200"
                        placeholder="Nhập nội dung..."
                    ></textarea>

                    <div id="bc-char-count">
                        0 / 1200
                    </div>

                </div>

                <!-- BOTCAKE -->
                <div class="bc-section">

                    <div class="bc-botcake-heading">

                        <div class="bc-section-title">
                            BOTCAKE & GIỜ KẾT THÚC
                        </div>

                        <div class="bc-select-actions">

                            <button
                                id="bc-select-all"
                                type="button"
                            >
                                Tất cả
                            </button>

                            <button
                                id="bc-select-none"
                                type="button"
                            >
                                Bỏ chọn
                            </button>

                        </div>

                    </div>

                    <div id="bc-tab-info">
                        Đang tìm Botcake...
                    </div>

                    <div id="bc-tab-list"></div>

                </div>

                <!-- AUTO SAVE -->
                <div class="bc-auto-save">

                    <div>

                        <div class="bc-save-title">
                            💾 TỰ LƯU
                        </div>

                        <div id="bc-save-text">
                            Đang bật
                        </div>

                    </div>

                    <label class="bc-switch">

                        <input
                            id="bc-auto-save"
                            type="checkbox"
                        >

                        <span class="bc-slider"></span>

                    </label>

                </div>

                <!-- RUN -->
                <button
                    id="bc-run"
                    type="button"
                >
                    ⚡ CHỌN BOTCAKE
                </button>

                <div id="bc-widget-status">
                    Sẵn sàng
                </div>

            </div>

        </div>

        <!-- MINI -->
        <div
            id="bc-mini-circle"
            title="Botcake Auto"
        >
            ⏰
        </div>
    `;

    document.documentElement
        .appendChild(root);

    // =========================================================
    // ELEMENTS
    // =========================================================

    const panel =
        root.querySelector(
            '#bc-floating-panel'
        );

    const dragHandle =
        root.querySelector(
            '#bc-drag-handle'
        );

    const refreshBtn =
        root.querySelector(
            '#bc-refresh-tabs'
        );

    const minimizeBtn =
        root.querySelector(
            '#bc-minimize'
        );

    const closeBtn =
        root.querySelector(
            '#bc-close'
        );

    const miniCircle =
        root.querySelector(
            '#bc-mini-circle'
        );

    const messageInput =
        root.querySelector(
            '#bc-message'
        );

    const charCount =
        root.querySelector(
            '#bc-char-count'
        );

    const tabInfo =
        root.querySelector(
            '#bc-tab-info'
        );

    const tabList =
        root.querySelector(
            '#bc-tab-list'
        );

    const selectAllBtn =
        root.querySelector(
            '#bc-select-all'
        );

    const selectNoneBtn =
        root.querySelector(
            '#bc-select-none'
        );

    const autoSave =
        root.querySelector(
            '#bc-auto-save'
        );

    const saveText =
        root.querySelector(
            '#bc-save-text'
        );

    const runBtn =
        root.querySelector(
            '#bc-run'
        );

    const statusEl =
        root.querySelector(
            '#bc-widget-status'
        );

    // =========================================================
    // MESSAGE
    // =========================================================

    function updateCharCount() {
        charCount.textContent =
            `${messageInput.value.length} / 1200`;
    }

    messageInput.addEventListener(
        'input',
        () => {

            updateCharCount();

            chrome.storage.local.set({
                [STORAGE.MESSAGE]:
                    messageInput.value
            });
        }
    );

    // =========================================================
    // AUTOSAVE
    // =========================================================

    function updateAutoSaveUI() {

        if (autoSave.checked) {

            saveText.textContent =
                'Đang bật';

            saveText.style.color =
                '#51cf66';

        } else {

            saveText.textContent =
                'Đang tắt';

            saveText.style.color =
                '#868e96';
        }
    }

    autoSave.addEventListener(
        'change',
        () => {

            updateAutoSaveUI();

            chrome.storage.local.set({
                [STORAGE.AUTO_SAVE]:
                    autoSave.checked
            });
        }
    );

    // =========================================================
    // SAVE SELECTED
    // =========================================================

    function saveSelected() {

        chrome.storage.local.set({
            [STORAGE.SELECTED]:
                [...selectedNumbers]
        });
    }

    function saveTimes() {

        chrome.storage.local.set({
            [STORAGE.TIMES]:
                savedTimes
        });
    }

    // =========================================================
    // UPDATE RUN BUTTON
    // =========================================================

    function updateRunButton() {

        const count =
            selectedNumbers.size;

        if (
            botcakeTabs.length === 0
        ) {

            runBtn.disabled =
                true;

            runBtn.textContent =
                '❌ KHÔNG CÓ BOTCAKE';

            return;
        }

        if (
            count === 0
        ) {

            runBtn.disabled =
                false;

            runBtn.textContent =
                '⚡ CHỌN BOTCAKE';

            return;
        }

        runBtn.disabled =
            false;

        runBtn.textContent =
            count === 1
                ? '⚡ CHẠY 1 BOTCAKE'
                : `⚡ CHẠY ${count} BOTCAKE`;
    }

    // =========================================================
    // CREATE TAB ROW
    // =========================================================

    function createTabRow(
        tab,
        number
    ) {

        const defaultTime = getDefaultTime();
        const existingTime = savedTimes[String(number)] || {};
        const defaultStart = new Date(defaultTime.startDate * 1000);
        const defaultEnd = new Date(defaultTime.endDate * 1000);

        function getDateField(value, fallbackDate) {
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                return value;
            }

            const date = typeof value === 'number'
                ? new Date(value * 1000)
                : fallbackDate;

            return [
                date.getFullYear(),
                pad(date.getMonth() + 1),
                pad(date.getDate())
            ].join('-');
        }

        const legacyStart = typeof existingTime.startDate === 'number'
            ? new Date(existingTime.startDate * 1000)
            : defaultStart;
        const legacyEnd = typeof existingTime.endDate === 'number'
            ? new Date(existingTime.endDate * 1000)
            : defaultEnd;

        const startDateValue = getDateField(existingTime.startDate, defaultStart);
        const endDateValue = getDateField(existingTime.endDate, defaultEnd);
        const startHourValue = existingTime.startHour ?? pad(legacyStart.getHours());
        const startMinuteValue = existingTime.startMinute ?? pad(legacyStart.getMinutes());
        const endHourValue = existingTime.endHour ?? existingTime.hour ?? pad(legacyEnd.getHours());
        const endMinuteValue = existingTime.endMinute ?? existingTime.minute ?? pad(legacyEnd.getMinutes());

        const row =
            document.createElement(
                'div'
            );

        row.className =
            'bc-tab-row';

        row.dataset.number =
            String(number);

        const checked =
            selectedNumbers.has(
                number
            );

        row.innerHTML = `

            <label class="bc-tab-check-wrap">

                <input
                    type="checkbox"
                    class="bc-tab-check"
                    ${checked ? 'checked' : ''}
                >

                <span class="bc-tab-check-label">
                    #${number}
                </span>

            </label>

            <div class="bc-tab-time">

                <div class="bc-time-group">

                    <label class="bc-time-label">Từ</label>

                    <input
                        type="date"
                        class="bc-tab-start-date"
                        value="${startDateValue}"
                        ${checked ? '' : 'disabled'}
                    >

                    <input
                        type="text"
                        inputmode="numeric"
                        maxlength="2"
                        class="bc-tab-start-hour"
                        value="${startHourValue}"
                        ${checked ? '' : 'disabled'}
                    >

                    <span>:</span>

                    <input
                        type="text"
                        inputmode="numeric"
                        maxlength="2"
                        class="bc-tab-start-minute"
                        value="${startMinuteValue}"
                        ${checked ? '' : 'disabled'}
                    >

                </div>

                <div class="bc-time-group">

                    <label class="bc-time-label">Đến</label>

                    <input
                        type="date"
                        class="bc-tab-end-date"
                        value="${endDateValue}"
                        ${checked ? '' : 'disabled'}
                    >

                    <input
                        type="text"
                        inputmode="numeric"
                        maxlength="2"
                        class="bc-tab-end-hour"
                        value="${endHourValue}"
                        ${checked ? '' : 'disabled'}
                    >

                    <span>:</span>

                    <input
                        type="text"
                        inputmode="numeric"
                        maxlength="2"
                        class="bc-tab-end-minute"
                        value="${endMinuteValue}"
                        ${checked ? '' : 'disabled'}
                    >

                </div>

            </div>
        `;

        const checkbox =
            row.querySelector(
                '.bc-tab-check'
            );

        const startDateInput =
            row.querySelector(
                '.bc-tab-start-date'
            );

        const startHourInput =
            row.querySelector(
                '.bc-tab-start-hour'
            );

        const startMinuteInput =
            row.querySelector(
                '.bc-tab-start-minute'
            );

        const endDateInput =
            row.querySelector(
                '.bc-tab-end-date'
            );

        const endHourInput =
            row.querySelector(
                '.bc-tab-end-hour'
            );

        const endMinuteInput =
            row.querySelector(
                '.bc-tab-end-minute'
            );

        const timeInputs = [
            startDateInput,
            startHourInput,
            startMinuteInput,
            endDateInput,
            endHourInput,
            endMinuteInput
        ];

        // =====================================================
        // CHECKBOX
        // =====================================================

        checkbox.addEventListener(
            'change',
            () => {

                if (
                    checkbox.checked
                ) {

                    selectedNumbers.add(
                        number
                    );

                    timeInputs.forEach(
                        input => {
                            input.disabled =
                                false;
                        }
                    );

                    row.classList.add(
                        'bc-tab-row-selected'
                    );

                } else {

                    selectedNumbers.delete(
                        number
                    );

                    timeInputs.forEach(
                        input => {
                            input.disabled =
                                true;
                        }
                    );

                    row.classList.remove(
                        'bc-tab-row-selected'
                    );
                }

                saveSelected();

                updateRunButton();
            }
        );

        // =====================================================
        // ONLY NUMBER
        // =====================================================

        function saveRowTime() {
            savedTimes[String(number)] = {
                startDate: startDateInput.value,
                startHour: startHourInput.value,
                startMinute: startMinuteInput.value,
                endDate: endDateInput.value,
                endHour: endHourInput.value,
                endMinute: endMinuteInput.value
            };
            saveTimes();
        }

        [
            startDateInput,
            startHourInput,
            startMinuteInput,
            endDateInput,
            endHourInput,
            endMinuteInput
        ].forEach(input => {
            input.addEventListener('input', () => {
                if (input.type === 'text') {
                    input.value = input.value.replace(/\D/g, '').slice(0, 2);
                }
                saveRowTime();
            });
            input.addEventListener('change', saveRowTime);
            input.addEventListener('blur', saveRowTime);
        });

        // Persist initial defaults too, so a page refresh does not reset them.
        saveRowTime();

        if (checked) {

            row.classList.add(
                'bc-tab-row-selected'
            );
        }

        return row;
    }

    // =========================================================
    // RENDER TABS
    // =========================================================

    function renderTabs() {

        tabList.innerHTML = '';

        /*
         * Loại lựa chọn không còn tồn tại.
         */
        selectedNumbers =
            new Set(
                [...selectedNumbers]
                    .filter(number =>
                        number >= 1 &&
                        number <=
                            botcakeTabs.length
                    )
            );

        botcakeTabs.forEach(
            (tab, index) => {

                const number =
                    index + 1;

                tabList.appendChild(
                    createTabRow(
                        tab,
                        number
                    )
                );
            }
        );

        tabInfo.textContent =
            botcakeTabs.length
                ? `Có ${botcakeTabs.length} tab Botcake`
                : '❌ Không tìm thấy tab Botcake';

        updateRunButton();
    }

    // =========================================================
    // LOAD BOTCAKE TABS
    // =========================================================

    async function loadBotcakeTabs() {

        refreshBtn.disabled =
            true;

        try {

            // Use the callback API for compatibility with Chrome builds where
            // runtime.sendMessage does not return a Promise from injected scripts.
            const response = await new Promise(
                (resolve, reject) => {
                    chrome.runtime.sendMessage(
                        {
                            action: 'GET_BOTCAKE_TABS'
                        },
                        result => {
                            const runtimeError =
                                chrome.runtime.lastError;

                            if (runtimeError) {
                                reject(new Error(runtimeError.message));
                                return;
                            }

                            resolve(result);
                        }
                    );
                }
            );

            if (
                !response ||
                !response.ok
            ) {

                throw new Error(
                    response?.error ||
                    'Không đọc được tab'
                );
            }

            botcakeTabs =
                response.tabs || [];

            renderTabs();

        } catch (error) {

            console.error(
                '[Botcake Widget] GET_BOTCAKE_TABS failed:',
                error
            );

            botcakeTabs = [];

            tabInfo.textContent =
                `❌ Không đọc được tab Botcake: ${error?.message || error}`;

            tabList.innerHTML = '';

            updateRunButton();

        } finally {

            refreshBtn.disabled =
                false;
        }
    }

    refreshBtn.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            loadBotcakeTabs();
        }
    );

    // =========================================================
    // SELECT ALL
    // =========================================================

    selectAllBtn.addEventListener(
        'click',
        () => {

            selectedNumbers.clear();

            botcakeTabs.forEach(
                (_, index) => {

                    selectedNumbers.add(
                        index + 1
                    );
                }
            );

            saveSelected();

            renderTabs();
        }
    );

    // =========================================================
    // SELECT NONE
    // =========================================================

    selectNoneBtn.addEventListener(
        'click',
        () => {

            selectedNumbers.clear();

            saveSelected();

            renderTabs();
        }
    );

    // =========================================================
    // GET JOBS
    // =========================================================

    function collectJobs() {

        const jobs = [];

        const rows = [
            ...tabList.querySelectorAll(
                '.bc-tab-row'
            )
        ];

        for (
            const row of rows
        ) {

            const number =
                parseInt(
                    row.dataset.number,
                    10
                );

            const checkbox =
                row.querySelector(
                    '.bc-tab-check'
                );

            if (
                !checkbox.checked
            ) {
                continue;
            }

            const startDateInput =
                row.querySelector(
                    '.bc-tab-start-date'
                );

            const startHourInput =
                row.querySelector(
                    '.bc-tab-start-hour'
                );

            const startMinuteInput =
                row.querySelector(
                    '.bc-tab-start-minute'
                );

            const endDateInput =
                row.querySelector(
                    '.bc-tab-end-date'
                );

            const endHourInput =
                row.querySelector(
                    '.bc-tab-end-hour'
                );

            const endMinuteInput =
                row.querySelector(
                    '.bc-tab-end-minute'
                );

            function toLocalTimestamp(dateValue, hourValue, minuteValue) {
                const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue || '');
                const hour = parseInt(hourValue, 10);
                const minute = parseInt(minuteValue, 10);

                if (!match || Number.isNaN(hour) || Number.isNaN(minute)) {
                    throw new Error(`Hãy nhập đủ ngày giờ cho Botcake #${number}`);
                }

                const year = Number(match[1]);
                const month = Number(match[2]);
                const day = Number(match[3]);
                const validHour = clampHour(hour);
                const validMinute = clampMinute(minute);
                const date = new Date(year, month - 1, day, validHour, validMinute, 0, 0);

                if (
                    date.getFullYear() !== year ||
                    date.getMonth() !== month - 1 ||
                    date.getDate() !== day
                ) {
                    throw new Error(`Ngày không hợp lệ cho Botcake #${number}`);
                }

                return Math.floor(date.getTime() / 1000);
            }

            const times = {
                startDate: toLocalTimestamp(
                    startDateInput.value,
                    startHourInput.value,
                    startMinuteInput.value
                ),
                endDate: toLocalTimestamp(
                    endDateInput.value,
                    endHourInput.value,
                    endMinuteInput.value
                )
            };

            if (times.endDate <= times.startDate) {
                throw new Error(`Giờ kết thúc phải sau giờ bắt đầu cho Botcake #${number}`);
            }

            savedTimes[
                String(number)
            ] = times;

            jobs.push({
                botNumber:
                    number,

                startDate: times.startDate,

                endDate: times.endDate
            });
        }

        saveTimes();

        /*
         * Luôn xử lý #1 -> #2 -> #3...
         */
        jobs.sort(
            (a, b) =>
                a.botNumber -
                b.botNumber
        );

        return jobs;
    }

    // =========================================================
    // RUN
    // =========================================================

    runBtn.addEventListener(
        'click',
        () => {

            const message =
                messageInput.value;

            if (
                !message.trim()
            ) {

                statusEl.textContent =
                    '❌ Hãy nhập nội dung';

                statusEl.style.color =
                    '#ff6b6b';

                messageInput.focus();

                return;
            }

            let jobs;
            try {
                jobs = collectJobs();
            } catch (error) {
                statusEl.textContent = `❌ ${error.message}`;
                statusEl.style.color = '#ff6b6b';
                return;
            }

            if (
                jobs.length === 0
            ) {

                statusEl.textContent =
                    '❌ Chưa chọn Botcake';

                statusEl.style.color =
                    '#ff6b6b';

                return;
            }

            runBtn.disabled =
                true;

            statusEl.textContent =
                `⏳ Đang chạy ${jobs.length} Botcake...`;

            statusEl.style.color =
                '#74c0fc';

            chrome.storage.local.set({
                [STORAGE.MESSAGE]:
                    message
            });

            /*
             * Background xử lý tuần tự.
             * Widget ở tab hiện tại vẫn còn nguyên.
             */
            chrome.runtime.sendMessage({
                action:
                    'RUN_BOTCAKE_MULTI',

                jobs,

                message,

                autoSave:
                    autoSave.checked
            })
            .then(response => {

                if (
                    !response ||
                    !response.ok
                ) {

                    statusEl.textContent =
                        `❌ ${response?.error || 'Có lỗi'}`;

                    statusEl.style.color =
                        '#ff6b6b';

                    return;
                }

                statusEl.textContent =
                    `✅ Xong ${response.completed}/${jobs.length}`;

                statusEl.style.color =
                    '#51cf66';
            })
            .catch(error => {

                statusEl.textContent =
                    `❌ ${error.message}`;

                statusEl.style.color =
                    '#ff6b6b';

            })
            .finally(() => {

                runBtn.disabled =
                    false;

                updateRunButton();
            });
        }
    );

    // =========================================================
    // POSITION
    // =========================================================

    function setPosition(
        x,
        y
    ) {

        const minimized =
            root.classList.contains(
                'bc-minimized'
            );

        const width =
            minimized
                ? 48
                : 320;

        const height =
            minimized
                ? 48
                : Math.max(
                    100,
                    panel.offsetHeight
                );

        const maxX =
            Math.max(
                0,
                window.innerWidth -
                    width
            );

        const maxY =
            Math.max(
                0,
                window.innerHeight -
                    height
            );

        x =
            Math.max(
                0,
                Math.min(
                    x,
                    maxX
                )
            );

        y =
            Math.max(
                0,
                Math.min(
                    y,
                    maxY
                )
            );

        root.style.left =
            `${x}px`;

        root.style.top =
            `${y}px`;

        root.style.right =
            'auto';
    }

    function savePosition() {

        const rect =
            root.getBoundingClientRect();

        chrome.storage.local.set({
            [STORAGE.POSITION]: {
                x:
                    rect.left,

                y:
                    rect.top
            }
        });
    }

    // =========================================================
    // DRAG
    // =========================================================

    function makeDraggable(
        handle
    ) {

        let dragging =
            false;

        let moved =
            false;

        let startX =
            0;

        let startY =
            0;

        let originX =
            0;

        let originY =
            0;

        handle.addEventListener(
            'pointerdown',
            event => {

                if (
                    event.target.closest(
                        'button,input,textarea,select,label'
                    )
                ) {
                    return;
                }

                const rect =
                    root.getBoundingClientRect();

                dragging = true;
                moved = false;

                startX =
                    event.clientX;

                startY =
                    event.clientY;

                originX =
                    rect.left;

                originY =
                    rect.top;

                try {

                    handle.setPointerCapture(
                        event.pointerId
                    );

                } catch (_) {}

                event.preventDefault();
            }
        );

        handle.addEventListener(
            'pointermove',
            event => {

                if (
                    !dragging
                ) {
                    return;
                }

                const dx =
                    event.clientX -
                    startX;

                const dy =
                    event.clientY -
                    startY;

                if (
                    Math.abs(dx) > 3 ||
                    Math.abs(dy) > 3
                ) {

                    moved = true;
                }

                setPosition(
                    originX + dx,
                    originY + dy
                );

                event.preventDefault();
            }
        );

        function stopDrag(
            event
        ) {

            if (
                !dragging
            ) {
                return;
            }

            dragging =
                false;

            try {

                handle.releasePointerCapture(
                    event.pointerId
                );

            } catch (_) {}

            handle.dataset.bcMoved =
                moved
                    ? '1'
                    : '0';

            savePosition();

            setTimeout(
                () => {

                    handle.dataset.bcMoved =
                        '0';

                },
                100
            );
        }

        handle.addEventListener(
            'pointerup',
            stopDrag
        );

        handle.addEventListener(
            'pointercancel',
            stopDrag
        );
    }

    makeDraggable(
        dragHandle
    );

    makeDraggable(
        miniCircle
    );

    // =========================================================
    // MINIMIZE
    // =========================================================

    minimizeBtn.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            const rect =
                root.getBoundingClientRect();

            root.classList.add(
                'bc-minimized'
            );

            setPosition(
                rect.left,
                rect.top
            );

            savePosition();

            chrome.storage.local.set({
                [STORAGE.MINIMIZED]:
                    true
            });
        }
    );

    // =========================================================
    // RESTORE
    // =========================================================

    miniCircle.addEventListener(
        'click',
        () => {

            if (
                miniCircle.dataset
                    .bcMoved === '1'
            ) {
                return;
            }

            const rect =
                root.getBoundingClientRect();

            root.classList.remove(
                'bc-minimized'
            );

            setPosition(
                rect.left,
                rect.top
            );

            savePosition();

            chrome.storage.local.set({
                [STORAGE.MINIMIZED]:
                    false
            });

            loadBotcakeTabs();
        }
    );

    // =========================================================
    // CLOSE
    // =========================================================

    closeBtn.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            savePosition();

            root.remove();
        }
    );

    // =========================================================
    // WINDOW RESIZE
    // =========================================================

    window.addEventListener(
        'resize',
        () => {

            const rect =
                root.getBoundingClientRect();

            setPosition(
                rect.left,
                rect.top
            );

            savePosition();
        }
    );

    // =========================================================
    // LOAD STORAGE
    // =========================================================

    chrome.storage.local.get(
        [
            STORAGE.POSITION,
            STORAGE.MINIMIZED,
            STORAGE.MESSAGE,
            STORAGE.AUTO_SAVE,
            STORAGE.SELECTED,
            STORAGE.TIMES
        ],
        data => {

            // MESSAGE
            messageInput.value =
                typeof data[
                    STORAGE.MESSAGE
                ] === 'string'
                    ? data[
                        STORAGE.MESSAGE
                    ]
                    : '';

            updateCharCount();

            // AUTO SAVE
            autoSave.checked =
                data[
                    STORAGE.AUTO_SAVE
                ] !== false;

            updateAutoSaveUI();

            // SELECTED
            if (
                Array.isArray(
                    data[
                        STORAGE.SELECTED
                    ]
                )
            ) {

                selectedNumbers =
                    new Set(
                        data[
                            STORAGE.SELECTED
                        ]
                            .map(Number)
                            .filter(Number.isFinite)
                    );
            }

            // Nếu chưa từng chọn gì:
            // mặc định Botcake #1
            if (
                data[
                    STORAGE.SELECTED
                ] === undefined
            ) {

                selectedNumbers.add(
                    1
                );
            }

            // TIMES
            if (
                data[
                    STORAGE.TIMES
                ] &&
                typeof data[
                    STORAGE.TIMES
                ] === 'object'
            ) {

                savedTimes =
                    data[
                        STORAGE.TIMES
                    ];
            }

            // MINIMIZED
            if (
                data[
                    STORAGE.MINIMIZED
                ] === true
            ) {

                root.classList.add(
                    'bc-minimized'
                );
            }

            // POSITION
            const position =
                data[
                    STORAGE.POSITION
                ];

            if (
                position &&
                typeof position.x ===
                    'number' &&
                typeof position.y ===
                    'number'
            ) {

                setPosition(
                    position.x,
                    position.y
                );
            }

            loadBotcakeTabs();
        }
    );

})();