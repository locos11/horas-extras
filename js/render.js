/* ============================================
   RENDER MODULE
   All DOM rendering, modals, toasts, and UI
   ============================================ */

// ===== VIEW TRANSITIONS =====
let _currentView = 'view-dashboard';

function showView(viewId, direction) {
    direction = direction || 'forward';
    if (viewId === _currentView) return;

    const oldView = document.getElementById(_currentView);
    const newView = document.getElementById(viewId);

    // Hide old view immediately
    oldView.classList.remove('active', 'view-enter-forward', 'view-enter-back');

    // Show new view with enter animation
    const enterClass = direction === 'forward' ? 'view-enter-forward' : 'view-enter-back';
    newView.classList.remove('view-enter-forward', 'view-enter-back');
    void newView.offsetWidth; // Force reflow to restart animation
    newView.classList.add('active', enterClass);
    newView.addEventListener('animationend', function handler() {
        newView.classList.remove(enterClass);
        newView.removeEventListener('animationend', handler);
    }, { once: true });

    _currentView = viewId;

    const fab = document.getElementById('fab-add');
    if (viewId === 'view-dashboard') {
        fab.classList.remove('hidden');
    } else {
        fab.classList.add('hidden');
    }
}

// ===== RENDER: DASHBOARD =====
function renderDashboard() {
    const now = new Date();
    const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();

    document.getElementById('current-month-name').textContent =
        MONTH_NAMES[currentMonth] + ' ' + currentYear;

    const badge = document.getElementById('current-month-badge');
    badge.style.display = isCurrentMonth ? 'inline-block' : 'none';

    const summary = getMonthSummary(currentYear, currentMonth);
    document.getElementById('total-hours').textContent = formatHours(summary.totalHours);
    document.getElementById('total-money').textContent = formatMoney(summary.totalMoney);

    // Deficit indicator
    const deficitEl = document.getElementById('deficit-indicator');
    if (deficitEl) {
        if (summary.totalDeficit < 0) {
            deficitEl.style.display = 'flex';
            deficitEl.querySelector('.deficit-value').textContent = formatHours(summary.totalDeficit);
        } else {
            deficitEl.style.display = 'none';
        }
    }

    const records = getMonthRecords(currentYear, currentMonth);
    const listEl = document.getElementById('records-list');
    const emptyEl = document.getElementById('empty-state');

    if (records.length === 0) {
        listEl.style.display = 'none';
        emptyEl.style.display = 'block';
    } else {
        listEl.style.display = 'flex';
        emptyEl.style.display = 'none';

        const sorted = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
        const settings = getSettings();

        listEl.innerHTML = sorted.map((record, i) => {
            const dateInfo = formatDate(record.date);
            const money = record.overtimeHours * settings.hourlyRate;
            const safeTitle = record.title ? escapeHtml(record.title) : '';
            const safeStartTime = escapeHtml(record.startTime);
            const safeEndTime = escapeHtml(record.endTime);
            const safeId = escapeHtml(record.id);
            const titleHtml = safeTitle ? '<div class="record-title">' + safeTitle + '</div>' : '';

            const isDeficit = record.overtimeHours < 0;
            const chipClass = isDeficit ? 'chip-deficit' : 'chip-overtime';
            const chipText = isDeficit
                ? formatHours(record.overtimeHours) + ' bajo contrato'
                : formatHours(record.overtimeHours) + ' extra';

            return '<div class="record-swipe-container" data-id="' + safeId + '" style="animation-delay:' + (i * 40) + 'ms">' +
                '<div class="swipe-actions-bg">' +
                    '<button class="swipe-action-btn swipe-edit-btn" data-id="' + safeId + '" aria-label="Editar">' +
                        '<span class="material-symbols-rounded">edit</span>' +
                        '<span>Editar</span>' +
                    '</button>' +
                    '<button class="swipe-action-btn swipe-delete-btn" data-id="' + safeId + '" aria-label="Eliminar">' +
                        '<span class="material-symbols-rounded">delete</span>' +
                        '<span>Eliminar</span>' +
                    '</button>' +
                '</div>' +
                '<div class="record-item" data-id="' + safeId + '">' +
                    '<div class="record-date-badge">' +
                        '<span class="record-day-num">' + dateInfo.dayNum + '</span>' +
                        '<span class="record-day-name">' + escapeHtml(dateInfo.dayName) + '</span>' +
                    '</div>' +
                    '<div class="record-details">' +
                        titleHtml +
                        '<div class="record-time-range">' +
                            safeStartTime + ' <span class="arrow">→</span> ' + safeEndTime +
                        '</div>' +
                        '<div class="record-tags">' +
                            '<span class="m3-chip ' + chipClass + '">' + chipText + '</span>' +
                            (record.lunchBreak ? '<span class="m3-chip chip-lunch">Comida</span>' : '') +
                            '<span class="m3-chip chip-money">' + formatMoney(money) + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="record-chevron">' +
                        '<span class="material-symbols-rounded">chevron_right</span>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');

        initSwipeGestures();
    }

    // Also refresh calendar if visible
    renderCalendar();
}

// ===== RENDER: CALENDAR =====
function renderCalendar() {
    const calGrid = document.getElementById('calendar-grid');
    if (!calGrid) return;

    const records = getMonthRecords(currentYear, currentMonth);
    const recordsByDay = {};
    records.forEach(r => {
        const day = new Date(r.date + 'T00:00:00').getDate();
        if (!recordsByDay[day]) recordsByDay[day] = [];
        recordsByDay[day].push(r);
    });

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonth = currentYear === today.getFullYear() && currentMonth === today.getMonth();

    let html = '';
    // Day headers
    DAY_NAMES.forEach(d => {
        html += '<div class="cal-header-cell">' + escapeHtml(d) + '</div>';
    });

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="cal-cell cal-empty"></div>';
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const hasRecords = recordsByDay[day];
        const isToday = isCurrentMonth && day === today.getDate();
        let classes = 'cal-cell';
        if (isToday) classes += ' cal-today';
        if (hasRecords) classes += ' cal-has-record';

        let dotHtml = '';
        if (hasRecords) {
            const totalOT = hasRecords.reduce((sum, r) => sum + r.overtimeHours, 0);
            const dotClass = totalOT < 0 ? 'cal-dot-deficit' : 'cal-dot-overtime';
            dotHtml = '<span class="cal-dot ' + dotClass + '"></span>';
        }

        html += '<div class="' + classes + '" data-day="' + day + '">' +
            '<span class="cal-day-num">' + day + '</span>' +
            dotHtml +
        '</div>';
    }

    calGrid.innerHTML = html;

    // Click handlers for calendar days
    calGrid.querySelectorAll('.cal-cell[data-day]').forEach(cell => {
        cell.addEventListener('click', () => {
            const day = parseInt(cell.dataset.day);
            const dateStr = formatInputDate(new Date(currentYear, currentMonth, day));
            const dayRecords = recordsByDay[day];
            if (dayRecords && dayRecords.length > 0) {
                openRecordDetail(dayRecords[0].id);
            } else {
                openAddModalForDate(dateStr);
            }
        });
    });
}

