/* ============================================
   REGISTRO HORAS EXTRAS - APP LOGIC
   IndexedDB + Local File Storage
   ============================================ */

// ===== CONSTANTS =====
const DB_NAME = 'HorasExtraDB';
const DB_VERSION = 1;
const STORE_RECORDS = 'records';
const STORE_SETTINGS = 'settings';
const FILE_NAME = 'horas-extra-db.json';

const DEFAULT_SETTINGS = {
    hourlyRate: 10,
    defaultStartTime: '07:00',
    contractHours: 8,
    lunchDuration: 1,
    storageMode: 'indexeddb' // 'indexeddb' or 'file'
};

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ===== IN-MEMORY CACHE =====
// All reads are instant from cache. Writes go to cache + persist async.
let _cachedRecords = [];
let _cachedSettings = { ...DEFAULT_SETTINGS };
let _dbReady = false;

// ===== STATE =====
let currentYear, currentMonth;
let deleteTargetId = null;
let editTargetId = null;

// ===== INDEXEDDB LAYER =====
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_RECORDS)) {
                db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
                db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
            }
        };

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function idbLoadAll() {
    try {
        const db = await openDB();

        // Load records
        const recordsTx = db.transaction(STORE_RECORDS, 'readonly');
        const recordsStore = recordsTx.objectStore(STORE_RECORDS);
        const records = await new Promise((resolve, reject) => {
            const req = recordsStore.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        // Load settings
        const settingsTx = db.transaction(STORE_SETTINGS, 'readonly');
        const settingsStore = settingsTx.objectStore(STORE_SETTINGS);
        const settingsRow = await new Promise((resolve, reject) => {
            const req = settingsStore.get('app_settings');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        _cachedRecords = records || [];
        if (settingsRow && settingsRow.data) {
            _cachedSettings = { ...DEFAULT_SETTINGS, ...settingsRow.data };
        }

        db.close();
        _dbReady = true;

        // Migrate from localStorage if first time
        if (_cachedRecords.length === 0) {
            const lsRecords = localStorage.getItem('overtime_records');
            if (lsRecords) {
                _cachedRecords = JSON.parse(lsRecords);
                await idbSaveRecords();
            }
        }
        if (!settingsRow) {
            const lsSettings = localStorage.getItem('overtime_settings');
            if (lsSettings) {
                _cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(lsSettings) };
                await idbSaveSettings();
            }
        }

        // Migrate old records (add title field)
        let changed = false;
        _cachedRecords.forEach(r => {
            if (r.title === undefined) { r.title = ''; changed = true; }
        });
        if (changed) await idbSaveRecords();

    } catch (err) {
        console.error('IndexedDB load error, falling back to localStorage:', err);
        _cachedRecords = JSON.parse(localStorage.getItem('overtime_records') || '[]');
        _cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('overtime_settings') || '{}') };
    }
}

async function idbSaveRecords() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_RECORDS, 'readwrite');
        const store = tx.objectStore(STORE_RECORDS);
        store.clear();
        _cachedRecords.forEach(r => store.put(r));
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch (err) {
        console.error('IndexedDB save error:', err);
    }
}

async function idbSaveSettings() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_SETTINGS, 'readwrite');
        const store = tx.objectStore(STORE_SETTINGS);
        store.put({ key: 'app_settings', data: _cachedSettings });
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch (err) {
        console.error('IndexedDB settings save error:', err);
    }
}

// ===== UNIFIED DATA API =====
function getSettings() {
    return { ..._cachedSettings };
}

function saveSettings(settings) {
    _cachedSettings = { ...settings };
    idbSaveSettings();
    autoSaveFile();
}

function getRecords() {
    return [..._cachedRecords];
}

function saveRecords(records) {
    _cachedRecords = [...records];
    idbSaveRecords();
}

function addRecord(record) {
    record.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    _cachedRecords.push(record);
    _cachedRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
    idbSaveRecords();
    autoSaveFile();
    return record;
}

