/* ============================================
   RENDER MODULE
   All DOM rendering, modals, toasts, and UI
   v2: Home + Overtime + Trips views
   ============================================ */

// ===== VIEW TRANSITIONS =====
let _currentView = 'view-home';
let _activeNavView = 'view-home'; // Tracks which nav tab is active

function showView(viewId, direction) {
    direction = direction || 'forward';
    if (viewId === _currentView) return;

    const oldView = document.getElementById(_currentView);
    const newView = document.getElementById(viewId);

    oldView.classList.remove('active', 'view-enter-forward', 'view-enter-back');

    const enterClass = direction === 'forward' ? 'view-enter-forward' : 'view-enter-back';
    newView.classList.remove('view-enter-forward', 'view-enter-back');
    void newView.offsetWidth;
    newView.classList.add('active', enterClass);
    newView.addEventListener('animationend', function handler() {
        newView.classList.remove(enterClass);
        newView.removeEventListener('animationend', handler);
    }, { once: true });

    _currentView = viewId;
    updateFabForView(viewId);
}

function switchNavView(viewId) {
    if (viewId === _currentView && ['view-home', 'view-overtime', 'view-trips'].includes(viewId)) return;

    // Update nav items
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewId);
    });

    _activeNavView = viewId;
    showView(viewId, 'forward');

    // Render the target view
    if (viewId === 'view-home') renderHome();
    else if (viewId === 'view-overtime') renderDashboard();
    else if (viewId === 'view-trips') renderTrips();
}

function updateFabForView(viewId) {
    const fab = document.getElementById('fab-add');
    if (['view-home', 'view-overtime', 'view-trips'].includes(viewId)) {
        fab.classList.remove('hidden');
    } else {
        fab.classList.add('hidden');
    }
}