// ===== RENDER: RECORD DETAIL =====
function openRecordDetail(id) {
    const record = _cachedRecords.find(r => r.id === id);
    if (!record) return;

    const settings = getSettings();
    const dateInfo = formatDate(record.date);
    const money = record.overtimeHours * settings.hourlyRate;
    const isDeficit = record.overtimeHours < 0;

    const detailEl = document.getElementById('detail-content');
    detailEl.innerHTML =
        '<div class="detail-date-hero">' +
            '<div class="detail-day-num">' + dateInfo.dayNum + '</div>' +
            '<div class="detail-day-info">' +
                '<span class="detail-weekday">' + escapeHtml(dateInfo.dayName) + '</span>' +
                '<span class="detail-full-date">' + escapeHtml(dateInfo.full) + ' ' + new Date(record.date + 'T00:00:00').getFullYear() + '</span>' +
            '</div>' +
        '</div>' +
        (record.title ? '<div class="detail-title">' + escapeHtml(record.title) + '</div>' : '') +
        '<div class="detail-info-grid">' +
            '<div class="detail-info-item">' +
                '<span class="material-symbols-rounded filled" style="color:var(--md-primary)">play_circle</span>' +
                '<div class="detail-info-data">' +
                    '<span class="detail-info-label">Inicio</span>' +
                    '<span class="detail-info-value">' + escapeHtml(record.startTime) + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="detail-info-item">' +
                '<span class="material-symbols-rounded filled" style="color:var(--md-error)">stop_circle</span>' +
                '<div class="detail-info-data">' +
                    '<span class="detail-info-label">Fin</span>' +
                    '<span class="detail-info-value">' + escapeHtml(record.endTime) + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="detail-info-item">' +
                '<span class="material-symbols-rounded filled" style="color:var(--md-primary)">schedule</span>' +
                '<div class="detail-info-data">' +
                    '<span class="detail-info-label">Horas trabajadas</span>' +
                    '<span class="detail-info-value">' + formatHours(record.totalHours) + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="detail-info-item">' +
                '<span class="material-symbols-rounded filled" style="color:' + (isDeficit ? 'var(--md-warning)' : 'var(--md-success)') + '">trending_up</span>' +
                '<div class="detail-info-data">' +
                    '<span class="detail-info-label">Horas extra</span>' +
                    '<span class="detail-info-value ' + (isDeficit ? 'text-deficit' : 'text-overtime') + '">' +
                        (isDeficit ? formatHours(record.overtimeHours) + ' bajo contrato' : formatHours(record.overtimeHours)) +
                    '</span>' +
                '</div>' +
            '</div>' +
            (record.lunchBreak ? '<div class="detail-info-item">' +
                '<span class="material-symbols-rounded filled" style="color:var(--md-tertiary)">restaurant</span>' +
                '<div class="detail-info-data">' +
                    '<span class="detail-info-label">Pausa comida</span>' +
                    '<span class="detail-info-value">' + formatHours(settings.lunchDuration) + '</span>' +
                '</div>' +
            '</div>' : '') +
            '<div class="detail-info-item detail-money">' +
                '<span class="material-symbols-rounded filled" style="color:var(--md-success)">payments</span>' +
                '<div class="detail-info-data">' +
                    '<span class="detail-info-label">Importe</span>' +
                    '<span class="detail-info-value text-success">' + formatMoney(money) + '</span>' +
                '</div>' +
            '</div>' +
        '</div>';

    // Set up action buttons
    document.getElementById('btn-detail-edit').onclick = () => {
        closeModal('modal-detail-overlay');
        openEditModal(id);
    };
    document.getElementById('btn-detail-delete').onclick = () => {
        closeModal('modal-detail-overlay');
        handleDelete(id);
    };

    openModal('modal-detail-overlay');
}

