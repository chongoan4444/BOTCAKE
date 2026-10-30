const botcakeTab =
    document.getElementById(
        'botcakeTab'
    );

const tabInfo =
    document.getElementById(
        'tabInfo'
    );

const messageInput =
    document.getElementById(
        'message'
    );

const charCount =
    document.getElementById(
        'charCount'
    );

const hourInput =
    document.getElementById(
        'hour'
    );

const minuteInput =
    document.getElementById(
        'minute'
    );

const startDateInput =
    document.getElementById(
        'startDate'
    );

const startHourInput =
    document.getElementById(
        'startHour'
    );

const startMinuteInput =
    document.getElementById(
        'startMinute'
    );

const endDateInput =
    document.getElementById(
        'endDate'
    );

const endHourInput =
    document.getElementById(
        'endHour'
    );

const endMinuteInput =
    document.getElementById(
        'endMinute'
    );

const autoSave =
    document.getElementById(
        'autoSave'
    );

const saveText =
    document.getElementById(
        'saveText'
    );

const runBtn =
    document.getElementById(
        'run'
    );

const statusEl =
    document.getElementById(
        'status'
    );

function pad(n) {
    return String(n).padStart(2, '0');
}

// =========================================================
// INITIAL TIME
// =========================================================

function pad2(n) {
    return String(n).padStart(2, '0');
}

function setInitialTime() {
    const now = new Date();

    const start = new Date(now);
    start.setMinutes(
        now.getMinutes() + 15
    );

    const end = new Date(now);
    end.setMinutes(
        now.getMinutes() + 45
    );

    // ===== END TIME (existing) =====
    hourInput.value =
        pad2(end.getHours());

    minuteInput.value =
        pad2(end.getMinutes());

    // ===== START TIME =====
    startDateInput.valueAsDate =
        start;

    startHourInput.value =
        pad2(start.getHours());

    startMinuteInput.value =
        pad2(start.getMinutes());

    // ===== END DATE =====
    endDateInput.valueAsDate =
        end;

    endHourInput.value =
        pad2(end.getHours());

    endMinuteInput.value =
        pad2(end.getMinutes());
}

// =========================================================
// STORAGE
// =========================================================

chrome.storage.local.get(
    [
        'autoSave',
        'message'
    ],
    data => {
        autoSave.checked =
            data.autoSave !== false;

        messageInput.value =
            data.message || '';

        updateSaveText();
        updateCount();
    }
);

// =========================================================
// MESSAGE
// =========================================================

function updateCount() {
    charCount.textContent =
        `${messageInput.value.length} / 1200`;
}

messageInput.addEventListener(
    'input',
    () => {
        updateCount();

        chrome.storage.local.set({
            message:
                messageInput.value
        });
    }
);

// =========================================================
// SAVE
// =========================================================

function updateSaveText() {
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
        chrome.storage.local.set({
            autoSave:
                autoSave.checked
        });

        updateSaveText();
    }
);

// =========================================================
// LOAD TABS
// =========================================================

async function loadBotcakeTabs() {
    const tabs =
        await chrome.tabs.query({});

    const botTabs =
        tabs
            .filter(tab => {
                try {
                    const hostname = new URL(tab.url).hostname;
                    return (
                        hostname === 'botcake.io' ||
                        hostname === 'www.botcake.io'
                    );
                } catch (_) {
                    return false;
                }
            })
            .sort(
                (a, b) =>
                    a.index - b.index
            );

    botcakeTab.innerHTML = '';

    if (!botTabs.length) {
        const option =
            document.createElement(
                'option'
            );

        option.value = '1';

        option.textContent =
            'Không có Botcake';

        botcakeTab.appendChild(
            option
        );

        botcakeTab.disabled =
            true;

        runBtn.disabled =
            true;

        tabInfo.textContent =
            '❌ Không tìm thấy Botcake';

        return;
    }

    botTabs.forEach(
        (tab, index) => {
            const option =
                document.createElement(
                    'option'
                );

            option.value =
                String(index + 1);

            option.textContent =
                `Botcake #${index + 1}`;

            botcakeTab.appendChild(
                option
            );
        }
    );

    // Mặc định luôn 1
    botcakeTab.value = '1';

    tabInfo.textContent =
        `Có ${botTabs.length} tab Botcake`;
}

// =========================================================
// QUICK ADD
// =========================================================

document.querySelectorAll(
    '.quick button'
).forEach(button => {
    button.addEventListener(
        'click',
        () => {
            let hour =
                parseInt(
                    hourInput.value,
                    10
                ) || 0;

            let minute =
                parseInt(
                    minuteInput.value,
                    10
                ) || 0;

            const add =
                parseInt(
                    button.dataset.add,
                    10
                );

            const d = new Date();

            d.setHours(
                hour,
                minute,
                0,
                0
            );

            d.setMinutes(
                d.getMinutes() + add
            );

            hourInput.value =
                pad(d.getHours());

            minuteInput.value =
                pad(d.getMinutes());
        }
    );
});

// =========================================================
// GET TIME
// =========================================================

function parseDateTime(dateInput, hourInput, minuteInput) {
    const d = dateInput.valueAsDate || new Date();

    let hour =
        parseInt(
            hourInput.value,
            10
        );

    let minute =
        parseInt(
            minuteInput.value,
            10
        );

    if (
        Number.isNaN(hour) ||
        hour < 0 ||
        hour > 23
    ) {
        hour = 0;
    }

    if (
        Number.isNaN(minute) ||
        minute < 0 ||
        minute > 59
    ) {
        minute = 0;
    }

    d.setHours(
        hour,
        minute,
        0,
        0
    );

    // Trả về unix timestamp (giây) chuẩn theo dữ liệu HAR Botcake
    return Math.floor(
        d.getTime() / 1000
    );
}

function getTime() {
    return {
        startDate: parseDateTime(
            startDateInput,
            startHourInput,
            startMinuteInput
        ),

        endDate: parseDateTime(
            endDateInput,
            endHourInput,
            endMinuteInput
        )
    };
}

// =========================================================
// RUN
// =========================================================

runBtn.addEventListener(
    'click',
    () => {
        const text =
            messageInput.value;

        if (!text.trim()) {
            statusEl.textContent =
                '❌ Hãy nhập nội dung';

            statusEl.style.color =
                '#ff6b6b';

            messageInput.focus();

            return;
        }

        const time =
            getTime();

        const botNumber =
            parseInt(
                botcakeTab.value,
                10
            ) || 1;

        if (
            time.endDate <= time.startDate
        ) {
            statusEl.textContent =
                '❌ Giờ kết thúc phải sau giờ bắt đầu';

            statusEl.style.color =
                '#ff6b6b';

            endDateInput.focus();

            return;
        }

        runBtn.disabled =
            true;

        statusEl.textContent =
            `⏳ Chạy Botcake #${botNumber}...`;

        statusEl.style.color =
            '#74c0fc';

        /*
         * Khi background chuyển tab,
         * popup Chrome tự đóng.
         *
         * Vì vậy không cần await.
         */

        chrome.runtime
            .sendMessage({
                action:
                    'RUN_BOTCAKE',

                botNumber,

                message:
                    text,

                startDate:
                    time.startDate,

                endDate:
                    time.endDate,

                autoSave:
                    autoSave.checked
            })
            .catch(() => {});

        statusEl.textContent =
            '✅ Đã gửi lệnh';

        statusEl.style.color =
            '#51cf66';
    }
);

setInitialTime();
loadBotcakeTabs();