// ===== RENDER: HOME =====
function renderHome() {
    const now = new Date();
    const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();

    document.getElementById('home-month-name').textContent =
        MONTH_NAMES[currentMonth] + ' ' + currentYear;

    const badge = document.getElementById('home-month-badge');
    badge.style.display = isCurrentMonth ? 'inline-block' : 'none';

    // Summary
    const summary = getMonthSummary(currentYear, currentMonth);
    document.getElementById('home-total-hours').textContent = formatHours(summary.totalHours);
    document.getElementById('home-total-money').textContent = formatMoney(summary.totalMoney);

    // Calendar
    renderHomeCalendar();

    // Upcoming trips
    const upcoming = getUpcomingTrips(3);
    const tripsListEl = document.getElementById('home-upcoming-trips');
    const noTripsEl = document.getElementById('home-no-trips');

    if (upcoming.length === 0) {
        tripsListEl.innerHTML = '';
        tripsListEl.style.display = 'none';
        noTripsEl.style.display = 'flex';
    } else {
        noTripsEl.style.display = 'none';
        tripsListEl.style.display = 'flex';
        tripsListEl.innerHTML = upcoming.map((trip, i) => {
            const status = getTripStatus(trip);
            const dateRange = formatDateRange(trip.dateStart, trip.dateEnd);
            const statusLabel = status === 'active' ? 'En curso' :
                                status === 'upcoming' ? formatRelativeDate(trip.dateStart) : 'Pasada';
            const badgeClass = status === 'active' ? 'badge-active' :
                               status === 'upcoming' ? 'badge-upcoming' : 'badge-past';

            return '<div class="home-trip-card" data-trip-id="' + escapeHtml(trip.id) + '" style="animation-delay:' + (i * 50) + 'ms">' +
                '<div class="trip-icon-badge">' +
                    '<span class="material-symbols-rounded filled">luggage</span>' +
                '</div>' +
                '<div class="trip-card-info">' +
                    '<div class="trip-card-name">' + escapeHtml(trip.hotelName) + '</div>' +
                    '<div class="trip-card-dates">' + escapeHtml(dateRange) + '</div>' +
                '</div>' +
                '<span class="trip-card-badge ' + badgeClass + '">' + escapeHtml(statusLabel) + '</span>' +
            '</div>';
        }).join('');

        tripsListEl.querySelectorAll('.home-trip-card').forEach(card => {
            card.addEventListener('click', () => openTripDetail(card.dataset.tripId));
        });
    }

    // Recent records
    const records = getMonthRecords(currentYear, currentMonth);
    const recentEl = document.getElementById('home-recent-records');
    const noRecordsEl = document.getElementById('home-no-records');

    if (records.length === 0) {
        recentEl.innerHTML = '';
        recentEl.style.display = 'none';
        noRecordsEl.style.display = 'flex';
    } else {
        noRecordsEl.style.display = 'none';
        recentEl.style.display = 'flex';
        const sorted = [...records].sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00')).slice(0, 5);
        const settings = getSettings();

        recentEl.innerHTML = sorted.map((r, i) => {
            const dateInfo = formatDate(r.date);
            const money = r.overtimeHours * settings.hourlyRate;
            const isDeficit = r.overtimeHours < 0;
            return '<div class="home-trip-card" data-record-id="' + escapeHtml(r.id) + '" style="animation-delay:' + (i * 50) + 'ms">' +
                '<div class="trip-icon-badge" style="background:' + (isDeficit ? 'var(--md-warning-container)' : 'var(--md-primary-container)') + ';color:' + (isDeficit ? 'var(--md-on-warning-container)' : 'var(--md-on-primary-container)') + '">' +
                    '<span class="material-symbols-rounded filled">' + (isDeficit ? 'trending_down' : 'schedule') + '</span>' +
                '</div>' +
                '<div class="trip-card-info">' +
                    '<div class="trip-card-name">' + (r.title ? escapeHtml(r.title) : escapeHtml(r.startTime) + ' → ' + escapeHtml(r.endTime)) + '</div>' +
                    '<div class="trip-card-dates">' + escapeHtml(dateInfo.dayName) + ' ' + dateInfo.dayNum + ' · ' + escapeHtml(r.startTime) + ' → ' + escapeHtml(r.endTime) + '</div>' +
                '</div>' +
                '<span class="trip-card-badge ' + (isDeficit ? 'badge-past' : 'badge-upcoming') + '">' + formatHours(r.overtimeHours) + '</span>' +
            '</div>';
        }).join('');

        recentEl.querySelectorAll('.home-trip-card[data-record-id]').forEach(el => {
            el.addEventListener('click', () => openRecordDetail(el.dataset.recordId));
        });
    }
}