// ===== RENDER: ANNUAL SUMMARY =====
function renderAnnualSummary() {
    const annual = getAnnualSummary(currentYear);
    const container = document.getElementById('annual-content');
    if (!container) return;

    // Year label
    document.getElementById('annual-year-label').textContent = currentYear;

    // Summary cards
    let html = '<div class="annual-totals">' +
        '<div class="annual-total-item">' +
            '<span class="material-symbols-rounded filled" style="color:var(--md-primary)">schedule</span>' +
            '<div><span class="annual-total-value">' + formatHours(annual.totalHours) + '</span>' +
            '<span class="annual-total-label">Total horas</span></div>' +
        '</div>' +
        '<div class="annual-total-item">' +
            '<span class="material-symbols-rounded filled" style="color:var(--md-success)">payments</span>' +
            '<div><span class="annual-total-value">' + formatMoney(annual.totalMoney) + '</span>' +
            '<span class="annual-total-label">Total dinero</span></div>' +
        '</div>' +
        '<div class="annual-total-item">' +
            '<span class="material-symbols-rounded filled" style="color:var(--md-warning)">calendar_month</span>' +
            '<div><span class="annual-total-value">' + annual.totalDays + ' días</span>' +
            '<span class="annual-total-label">Total registrados</span></div>' +
        '</div>' +
    '</div>';

    // Bar chart
    html += '<div class="annual-chart">';
    annual.months.forEach((m, i) => {
        const pct = annual.maxHours > 0 ? (m.hours / annual.maxHours) * 100 : 0;
        const now = new Date();
        const isCurrent = currentYear === now.getFullYear() && i === now.getMonth();
        html += '<div class="chart-bar-col' + (isCurrent ? ' chart-current' : '') + '">' +
            '<div class="chart-bar-value">' + (m.hours > 0 ? formatHours(m.hours) : '') + '</div>' +
            '<div class="chart-bar-track">' +
                '<div class="chart-bar-fill" style="height:' + Math.max(pct, m.hours > 0 ? 4 : 0) + '%"></div>' +
            '</div>' +
            '<div class="chart-bar-label">' + escapeHtml(m.shortName) + '</div>' +
        '</div>';
    });
    html += '</div>';

    // Monthly table
    html += '<div class="annual-table">';
    annual.months.forEach(m => {
        if (m.days === 0) return;
        html += '<div class="annual-table-row">' +
            '<span class="annual-table-month">' + escapeHtml(m.name) + '</span>' +
            '<span class="annual-table-data">' + formatHours(m.hours) + '</span>' +
            '<span class="annual-table-data">' + formatMoney(m.money) + '</span>' +
            '<span class="annual-table-data">' + m.days + 'd</span>' +
        '</div>';
    });
    if (annual.totalDays === 0) {
        html += '<div class="annual-table-empty">No hay registros este año</div>';
    }
    html += '</div>';

    container.innerHTML = html;
}

