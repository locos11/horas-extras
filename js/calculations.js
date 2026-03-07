/* ============================================
   CALCULATIONS & FORMATTING MODULE
   ============================================ */

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

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
        const d = new Date(r.date);
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
            shortName: MONTH_NAMES[m].substring(0, 3),
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
        dayName: DAY_NAMES[d.getDay()],
        full: `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`,
        weekday: DAY_NAMES[d.getDay()]
    };
}

function formatInputDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