// ===== RENDER: HOME CALENDAR =====
function renderHomeCalendar() {
    const calGrid = document.getElementById('home-calendar-grid');
    if (!calGrid) return;

    const records = getMonthRecords(currentYear, currentMonth);
    const trips = getMonthTrips(currentYear, currentMonth);

    const recordsByDay = {};
    records.forEach(r => {
        const day = new Date(r.date + 'T00:00:00').getDate();
        if (!recordsByDay[day]) recordsByDay[day] = [];
        recordsByDay[day].push(r);
    });

    const tripsByDay = {};
    trips.forEach(t => {
        const start = new Date(t.dateStart + 'T00:00:00');
        const end = new Date(t.dateEnd + 'T00:00:00');
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);

        const fromDay = start < monthStart ? 1 : start.getDate();
        const toDay = end > monthEnd ? monthEnd.getDate() : end.getDate();

        for (let d = fromDay; d <= toDay; d++) {
            if (!tripsByDay[d]) tripsByDay[d] = [];
            tripsByDay[d].push(t);
        }
    });

    const jsFirstDay = new Date(currentYear, currentMonth, 1).getDay();
    const firstDay = getMondayIndex(jsFirstDay);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonth = currentYear === today.getFullYear() && currentMonth === today.getMonth();

    // Build trip range info for connected highlighting
    const tripRangeInfo = {};
    trips.forEach(t => {
        const start = new Date(t.dateStart + 'T00:00:00');
        const end = new Date(t.dateEnd + 'T00:00:00');
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        const fromDay = start < monthStart ? 1 : start.getDate();
        const toDay = end > monthEnd ? monthEnd.getDate() : end.getDate();
        const duration = toDay - fromDay + 1;
        if (duration > 1) {
            for (let d = fromDay; d <= toDay; d++) {
                tripRangeInfo[d] = tripRangeInfo[d] || {};
                if (d === fromDay) tripRangeInfo[d].pos = 'start';
                else if (d === toDay) tripRangeInfo[d].pos = 'end';
                else tripRangeInfo[d].pos = 'mid';
            }
        }
    });

    let html = '';
    DAY_NAMES.forEach(d => {
        html += '<div class="cal-header-cell">' + escapeHtml(d) + '</div>';
    });

    for (let i = 0; i < firstDay; i++) {
        html += '<div class="cal-cell cal-empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const hasRecords = recordsByDay[day];
        const hasTrips = tripsByDay[day];
        const isToday = isCurrentMonth && day === today.getDate();
        const rangePos = tripRangeInfo[day];
        let classes = 'cal-cell';
        if (isToday) classes += ' cal-today';

        // Unified background indicators
        if (hasRecords && hasTrips) {
            classes += ' cal-both';
        } else if (hasRecords) {
            classes += ' cal-record';
        }

        if (hasTrips && !rangePos) classes += ' cal-has-trip';
        if (rangePos) classes += ' cal-trip-range cal-trip-' + rangePos.pos;
        if (hasRecords && rangePos) classes += ' cal-both-range';

        html += '<div class="' + classes + '" data-day="' + day + '">' +
            '<span class="cal-day-num">' + day + '</span>' +
        '</div>';
    }

    calGrid.innerHTML = html;

    calGrid.querySelectorAll('.cal-cell[data-day]').forEach(cell => {
        cell.addEventListener('click', () => {
            const day = parseInt(cell.dataset.day);
            const dayRecords = recordsByDay[day];
            const dayTrips = tripsByDay[day];
            if (dayRecords && dayRecords.length > 0) {
                openRecordDetail(dayRecords[0].id);
            } else if (dayTrips && dayTrips.length > 0) {
                openTripDetail(dayTrips[0].id);
            }
        });
    });
}

// ===== RENDER: DASHBOARD (OVERTIME) =====
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

        const sorted = [...records].sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00'));
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
}

// ===== RENDER: TRIPS LIST =====
let _tripsFilter = 'upcoming';