// ===== RENDER: SETTINGS =====
function renderSettings() {
    document.getElementById('setting-rate').value = _cachedSettings.hourlyRate;
    document.getElementById('setting-start-time').value = _cachedSettings.defaultStartTime;
    document.getElementById('setting-contract-hours').value = _cachedSettings.contractHours;
    document.getElementById('setting-lunch-duration').value = _cachedSettings.lunchDuration;

    const segItems = document.querySelectorAll('#storage-selector .m3-seg-item');
    segItems.forEach(item => {
        item.classList.toggle('active', item.dataset.value === _cachedSettings.storageMode);
    });

    document.getElementById('file-config').style.display =
        _cachedSettings.storageMode === 'file' ? 'block' : 'none';
}

// ===== MODAL MANAGEMENT =====
function openModal(overlayId) {
    const overlay = document.getElementById(overlayId);
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Attach drag-to-dismiss on bottom sheets
    const sheet = overlay.querySelector('.m3-bottom-sheet');
    if (sheet && !sheet._dragInitialized) {
        initSheetDragDismiss(overlay, sheet);
        sheet._dragInitialized = true;
    }
}

function closeModal(overlayId) {
    const overlay = document.getElementById(overlayId);
    const sheet = overlay.querySelector('.m3-bottom-sheet');
    if (sheet) {
        sheet.style.transform = '';
        overlay.style.background = '';
    }
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// ===== BOTTOM SHEET DRAG-TO-DISMISS =====
function initSheetDragDismiss(overlay, sheet) {
    let startY = 0;
    let currentDragY = 0;
    let isDragging = false;
    let sheetHeight = 0;

    sheet.addEventListener('touchstart', (e) => {
        // Only drag from top area or if scrolled to top
        if (sheet.scrollTop > 0) return;
        startY = e.touches[0].clientY;
        isDragging = true;
        sheetHeight = sheet.offsetHeight;
        sheet.style.transition = 'none';
    }, { passive: true });

    sheet.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentDragY = e.touches[0].clientY - startY;

        // Only allow dragging down
        if (currentDragY < 0) currentDragY = 0;

        // Apply resistance curve for natural feel
        const resistance = 1 - (currentDragY / (sheetHeight * 2));
        const adjustedY = currentDragY * Math.max(resistance, 0.4);

        sheet.style.transform = 'translateY(' + adjustedY + 'px)';

        // Fade overlay background
        const progress = Math.min(currentDragY / (sheetHeight * 0.4), 1);
        overlay.style.background = 'rgba(0,0,0,' + (0.4 * (1 - progress * 0.6)) + ')';
    }, { passive: true });

    sheet.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        sheet.style.transition = '';
        overlay.style.transition = '';

        // Dismiss if dragged past 30% of sheet height
        if (currentDragY > sheetHeight * 0.3) {
            sheet.style.transition = 'transform 300ms cubic-bezier(0.2, 0, 0, 1)';
            sheet.style.transform = 'translateY(100%)';
            overlay.style.transition = 'opacity 300ms ease';
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
                sheet.style.transform = '';
                sheet.style.transition = '';
                overlay.style.opacity = '';
                overlay.style.transition = '';
                overlay.style.background = '';
            }, 300);
        } else {
            // Snap back with spring
            sheet.style.transition = 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)';
            sheet.style.transform = 'translateY(0)';
            overlay.style.background = '';
            setTimeout(() => {
                sheet.style.transition = '';
            }, 400);
        }
        currentDragY = 0;
    });
}