function updateRecord(id, updatedData) {
    const idx = _cachedRecords.findIndex(r => r.id === id);
    if (idx !== -1) {
        _cachedRecords[idx] = { ..._cachedRecords[idx], ...updatedData };
        _cachedRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
        idbSaveRecords();
        autoSaveFile();
    }
}

function deleteRecord(id) {
    _cachedRecords = _cachedRecords.filter(r => r.id !== id);
    idbSaveRecords();
    autoSaveFile();
}

// ===== LOCAL FILE MODE =====
function autoSaveFile() {
    if (_cachedSettings.storageMode !== 'file') return;
    downloadDataFile();
}

function downloadDataFile() {
    const data = {
        settings: {
            hourlyRate: _cachedSettings.hourlyRate,
            defaultStartTime: _cachedSettings.defaultStartTime,
            contractHours: _cachedSettings.contractHours,
            lunchDuration: _cachedSettings.lunchDuration
        },
        records: _cachedRecords,
        lastSaved: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = FILE_NAME;
    a.click();
    URL.revokeObjectURL(url);

    showFileStatus('Archivo guardado: ' + new Date().toLocaleTimeString('es-ES'));
}

function loadDataFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.records) {
                    _cachedRecords = data.records;
                    // Migrate title field
                    _cachedRecords.forEach(r => { if (r.title === undefined) r.title = ''; });
                    idbSaveRecords();
                }
                if (data.settings) {
                    _cachedSettings = { ..._cachedSettings, ...data.settings, storageMode: _cachedSettings.storageMode };
                    idbSaveSettings();
                }
                resolve(true);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

function showFileStatus(text) {
    const statusEl = document.getElementById('file-status');
    const statusText = document.getElementById('file-status-text');
    if (statusEl && statusText) {
        statusText.textContent = text;
        statusEl.style.display = 'flex';
    }
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
        overtimeHours: Math.max(0, Math.round(overtimeHours * 100) / 100)
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
    records.forEach(r => { totalOvertime += r.overtimeHours; });

    return {
        totalHours: Math.round(totalOvertime * 100) / 100,
        totalMoney: Math.round(totalOvertime * _cachedSettings.hourlyRate * 100) / 100,
        totalDays: records.length
    };
}