function renderTrips() {
    const listEl = document.getElementById('trips-list');
    const emptyEl = document.getElementById('trips-empty');
    let trips;

    if (_tripsFilter === 'upcoming') {
        trips = getUpcomingTrips();
    } else if (_tripsFilter === 'past') {
        trips = getPastTrips();
    } else {
        trips = [..._cachedTrips].sort((a, b) => new Date(b.dateStart + 'T00:00:00') - new Date(a.dateStart + 'T00:00:00'));
    }

    if (trips.length === 0) {
        listEl.innerHTML = '';
        listEl.style.display = 'none';
        emptyEl.style.display = 'block';
    } else {
        emptyEl.style.display = 'none';
        listEl.style.display = 'flex';

        listEl.innerHTML = trips.map((trip, i) => {
            const duration = getTripDuration(trip);
            const status = getTripStatus(trip);
            const dateRange = formatDateRange(trip.dateStart, trip.dateEnd);
            const companionCount = trip.companions ? trip.companions.length : 0;

            const statusBadge = status === 'active' ? '<span class="trip-meta-chip badge-active">En curso</span>' :
                                status === 'upcoming' ? '<span class="trip-meta-chip badge-upcoming">' + escapeHtml(formatRelativeDate(trip.dateStart)) + '</span>' :
                                '<span class="trip-meta-chip badge-past">Finalizada</span>';

            return '<div class="trip-list-card" data-trip-id="' + escapeHtml(trip.id) + '" style="animation-delay:' + (i * 50) + 'ms">' +
                '<div class="trip-list-top">' +
                    '<div class="trip-list-icon"><span class="material-symbols-rounded filled">' +
                        (status === 'active' ? 'flight_takeoff' : status === 'upcoming' ? 'event_upcoming' : 'check_circle') +
                    '</span></div>' +
                    '<div class="trip-list-info">' +
                        '<div class="trip-list-name">' + escapeHtml(trip.hotelName) + '</div>' +
                        '<div class="trip-list-dates">' +
                            '<span class="material-symbols-rounded" style="font-size:16px">calendar_today</span> ' +
                            escapeHtml(dateRange) +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="trip-list-meta">' +
                    statusBadge +
                    '<span class="trip-meta-chip chip-duration">' + duration + (duration === 1 ? ' día' : ' días') + '</span>' +
                    (companionCount > 0
                        ? '<span class="trip-meta-chip chip-companions"><span class="material-symbols-rounded" style="font-size:14px">group</span> ' + companionCount + '</span>'
                        : '<span class="trip-meta-chip chip-solo">Solo</span>') +
                '</div>' +
                (trip.description ? '<div class="trip-list-desc">' + escapeHtml(trip.description) + '</div>' : '') +
            '</div>';
        }).join('');

        listEl.querySelectorAll('.trip-list-card').forEach(card => {
            card.addEventListener('click', () => openTripDetail(card.dataset.tripId));
        });
    }
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
                '<span class="detail-weekday">' + escapeHtml(dateInfo.dayNameFull) + '</span>' +
                '<span class="detail-full-date">' + escapeHtml(dateInfo.full) + ' ' + dateInfo.year + '</span>' +
            '</div>' +
        '</div>' +
        (record.title ? '<div class="detail-title">' + escapeHtml(record.title) + '</div>' : '') +
        '<div class="detail-info-grid">' +
            '<div class="detail-info-item">' +
                '<span class="material-symbols-rounded filled" style="color:var(--md-primary)">play_circle</span>' +
                '<div class="detail-info-data"><span class="detail-info-label">Inicio</span><span class="detail-info-value">' + escapeHtml(record.startTime) + '</span></div>' +
            '</div>' +
            '<div class="detail-info-item">' +
                '<span class="material-symbols-rounded filled" style="color:var(--md-error)">stop_circle</span>' +
                '<div class="detail-info-data"><span class="detail-info-label">Fin</span><span class="detail-info-value">' + escapeHtml(record.endTime) + '</span></div>' +
            '</div>' +
            '<div class="detail-info-item">' +
                '<span class="material-symbols-rounded filled" style="color:var(--md-primary)">schedule</span>' +
                '<div class="detail-info-data"><span class="detail-info-label">Horas trabajadas</span><span class="detail-info-value">' + formatHours(record.totalHours) + '</span></div>' +
            '</div>' +
            '<div class="detail-info-item">' +
                '<span class="material-symbols-rounded filled" style="color:' + (isDeficit ? 'var(--md-warning)' : 'var(--md-success)') + '">trending_up</span>' +
                '<div class="detail-info-data"><span class="detail-info-label">Horas extra</span><span class="detail-info-value ' + (isDeficit ? 'text-deficit' : 'text-overtime') + '">' +
                    (isDeficit ? formatHours(record.overtimeHours) + ' bajo contrato' : formatHours(record.overtimeHours)) +
                '</span></div>' +
            '</div>' +
            (record.lunchBreak ? '<div class="detail-info-item">' +
                '<span class="material-symbols-rounded filled" style="color:var(--md-tertiary)">restaurant</span>' +
                '<div class="detail-info-data"><span class="detail-info-label">Pausa comida</span><span class="detail-info-value">' + formatHours(settings.lunchDuration) + '</span></div>' +
            '</div>' : '') +
            '<div class="detail-info-item">' +
                '<span class="material-symbols-rounded filled" style="color:var(--md-success)">payments</span>' +
                '<div class="detail-info-data"><span class="detail-info-label">Importe</span><span class="detail-info-value text-success">' + formatMoney(money) + '</span></div>' +
            '</div>' +
        '</div>';

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

// ===== RENDER: TRIP DETAIL =====
function openTripDetail(id) {
    const trip = _cachedTrips.find(t => t.id === id);
    if (!trip) return;

    const dateInfo = formatDate(trip.dateStart);
    const duration = getTripDuration(trip);
    const status = getTripStatus(trip);
    const dateRange = formatDateRange(trip.dateStart, trip.dateEnd);

    const detailEl = document.getElementById('trip-detail-content');
    const dateInfoEnd = formatDate(trip.dateEnd);
    const heroNum = (trip.dateStart === trip.dateEnd)
        ? '' + dateInfo.dayNum
        : dateInfo.dayNum + '–' + dateInfoEnd.dayNum;

    detailEl.innerHTML =
        '<div class="detail-date-hero">' +
            '<div class="detail-day-num" style="color:var(--md-trip)">' + heroNum + '</div>' +
            '<div class="detail-day-info">' +
                '<span class="detail-weekday">' + escapeHtml(dateInfo.dayNameFull) + '</span>' +
                '<span class="detail-full-date">' + escapeHtml(dateRange) + ' ' + dateInfo.year + '</span>' +
            '</div>' +
        '</div>' +
        '<div class="detail-title">' + escapeHtml(trip.hotelName) + '</div>' +
        '<div class="detail-info-grid">' +
            '<div class="detail-info-item">' +
                '<span class="material-symbols-rounded filled" style="color:var(--md-trip)">hotel</span>' +
                '<div class="detail-info-data"><span class="detail-info-label">Alojamiento</span><span class="detail-info-value">' + escapeHtml(trip.hotelName) + '</span></div>' +
            '</div>' +
            '<div class="detail-info-item">' +
                '<span class="material-symbols-rounded filled" style="color:var(--md-primary)">date_range</span>' +
                '<div class="detail-info-data"><span class="detail-info-label">Duración</span><span class="detail-info-value">' + duration + (duration === 1 ? ' día' : ' días') + '</span></div>' +
            '</div>' +
            '<div class="detail-info-item">' +
                '<span class="material-symbols-rounded filled" style="color:var(--md-success)">group</span>' +
                '<div class="detail-info-data"><span class="detail-info-label">Compañía</span><span class="detail-info-value">' +
                    (trip.companions && trip.companions.length > 0 ? trip.companions.join(', ') : 'Solo') +
                '</span></div>' +
            '</div>' +
        '</div>' +
        (trip.description ? '<div class="detail-description">' + escapeHtml(trip.description) + '</div>' : '');

    document.getElementById('btn-trip-detail-edit').onclick = () => {
        closeModal('modal-trip-detail-overlay');
        openEditTripModal(id);
    };
    document.getElementById('btn-trip-detail-delete').onclick = () => {
        closeModal('modal-trip-detail-overlay');
        handleDeleteTrip(id);
    };

    openModal('modal-trip-detail-overlay');
}

// ===== RENDER: ANNUAL SUMMARY =====
function renderAnnualSummary() {
    const annual = getAnnualSummary(currentYear);
    const container = document.getElementById('annual-content');
    if (!container) return;

    document.getElementById('annual-year-label').textContent = currentYear;

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

    renderCompanionsSettings();
}

function renderCompanionsSettings() {
    const container = document.getElementById('companions-chips');
    const companions = _cachedSettings.companions || [];

    if (companions.length === 0) {
        container.innerHTML = '<span style="font-size:13px;color:var(--md-on-surface-variant);opacity:.6">Sin compañeros añadidos</span>';
    } else {
        container.innerHTML = companions.map(name =>
            '<div class="companion-chip-setting">' +
                '<span>' + escapeHtml(name) + '</span>' +
                '<button class="companion-remove-btn" data-name="' + escapeHtml(name) + '" aria-label="Eliminar">' +
                    '<span class="material-symbols-rounded">close</span>' +
                '</button>' +
            '</div>'
        ).join('');

        container.querySelectorAll('.companion-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.dataset.name;
                _cachedSettings.companions = _cachedSettings.companions.filter(c => c !== name);
                idbSaveSettings();
                renderCompanionsSettings();
                showToast('person_remove', 'Compañero eliminado', 'info');
            });
        });
    }
}