function openAddModal() {
    editTargetId = null;
    const now = new Date();
    const settings = getSettings();

    document.getElementById('modal-title').textContent = 'Nuevo registro';
    document.getElementById('btn-submit-text').textContent = 'Guardar registro';
    document.getElementById('input-title').value = '';
    document.getElementById('input-date').value = formatInputDate(now);
    document.getElementById('input-start-time').value = settings.defaultStartTime;
    document.getElementById('input-end-time').value = '';
    document.getElementById('input-lunch').checked = false;
    document.getElementById('preview-lunch-row').style.display = 'none';

    document.getElementById('preview-contract').textContent = '− ' + settings.contractHours + 'h';
    document.getElementById('preview-lunch').textContent = '− ' + settings.lunchDuration + 'h';

    updateCalcPreview();
    openModal('modal-overlay');
}

function openAddModalForDate(dateStr) {
    editTargetId = null;
    const settings = getSettings();

    document.getElementById('modal-title').textContent = 'Nuevo registro';
    document.getElementById('btn-submit-text').textContent = 'Guardar registro';
    document.getElementById('input-title').value = '';
    document.getElementById('input-date').value = dateStr;
    document.getElementById('input-start-time').value = settings.defaultStartTime;
    document.getElementById('input-end-time').value = '';
    document.getElementById('input-lunch').checked = false;
    document.getElementById('preview-lunch-row').style.display = 'none';

    document.getElementById('preview-contract').textContent = '− ' + settings.contractHours + 'h';
    document.getElementById('preview-lunch').textContent = '− ' + settings.lunchDuration + 'h';

    updateCalcPreview();
    openModal('modal-overlay');
}

function openEditModal(id) {
    editTargetId = id;
    const record = _cachedRecords.find(r => r.id === id);
    if (!record) return;

    const settings = getSettings();
    document.getElementById('modal-title').textContent = 'Editar registro';
    document.getElementById('btn-submit-text').textContent = 'Actualizar registro';
    document.getElementById('input-title').value = record.title || '';
    document.getElementById('input-date').value = record.date;
    document.getElementById('input-start-time').value = record.startTime;
    document.getElementById('input-end-time').value = record.endTime;
    document.getElementById('input-lunch').checked = record.lunchBreak;
    document.getElementById('preview-lunch-row').style.display = record.lunchBreak ? 'flex' : 'none';

    document.getElementById('preview-contract').textContent = '− ' + settings.contractHours + 'h';
    document.getElementById('preview-lunch').textContent = '− ' + settings.lunchDuration + 'h';

    updateCalcPreview();
    openModal('modal-overlay');
}

// ===== CALC PREVIEW =====
function updateCalcPreview() {
    const startTime = document.getElementById('input-start-time').value;
    const endTime = document.getElementById('input-end-time').value;
    const lunch = document.getElementById('input-lunch').checked;
    const settings = getSettings();

    document.getElementById('preview-lunch-row').style.display = lunch ? 'flex' : 'none';

    if (!startTime || !endTime) {
        document.getElementById('preview-worked').textContent = '--';
        document.getElementById('preview-overtime').textContent = '--';
        document.getElementById('preview-money').textContent = '--';
        return;
    }

    const result = calculateOvertime(startTime, endTime, settings.contractHours, lunch, settings.lunchDuration);

    document.getElementById('preview-worked').textContent = formatHours(result.totalHours);

    const previewOT = document.getElementById('preview-overtime');
    if (result.overtimeHours < 0) {
        previewOT.textContent = formatHours(result.overtimeHours) + ' bajo contrato';
        previewOT.className = 'preview-value text-deficit';
    } else {
        previewOT.textContent = formatHours(result.overtimeHours);
        previewOT.className = 'preview-value';
    }

    const money = Math.max(0, result.overtimeHours) * settings.hourlyRate;
    document.getElementById('preview-money').textContent = formatMoney(money);
}

// ===== TOAST / SNACKBAR WITH UNDO =====
let toastTimeout;
let _undoCallback = null;

