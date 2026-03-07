/* ============================================
   CALCULATIONS & FORMATTING MODULE
   ============================================ */

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MONTH_SHORT = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Converts JS getDay() (0=Sun) to Monday-first index (0=Mon)
function getMondayIndex(jsDay) {
    return (jsDay + 6) % 7;
}

// ===== CALCULATION ENGINE =====
function calculateOvertime(startTime, endTime, contractHours, lunchBreak, lunchDuration) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);

    let totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const totalHours = totalMinutes / 60;
    let overtimeHours = totalHours - contractHours;

    if (lunchBreak) {
        overtimeHours -= lunchDuration;
    }

    return {
        totalHours: Math.round(totalHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100
    };
}

function getMonthRecords(year, month) {
    return _cachedRecords.filter(r => {
        const d = new Date(r.date + 'T00:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
    });
}

function getMonthSummary(year, month) {
    const records = getMonthRecords(year, month);
    let totalOvertime = 0;
    let totalDeficit = 0;
    records.forEach(r => {
        if (r.overtimeHours >= 0) {
            totalOvertime += r.overtimeHours;
        } else {
            totalDeficit += r.overtimeHours;
        }
    });

    const settings = getSettings();
    return {
        totalHours: Math.round(totalOvertime * 100) / 100,
        totalDeficit: Math.round(totalDeficit * 100) / 100,
        totalMoney: Math.round(totalOvertime * settings.hourlyRate * 100) / 100,
        totalDays: records.length
    };
}

function getAnnualSummary(year) {
    const months = [];
    let maxHours = 0;
    let totalYearHours = 0;
    let totalYearMoney = 0;
    let totalYearDays = 0;
    const settings = getSettings();

    for (let m = 0; m < 12; m++) {
        const summary = getMonthSummary(year, m);
        months.push({
            month: m,
            name: MONTH_NAMES[m],
            shortName: MONTH_SHORT[m],
            hours: summary.totalHours,
            money: summary.totalMoney,
            days: summary.totalDays
        });
        if (summary.totalHours > maxHours) maxHours = summary.totalHours;
        totalYearHours += summary.totalHours;
        totalYearMoney += summary.totalMoney;
        totalYearDays += summary.totalDays;
    }

    return {
        year,
        months,
        maxHours,
        totalHours: Math.round(totalYearHours * 100) / 100,
        totalMoney: Math.round(totalYearMoney * 100) / 100,
        totalDays: totalYearDays,
        avgHoursPerDay: totalYearDays > 0 ? Math.round((totalYearHours / totalYearDays) * 100) / 100 : 0
    };
}

// ===== TRIP CALCULATIONS =====
function getTripDuration(trip) {
    const start = new Date(trip.dateStart + 'T00:00:00');
    const end = new Date(trip.dateEnd + 'T00:00:00');
    const diffMs = end - start;
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return days;
}

function getTripStatus(trip) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(trip.dateStart + 'T00:00:00');
    const end = new Date(trip.dateEnd + 'T00:00:00');

    if (today < start) return 'upcoming';
    if (today > end) return 'past';
    return 'active';
}

function getDaysUntilTrip(trip) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(trip.dateStart + 'T00:00:00');
    const diffMs = start - today;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// ===== FORMATTING HELPERS =====
function formatMoney(amount) {
    return amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatHours(hours) {
    const abs = Math.abs(hours);
    const sign = hours < 0 ? '−' : '';
    if (abs === 0) return '0h';
    const h = Math.floor(abs);
    const m = Math.round((abs - h) * 60);
    if (m === 0) return `${sign}${h}h`;
    if (h === 0) return `${sign}${m}min`;
    return `${sign}${h}h ${m}min`;
}

function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return {
        dayNum: d.getDate(),
        dayName: DAY_NAMES[getMondayIndex(d.getDay())],
        dayNameFull: DAY_NAMES_FULL[d.getDay()],
        full: `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`,
        weekday: DAY_NAMES[getMondayIndex(d.getDay())],
        monthName: MONTH_NAMES[d.getMonth()],
        year: d.getFullYear()
    };
}

function formatDateRange(startStr, endStr) {
    const s = formatDate(startStr);
    const e = formatDate(endStr);
    if (startStr === endStr) {
        return `${s.dayNum} ${s.monthName}`;
    }
    if (s.monthName === e.monthName && s.year === e.year) {
        return `${s.dayNum} – ${e.dayNum} ${s.monthName}`;
    }
    return `${s.dayNum} ${s.monthName} – ${e.dayNum} ${e.monthName}`;
}

function formatInputDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatRelativeDate(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr + 'T00:00:00');
    const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    if (diffDays === -1) return 'Ayer';
    if (diffDays > 1 && diffDays <= 7) return `En ${diffDays} días`;
    if (diffDays > 7 && diffDays <= 30) return `En ${Math.ceil(diffDays / 7)} semanas`;
    return formatDate(dateStr).full;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