function renderTripCompanionChips(selectedCompanions) {
    const container = document.getElementById('trip-companion-chips');
    const companions = _cachedSettings.companions || [];
    const hint = document.getElementById('trip-solo-hint');

    if (companions.length === 0) {
        container.innerHTML = '<span style="font-size:13px;color:var(--md-on-surface-variant);opacity:.6">Añade compañeros en Ajustes</span>';
        hint.style.display = 'flex';
        return;
    }

    container.innerHTML = companions.map(name => {
        const isSelected = selectedCompanions.includes(name);
        return '<div class="trip-comp-chip' + (isSelected ? ' selected' : '') + '" data-name="' + escapeHtml(name) + '">' +
            '<span class="material-symbols-rounded">' + (isSelected ? 'check' : 'person') + '</span>' +
            '<span>' + escapeHtml(name) + '</span>' +
        '</div>';
    }).join('');

    hint.style.display = selectedCompanions.length === 0 ? 'flex' : 'none';

    container.querySelectorAll('.trip-comp-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
            const icon = chip.querySelector('.material-symbols-rounded');
            icon.textContent = chip.classList.contains('selected') ? 'check' : 'person';
            const anySelected = container.querySelectorAll('.trip-comp-chip.selected').length > 0;
            hint.style.display = anySelected ? 'none' : 'flex';
        });
    });
}