function showToast(icon, message, type, undoCallback) {
    type = type || 'info';
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toast-icon');
    const toastMsg = document.getElementById('toast-message');
    const toastUndo = document.getElementById('toast-undo');

    toastIcon.textContent = icon;
    toastMsg.textContent = message;

    toast.className = 'm3-snackbar';
    toast.classList.add('snackbar-' + type);

    // Handle undo
    _undoCallback = undoCallback || null;
    if (toastUndo) {
        toastUndo.style.display = undoCallback ? 'inline-flex' : 'none';
    }

    clearTimeout(toastTimeout);
    requestAnimationFrame(() => toast.classList.add('show'));

    const duration = undoCallback ? 5000 : 3000;
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        _undoCallback = null;
    }, duration);
}

function handleUndoClick() {
    if (_undoCallback) {
        const cb = _undoCallback;
        _undoCallback = null;
        // Let the callback's showToast handle the new toast + timeout
        cb();
    }
}

// ===== SWIPE GESTURES =====
function initSwipeGestures() {
    const containers = document.querySelectorAll('.record-swipe-container');
    containers.forEach(container => {
        const recordItem = container.querySelector('.record-item');
        const actionBtns = container.querySelectorAll('.swipe-action-btn');
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let isDragging = false;
        let isOpen = false;
        let isHorizontal = null;
        const threshold = 70;
        const maxSwipe = 160;

        // Set initial state of action buttons
        actionBtns.forEach(btn => {
            btn.style.transform = 'scale(0.5)';
            btn.style.opacity = '0';
        });

        function updateActionButtons(progress) {
            // progress: 0 (closed) to 1 (fully open)
            const clampedProgress = Math.max(0, Math.min(1, progress));
            actionBtns.forEach((btn, i) => {
                const delay = i * 0.15;
                const btnProgress = Math.max(0, Math.min(1, (clampedProgress - delay) / (1 - delay)));
                // Spring-like scale: overshoot slightly
                const scale = btnProgress < 1 ? btnProgress * 0.5 + 0.5 : 1;
                btn.style.transform = 'scale(' + scale + ')';
                btn.style.opacity = '' + btnProgress;
            });
        }

        recordItem.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isDragging = true;
            isHorizontal = null;
            recordItem.style.transition = 'none';
            actionBtns.forEach(btn => btn.style.transition = 'none');
        }, { passive: true });

        recordItem.addEventListener('touchmove', (e) => {
            if (!isDragging) return;

            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;

            // Determine direction on first significant move
            if (isHorizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
                isHorizontal = Math.abs(dx) > Math.abs(dy);
            }
            if (!isHorizontal) return;

            currentX = dx;
            if (isOpen) currentX = currentX - maxSwipe;

            if (currentX > 0) currentX = 0;
            if (currentX < -maxSwipe) currentX = -maxSwipe;

            recordItem.style.transform = 'translateX(' + currentX + 'px)';
            updateActionButtons(Math.abs(currentX) / maxSwipe);
        }, { passive: true });

        recordItem.addEventListener('touchend', () => {
            isDragging = false;
            recordItem.style.transition = 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)';
            actionBtns.forEach(btn => btn.style.transition = 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease');

            if (currentX < -threshold) {
                recordItem.style.transform = 'translateX(-' + maxSwipe + 'px)';
                isOpen = true;
                updateActionButtons(1);
            } else {
                recordItem.style.transform = 'translateX(0)';
                isOpen = false;
                updateActionButtons(0);
            }
            currentX = 0;
        });

        // Click on record-item to open detail
        recordItem.addEventListener('click', (e) => {
            if (isOpen) {
                recordItem.style.transition = 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)';
                recordItem.style.transform = 'translateX(0)';
                isOpen = false;
                actionBtns.forEach(btn => btn.style.transition = 'transform 300ms ease, opacity 200ms ease');
                updateActionButtons(0);
                return;
            }
            const id = recordItem.dataset.id;
            openRecordDetail(id);
        });

        // Swipe action buttons
        const editBtn = container.querySelector('.swipe-edit-btn');
        const deleteBtn = container.querySelector('.swipe-delete-btn');

        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = editBtn.dataset.id;
                recordItem.style.transition = 'transform 300ms ease';
                recordItem.style.transform = 'translateX(0)';
                isOpen = false;
                updateActionButtons(0);
                openEditModal(id);
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = deleteBtn.dataset.id;
                recordItem.style.transition = 'transform 300ms ease';
                recordItem.style.transform = 'translateX(0)';
                isOpen = false;
                updateActionButtons(0);
                handleDelete(id);
            });
        }
    });
}

// ===== NAVIGATION =====
function navigateMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    else if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderDashboard();
}