// ===== FORMATTING HELPERS =====
function formatMoney(amount) {
    return amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatHours(hours) {
    if (hours === 0) return '0h';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    if (h === 0) return `${m}min`;
    return `${h}h ${m}min`;
}

function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return {
        dayNum: d.getDate(),
        dayName: DAY_NAMES[d.getDay()],
        full: `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`
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

// ===== RENDER: DASHBOARD =====
function renderDashboard() {
    const now = new Date();
    const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();

    document.getElementById('current-month-name').textContent =
        `${MONTH_NAMES[currentMonth]} ${currentYear}`;

    const badge = document.getElementById('current-month-badge');
    badge.style.display = isCurrentMonth ? 'inline-block' : 'none';

    const summary = getMonthSummary(currentYear, currentMonth);
    document.getElementById('total-hours').textContent = formatHours(summary.totalHours);
    document.getElementById('total-money').textContent = formatMoney(summary.totalMoney);
    document.getElementById('total-days').textContent = summary.totalDays + ' días';

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

        listEl.innerHTML = sorted.map((record, i) => {
            const dateInfo = formatDate(record.date);
            const money = record.overtimeHours * _cachedSettings.hourlyRate;
            const titleHtml = record.title ? `<div class="record-title">${escapeHtml(record.title)}</div>` : '';

            return `
                <div class="record-item" data-id="${record.id}" onclick="handleEdit('${record.id}')" style="animation-delay:${i * 40}ms">
                    <div class="record-date-badge">
                        <span class="record-day-num">${dateInfo.dayNum}</span>
                        <span class="record-day-name">${dateInfo.dayName}</span>
                    </div>
                    <div class="record-details">
                        ${titleHtml}
                        <div class="record-time-range">
                            ${record.startTime} <span class="arrow">→</span> ${record.endTime}
                        </div>
                        <div class="record-tags">
                            <span class="m3-chip chip-overtime">${formatHours(record.overtimeHours)} extra</span>
                            ${record.lunchBreak ? '<span class="m3-chip chip-lunch">Comida</span>' : ''}
                            <span class="m3-chip chip-money">${formatMoney(money)}</span>
                        </div>
                    </div>
                    <div class="record-actions">
                        <button class="btn-delete" onclick="event.stopPropagation(); handleDelete('${record.id}')" aria-label="Eliminar">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// ===== RENDER: SETTINGS =====
function renderSettings() {
    document.getElementById('setting-rate').value = _cachedSettings.hourlyRate;
    document.getElementById('setting-start-time').value = _cachedSettings.defaultStartTime;
    document.getElementById('setting-contract-hours').value = _cachedSettings.contractHours;
    document.getElementById('setting-lunch-duration').value = _cachedSettings.lunchDuration;

    // Storage selector
    const segItems = document.querySelectorAll('#storage-selector .m3-seg-item');
    segItems.forEach(item => {
        item.classList.toggle('active', item.dataset.value === _cachedSettings.storageMode);
    });

    // File config visibility
    document.getElementById('file-config').style.display =
        _cachedSettings.storageMode === 'file' ? 'block' : 'none';
}

// ===== MODAL MANAGEMENT =====
function openModal(overlayId) {
    const overlay = document.getElementById(overlayId);
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(overlayId) {
    const overlay = document.getElementById(overlayId);
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function openAddModal() {
    editTargetId = null;
    const now = new Date();

    document.getElementById('modal-title').textContent = 'Nuevo registro';
    document.getElementById('btn-submit-text').textContent = 'Guardar registro';
    document.getElementById('input-title').value = '';
    document.getElementById('input-date').value = formatInputDate(now);
    document.getElementById('input-start-time').value = _cachedSettings.defaultStartTime;
    document.getElementById('input-end-time').value = '';
    document.getElementById('input-lunch').checked = false;
    document.getElementById('preview-lunch-row').style.display = 'none';

    document.getElementById('preview-contract').textContent = `− ${_cachedSettings.contractHours}h`;
    document.getElementById('preview-lunch').textContent = `− ${_cachedSettings.lunchDuration}h`;

    updateCalcPreview();
    openModal('modal-overlay');
}

function openEditModal(id) {
    editTargetId = id;
    const record = _cachedRecords.find(r => r.id === id);
    if (!record) return;

    document.getElementById('modal-title').textContent = 'Editar registro';
    document.getElementById('btn-submit-text').textContent = 'Actualizar registro';
    document.getElementById('input-title').value = record.title || '';
    document.getElementById('input-date').value = record.date;
    document.getElementById('input-start-time').value = record.startTime;
    document.getElementById('input-end-time').value = record.endTime;
    document.getElementById('input-lunch').checked = record.lunchBreak;
    document.getElementById('preview-lunch-row').style.display = record.lunchBreak ? 'flex' : 'none';

    document.getElementById('preview-contract').textContent = `− ${_cachedSettings.contractHours}h`;
    document.getElementById('preview-lunch').textContent = `− ${_cachedSettings.lunchDuration}h`;

    updateCalcPreview();
    openModal('modal-overlay');
}

// ===== CALC PREVIEW =====
function updateCalcPreview() {
    const startTime = document.getElementById('input-start-time').value;
    const endTime = document.getElementById('input-end-time').value;
    const lunch = document.getElementById('input-lunch').checked;

    document.getElementById('preview-lunch-row').style.display = lunch ? 'flex' : 'none';

    if (!startTime || !endTime) {
        document.getElementById('preview-worked').textContent = '--';
        document.getElementById('preview-overtime').textContent = '--';
        document.getElementById('preview-money').textContent = '--';
        return;
    }

    const result = calculateOvertime(startTime, endTime, _cachedSettings.contractHours, lunch, _cachedSettings.lunchDuration);

    document.getElementById('preview-worked').textContent = formatHours(result.totalHours);
    document.getElementById('preview-overtime').textContent = formatHours(result.overtimeHours);

    const money = result.overtimeHours * _cachedSettings.hourlyRate;
    document.getElementById('preview-money').textContent = formatMoney(money);
}

// ===== NAVIGATION =====
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    const fab = document.getElementById('fab-add');
    if (viewId === 'view-settings') {
        fab.classList.add('hidden');
    } else {
        fab.classList.remove('hidden');
    }
}

function navigateMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    else if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderDashboard();
}

// ===== HANDLERS =====
function handleEdit(id) { openEditModal(id); }
function handleDelete(id) { deleteTargetId = id; openModal('modal-delete-overlay'); }

// ===== TOAST / SNACKBAR =====
let toastTimeout;
function showToast(icon, message, type) {
    type = type || 'info';
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toast-icon');
    const toastMsg = document.getElementById('toast-message');

    toastIcon.textContent = icon;
    toastMsg.textContent = message;

    toast.className = 'm3-snackbar';
    toast.classList.add('snackbar-' + type);

    clearTimeout(toastTimeout);
    requestAnimationFrame(() => toast.classList.add('show'));
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== EVENT LISTENERS =====
function initEventListeners() {
    // Settings navigation
    document.getElementById('btn-settings').addEventListener('click', () => {
        renderSettings();
        showView('view-settings');
    });

    document.getElementById('btn-back').addEventListener('click', () => {
        showView('view-dashboard');
        renderDashboard();
    });

    // Month navigation
    document.getElementById('btn-prev-month').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('btn-next-month').addEventListener('click', () => navigateMonth(1));

    // FAB
    document.getElementById('fab-add').addEventListener('click', openAddModal);

    // Modal close
    document.getElementById('btn-close-modal').addEventListener('click', () => closeModal('modal-overlay'));
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal('modal-overlay');
    });

    // "Ahora" button
    document.getElementById('btn-now').addEventListener('click', () => {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        document.getElementById('input-end-time').value = `${h}:${m}`;
        updateCalcPreview();
    });

    // Live calc preview
    document.getElementById('input-start-time').addEventListener('input', updateCalcPreview);
    document.getElementById('input-end-time').addEventListener('input', updateCalcPreview);
    document.getElementById('input-lunch').addEventListener('change', updateCalcPreview);

    // Form submit (add or edit)
    document.getElementById('form-add-record').addEventListener('submit', (e) => {
        e.preventDefault();

        const title = document.getElementById('input-title').value.trim();
        const date = document.getElementById('input-date').value;
        const startTime = document.getElementById('input-start-time').value;
        const endTime = document.getElementById('input-end-time').value;
        const lunchBreak = document.getElementById('input-lunch').checked;

        if (!date || !startTime || !endTime) {
            showToast('warning', 'Rellena todos los campos', 'warning');
            return;
        }

        const result = calculateOvertime(startTime, endTime, _cachedSettings.contractHours, lunchBreak, _cachedSettings.lunchDuration);

        if (result.overtimeHours <= 0) {
            showToast('info', 'No hay horas extras con estos datos', 'warning');
            return;
        }

        const recordData = {
            title, date, startTime, endTime, lunchBreak,
            totalHours: result.totalHours,
            overtimeHours: result.overtimeHours
        };

        if (editTargetId) {
            updateRecord(editTargetId, recordData);
            closeModal('modal-overlay');
            showToast('edit', 'Registro actualizado', 'success');
        } else {
            addRecord(recordData);
            closeModal('modal-overlay');
            showToast('check_circle', 'Registro guardado', 'success');
        }

        editTargetId = null;
        const d = new Date(date + 'T00:00:00');
        currentYear = d.getFullYear();
        currentMonth = d.getMonth();
        renderDashboard();
    });

    // Save settings
    document.getElementById('btn-save-settings').addEventListener('click', () => {
        const rate = parseFloat(document.getElementById('setting-rate').value);
        const startTime = document.getElementById('setting-start-time').value;
        const contractHours = parseFloat(document.getElementById('setting-contract-hours').value);
        const lunchDuration = parseFloat(document.getElementById('setting-lunch-duration').value);

        if (isNaN(rate) || rate < 0) { showToast('warning', 'Precio por hora no válido', 'warning'); return; }
        if (!startTime) { showToast('warning', 'Hora de inicio no válida', 'warning'); return; }
        if (isNaN(contractHours) || contractHours < 0 || contractHours > 24) { showToast('warning', 'Horas de contrato no válidas', 'warning'); return; }
        if (isNaN(lunchDuration) || lunchDuration < 0 || lunchDuration > 4) { showToast('warning', 'Duración de pausa no válida', 'warning'); return; }

        saveSettings({
            ..._cachedSettings,
            hourlyRate: rate,
            defaultStartTime: startTime,
            contractHours,
            lunchDuration
        });

        showToast('check_circle', 'Ajustes guardados', 'success');
        renderDashboard();
    });

    // Storage selector
    document.querySelectorAll('#storage-selector .m3-seg-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#storage-selector .m3-seg-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const mode = btn.dataset.value;
            _cachedSettings.storageMode = mode;
            idbSaveSettings();

            document.getElementById('file-config').style.display = mode === 'file' ? 'block' : 'none';

            if (mode === 'file') {
                showToast('description', 'Modo archivo: carga tu JSON o guarda uno nuevo', 'info');
            } else {
                showToast('smartphone', 'Datos guardados en IndexedDB', 'info');
            }
        });
    });

    // File mode: load file
    document.getElementById('btn-load-file').addEventListener('click', () => {
        document.getElementById('file-load-input').click();
    });

    document.getElementById('file-load-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            await loadDataFile(file);
            renderSettings();
            renderDashboard();
            showToast('folder_open', 'Archivo cargado: ' + file.name, 'success');
        } catch (err) {
            showToast('error', 'Error al leer el archivo', 'error');
            console.error(err);
        }
        e.target.value = '';
    });

    // File mode: save file now
    document.getElementById('btn-save-file').addEventListener('click', () => {
        downloadDataFile();
        showToast('save', 'Archivo guardado', 'success');
    });

    // Delete modal
    document.getElementById('btn-cancel-delete').addEventListener('click', () => {
        deleteTargetId = null;
        closeModal('modal-delete-overlay');
    });

    document.getElementById('btn-confirm-delete').addEventListener('click', () => {
        if (deleteTargetId) {
            deleteRecord(deleteTargetId);
            deleteTargetId = null;
            closeModal('modal-delete-overlay');
            renderDashboard();
            showToast('delete', 'Registro eliminado', 'error');
        }
    });

    document.getElementById('modal-delete-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            deleteTargetId = null;
            closeModal('modal-delete-overlay');
        }
    });

    // Export data
    document.getElementById('btn-export-data').addEventListener('click', () => {
        const data = {
            settings: {
                hourlyRate: _cachedSettings.hourlyRate,
                defaultStartTime: _cachedSettings.defaultStartTime,
                contractHours: _cachedSettings.contractHours,
                lunchDuration: _cachedSettings.lunchDuration
            },
            records: _cachedRecords,
            exportDate: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `horas-extra-backup-${formatInputDate(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('upload', 'Datos exportados', 'success');
    });

    // Import data
    document.getElementById('btn-import-data').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });

    document.getElementById('import-file-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            await loadDataFile(file);
            renderSettings();
            renderDashboard();
            showToast('download', 'Datos importados correctamente', 'success');
        } catch {
            showToast('error', 'Error al importar el archivo', 'error');
        }
        e.target.value = '';
    });

    // Clear all data
    document.getElementById('btn-clear-data').addEventListener('click', async () => {
        if (confirm('⚠️ ¿Estás seguro de que quieres BORRAR TODOS los datos?\n\nEsta acción no se puede deshacer.')) {
            _cachedRecords = [];
            _cachedSettings = { ...DEFAULT_SETTINGS };
            await idbSaveRecords();
            await idbSaveSettings();
            localStorage.removeItem('overtime_records');
            localStorage.removeItem('overtime_settings');
            renderSettings();
            renderDashboard();
            showToast('delete_forever', 'Todos los datos borrados', 'error');
        }
    });
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();

    // Load data from IndexedDB (or migrate from localStorage)
    await idbLoadAll();

    initEventListeners();
    renderDashboard();
});

// ===== SERVICE WORKER REGISTRATION =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW registration failed:', err));
    });
}