// ===== MODAL MANAGEMENT =====
function openModal(overlayId) {
    const overlay = document.getElementById(overlayId);
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

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

function initSheetDragDismiss(overlay, sheet) {
    let startY = 0, currentDragY = 0, isDragging = false, sheetHeight = 0;

    sheet.addEventListener('touchstart', (e) => {
        if (sheet.scrollTop > 0) return;
        startY = e.touches[0].clientY;
        isDragging = true;
        sheetHeight = sheet.offsetHeight;
        sheet.style.transition = 'none';
    }, { passive: true });

    sheet.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentDragY = e.touches[0].clientY - startY;
        if (currentDragY < 0) currentDragY = 0;
        const resistance = 1 - (currentDragY / (sheetHeight * 2));
        const adjustedY = currentDragY * Math.max(resistance, 0.4);
        sheet.style.transform = 'translateY(' + adjustedY + 'px)';
        const progress = Math.min(currentDragY / (sheetHeight * 0.4), 1);
        overlay.style.background = 'rgba(0,0,0,' + (0.4 * (1 - progress * 0.6)) + ')';
    }, { passive: true });

    sheet.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        sheet.style.transition = '';
        if (currentDragY > sheetHeight * 0.3) {
            sheet.style.transition = 'transform 300ms cubic-bezier(0.2,0,0,1)';
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
            sheet.style.transition = 'transform 400ms cubic-bezier(0.34,1.56,0.64,1)';
            sheet.style.transform = 'translateY(0)';
            overlay.style.background = '';
            setTimeout(() => { sheet.style.transition = ''; }, 400);
        }
        currentDragY = 0;
    });
}

// ===== ADD/EDIT MODALS =====
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

// Trip modals
function openAddTripModal() {
    editTripTargetId = null;
    const now = new Date();

    document.getElementById('modal-trip-title').textContent = 'Nueva salida';
    document.getElementById('btn-submit-trip-text').textContent = 'Programar salida';
    document.getElementById('input-trip-hotel').value = '';
    document.getElementById('input-trip-start').value = formatInputDate(now);
    document.getElementById('input-trip-end').value = formatInputDate(now);
    document.getElementById('input-trip-description').value = '';

    renderTripCompanionChips([]);
    openModal('modal-trip-overlay');
}

function openEditTripModal(id) {
    editTripTargetId = id;
    const trip = _cachedTrips.find(t => t.id === id);
    if (!trip) return;

    document.getElementById('modal-trip-title').textContent = 'Editar salida';
    document.getElementById('btn-submit-trip-text').textContent = 'Actualizar salida';
    document.getElementById('input-trip-hotel').value = trip.hotelName;
    document.getElementById('input-trip-start').value = trip.dateStart;
    document.getElementById('input-trip-end').value = trip.dateEnd;
    document.getElementById('input-trip-description').value = trip.description || '';

    renderTripCompanionChips(trip.companions || []);
    openModal('modal-trip-overlay');
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

// ===== TOAST / SNACKBAR =====
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
        cb();
    }
}

// ===== SWIPE GESTURES =====
function initSwipeGestures() {
    const containers = document.querySelectorAll('.record-swipe-container');
    containers.forEach(container => {
        const recordItem = container.querySelector('.record-item');
        const actionBtns = container.querySelectorAll('.swipe-action-btn');
        let startX = 0, startY = 0, currentX = 0, isDragging = false, isOpen = false, isHorizontal = null;
        const threshold = 70, maxSwipe = 160;

        actionBtns.forEach(btn => { btn.style.transform = 'scale(0.5)'; btn.style.opacity = '0'; });

        function updateActionButtons(progress) {
            const clamped = Math.max(0, Math.min(1, progress));
            actionBtns.forEach((btn, i) => {
                const delay = i * 0.15;
                const btnP = Math.max(0, Math.min(1, (clamped - delay) / (1 - delay)));
                btn.style.transform = 'scale(' + (btnP < 1 ? btnP * 0.5 + 0.5 : 1) + ')';
                btn.style.opacity = '' + btnP;
            });
        }

        recordItem.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX; startY = e.touches[0].clientY;
            isDragging = true; isHorizontal = null;
            recordItem.style.transition = 'none';
            actionBtns.forEach(btn => btn.style.transition = 'none');
        }, { passive: true });

        recordItem.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
            if (isHorizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) isHorizontal = Math.abs(dx) > Math.abs(dy);
            if (!isHorizontal) return;
            currentX = dx;
            if (isOpen) currentX -= maxSwipe;
            if (currentX > 0) currentX = 0;
            if (currentX < -maxSwipe) currentX = -maxSwipe;
            recordItem.style.transform = 'translateX(' + currentX + 'px)';
            updateActionButtons(Math.abs(currentX) / maxSwipe);
        }, { passive: true });

        recordItem.addEventListener('touchend', () => {
            isDragging = false;
            recordItem.style.transition = 'transform 400ms cubic-bezier(0.34,1.56,0.64,1)';
            actionBtns.forEach(btn => btn.style.transition = 'transform 400ms cubic-bezier(0.34,1.56,0.64,1), opacity 300ms ease');
            if (currentX < -threshold) {
                recordItem.style.transform = 'translateX(-' + maxSwipe + 'px)';
                isOpen = true; updateActionButtons(1);
            } else {
                recordItem.style.transform = 'translateX(0)';
                isOpen = false; updateActionButtons(0);
            }
            currentX = 0;
        });

        recordItem.addEventListener('click', () => {
            if (isOpen) {
                recordItem.style.transition = 'transform 400ms cubic-bezier(0.34,1.56,0.64,1)';
                recordItem.style.transform = 'translateX(0)';
                isOpen = false;
                actionBtns.forEach(btn => btn.style.transition = 'transform 300ms ease, opacity 200ms ease');
                updateActionButtons(0);
                return;
            }
            openRecordDetail(recordItem.dataset.id);
        });

        const editBtn = container.querySelector('.swipe-edit-btn');
        const deleteBtn = container.querySelector('.swipe-delete-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                recordItem.style.transition = 'transform 300ms ease';
                recordItem.style.transform = 'translateX(0)';
                isOpen = false; updateActionButtons(0);
                openEditModal(editBtn.dataset.id);
            });
        }
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                recordItem.style.transition = 'transform 300ms ease';
                recordItem.style.transform = 'translateX(0)';
                isOpen = false; updateActionButtons(0);
                handleDelete(deleteBtn.dataset.id);
            });
        }
    });
}

// ===== NAVIGATION =====
function navigateMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    else if (currentMonth < 0) { currentMonth = 11; currentYear--; }

    if (_currentView === 'view-home') renderHome();
    else renderDashboard();
}
