/* ============================================
   APP MAIN — Initialization & Event Listeners
   Depends on: storage.js, calculations.js, render.js
   v2: Bottom nav + Trips
   ============================================ */

// ===== STATE =====
let currentYear, currentMonth;
let deleteTargetId = null;
let editTargetId = null;
let editTripTargetId = null;

// ===== HANDLERS =====
function handleDelete(id) {
    const record = _cachedRecords.find(r => r.id === id);
    if (!record) return;

    const backup = { ...record };
    deleteRecord(id);
    refreshCurrentView();

    showToast('delete', 'Registro eliminado', 'error', () => {
        _cachedRecords.push(backup);
        _cachedRecords.sort((a, b) => new Date(a.date + 'T00:00:00') - new Date(b.date + 'T00:00:00'));
        idbSaveRecords();
        autoSaveFile();
        refreshCurrentView();
        showToast('undo', 'Registro restaurado', 'success');
    });
}

function handleDeleteTrip(id) {
    const trip = _cachedTrips.find(t => t.id === id);
    if (!trip) return;

    const backup = { ...trip, companions: [...(trip.companions || [])] };
    deleteTrip(id);
    refreshCurrentView();

    showToast('delete', 'Salida eliminada', 'error', () => {
        _cachedTrips.push(backup);
        _cachedTrips.sort((a, b) => new Date(a.dateStart + 'T00:00:00') - new Date(b.dateStart + 'T00:00:00'));
        idbSaveTrips();
        autoSaveFile();
        refreshCurrentView();
        showToast('undo', 'Salida restaurada', 'success');
    });
}

function refreshCurrentView() {
    if (_currentView === 'view-home') renderHome();
    else if (_currentView === 'view-overtime') renderDashboard();
    else if (_currentView === 'view-trips') renderTrips();
}

// ===== EVENT LISTENERS =====
function initEventListeners() {
    // Bottom navigation
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const viewId = item.dataset.view;
            switchNavView(viewId);
        });
    });

    // Settings navigation
    document.getElementById('btn-settings').addEventListener('click', () => {
        renderSettings();
        showView('view-settings', 'forward');
    });

    document.getElementById('btn-back').addEventListener('click', () => {
        showView(_activeNavView, 'back');
        refreshCurrentView();
    });

    // Home month navigation
    document.getElementById('btn-prev-month-home').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('btn-next-month-home').addEventListener('click', () => navigateMonth(1));

    // Overtime month navigation
    document.getElementById('btn-prev-month').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('btn-next-month').addEventListener('click', () => navigateMonth(1));

    // Annual summary
    const btnAnnual = document.getElementById('btn-annual');
    if (btnAnnual) {
        btnAnnual.addEventListener('click', () => {
            renderAnnualSummary();
            showView('view-annual', 'forward');
        });
    }
    const btnAnnualBack = document.getElementById('btn-annual-back');
    if (btnAnnualBack) {
        btnAnnualBack.addEventListener('click', () => {
            showView(_activeNavView, 'back');
        });
    }
    const btnAnnualPrev = document.getElementById('btn-annual-prev');
    if (btnAnnualPrev) {
        btnAnnualPrev.addEventListener('click', () => { currentYear--; renderAnnualSummary(); });
    }
    const btnAnnualNext = document.getElementById('btn-annual-next');
    if (btnAnnualNext) {
        btnAnnualNext.addEventListener('click', () => { currentYear++; renderAnnualSummary(); });
    }

    // FAB — contextual action
    document.getElementById('fab-add').addEventListener('click', () => {
        if (_currentView === 'view-trips') {
            openAddTripModal();
        } else {
            openAddModal();
        }
    });

    // Record modal close
    document.getElementById('btn-close-modal').addEventListener('click', () => closeModal('modal-overlay'));
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal('modal-overlay');
    });

    // Trip modal close
    document.getElementById('btn-close-trip-modal').addEventListener('click', () => closeModal('modal-trip-overlay'));
    document.getElementById('modal-trip-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal('modal-trip-overlay');
    });

    // Detail modal close
    const detailOverlay = document.getElementById('modal-detail-overlay');
    if (detailOverlay) {
        document.getElementById('btn-close-detail').addEventListener('click', () => closeModal('modal-detail-overlay'));
        detailOverlay.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal('modal-detail-overlay');
        });
    }

    // Trip detail modal close
    const tripDetailOverlay = document.getElementById('modal-trip-detail-overlay');
    if (tripDetailOverlay) {
        document.getElementById('btn-close-trip-detail').addEventListener('click', () => closeModal('modal-trip-detail-overlay'));
        tripDetailOverlay.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal('modal-trip-detail-overlay');
        });
    }

    // "Ahora" button
    document.getElementById('btn-now').addEventListener('click', () => {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        document.getElementById('input-end-time').value = h + ':' + m;
        updateCalcPreview();
    });

    // Live calc preview
    document.getElementById('input-start-time').addEventListener('input', updateCalcPreview);
    document.getElementById('input-end-time').addEventListener('input', updateCalcPreview);
    document.getElementById('input-lunch').addEventListener('change', updateCalcPreview);

    // Record form submit
    document.getElementById('form-add-record').addEventListener('submit', (e) => {
        e.preventDefault();
        const settings = getSettings();
        const title = document.getElementById('input-title').value.trim();
        const date = document.getElementById('input-date').value;
        const startTime = document.getElementById('input-start-time').value;
        const endTime = document.getElementById('input-end-time').value;
        const lunchBreak = document.getElementById('input-lunch').checked;

        if (!date || !startTime || !endTime) {
            showToast('warning', 'Rellena todos los campos', 'warning');
            return;
        }

        const result = calculateOvertime(startTime, endTime, settings.contractHours, lunchBreak, settings.lunchDuration);
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
        refreshCurrentView();
    });

    // Trip form submit
    document.getElementById('form-add-trip').addEventListener('submit', (e) => {
        e.preventDefault();
        const hotelName = document.getElementById('input-trip-hotel').value.trim();
        const dateStart = document.getElementById('input-trip-start').value;
        const dateEnd = document.getElementById('input-trip-end').value;
        const description = document.getElementById('input-trip-description').value.trim();

        if (!hotelName || !dateStart || !dateEnd) {
            showToast('warning', 'Rellena los campos obligatorios', 'warning');
            return;
        }

        if (dateEnd < dateStart) {
            showToast('warning', 'La fecha de fin no puede ser anterior', 'warning');
            return;
        }

        // Gather selected companions
        const selectedChips = document.querySelectorAll('#trip-companion-chips .trip-comp-chip.selected');
        const companions = Array.from(selectedChips).map(chip => chip.dataset.name);

        const tripData = { hotelName, dateStart, dateEnd, description, companions };

        if (editTripTargetId) {
            updateTrip(editTripTargetId, tripData);
            closeModal('modal-trip-overlay');
            showToast('edit', 'Salida actualizada', 'success');
        } else {
            addTrip(tripData);
            closeModal('modal-trip-overlay');
            showToast('flight_takeoff', 'Salida programada', 'success');
        }

        editTripTargetId = null;
        refreshCurrentView();
    });

    // Trips tab filter
    document.querySelectorAll('.trips-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.trips-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            _tripsFilter = tab.dataset.filter;
            renderTrips();
        });
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
        refreshCurrentView();
    });

    // Add companion
    document.getElementById('btn-add-companion').addEventListener('click', () => {
        const input = document.getElementById('input-new-companion');
        const name = input.value.trim();
        if (!name) { showToast('warning', 'Escribe un nombre', 'warning'); return; }
        if (_cachedSettings.companions.includes(name)) { showToast('warning', 'Ya existe ese compañero', 'warning'); return; }

        _cachedSettings.companions.push(name);
        idbSaveSettings();
        input.value = '';
        renderCompanionsSettings();
        showToast('person_add', 'Compañero añadido', 'success');
    });

    // Allow Enter key to add companion
    document.getElementById('input-new-companion').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('btn-add-companion').click();
        }
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
            showToast(mode === 'file' ? 'description' : 'smartphone',
                mode === 'file' ? 'Modo archivo activado' : 'Modo IndexedDB activado', 'info');
        });
    });

    // File mode: load/save
    document.getElementById('btn-load-file').addEventListener('click', () => {
        document.getElementById('file-load-input').click();
    });
    document.getElementById('file-load-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            await loadDataFile(file);
            renderSettings();
            refreshCurrentView();
            showToast('folder_open', 'Archivo cargado', 'success');
        } catch (err) {
            showToast('error', 'Error al leer el archivo', 'error');
        }
        e.target.value = '';
    });
    document.getElementById('btn-save-file').addEventListener('click', () => {
        downloadDataFile();
        showToast('save', 'Archivo guardado', 'success');
    });

    // Delete modal (legacy)
    document.getElementById('btn-cancel-delete').addEventListener('click', () => {
        deleteTargetId = null;
        closeModal('modal-delete-overlay');
    });
    document.getElementById('btn-confirm-delete').addEventListener('click', () => {
        if (deleteTargetId) {
            handleDelete(deleteTargetId);
            deleteTargetId = null;
            closeModal('modal-delete-overlay');
        }
    });
    document.getElementById('modal-delete-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) { deleteTargetId = null; closeModal('modal-delete-overlay'); }
    });

    // Undo button
    const undoBtn = document.getElementById('toast-undo');
    if (undoBtn) undoBtn.addEventListener('click', handleUndoClick);

    // Export data
    document.getElementById('btn-export-data').addEventListener('click', () => {
        const data = {
            settings: {
                hourlyRate: _cachedSettings.hourlyRate,
                defaultStartTime: _cachedSettings.defaultStartTime,
                contractHours: _cachedSettings.contractHours,
                lunchDuration: _cachedSettings.lunchDuration,
                companions: _cachedSettings.companions || []
            },
            records: _cachedRecords,
            trips: _cachedTrips,
            exportDate: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'horas-extra-backup-' + formatInputDate(new Date()) + '.json';
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
            refreshCurrentView();
            showToast('download', 'Datos importados', 'success');
        } catch (err) {
            showToast('error', 'Error al importar', 'error');
        }
        e.target.value = '';
    });

    // Clear all data
    document.getElementById('btn-clear-data').addEventListener('click', async () => {
        if (confirm('⚠️ ¿Borrar TODOS los datos?\n\nEsta acción no se puede deshacer.')) {
            _cachedRecords = [];
            _cachedTrips = [];
            _cachedSettings = { ...DEFAULT_SETTINGS };
            await idbSaveRecords();
            await idbSaveTrips();
            await idbSaveSettings();
            localStorage.removeItem('overtime_records');
            localStorage.removeItem('overtime_settings');
            renderSettings();
            refreshCurrentView();
            showToast('delete_forever', 'Datos borrados', 'error');
        }
    });
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();

    await idbLoadAll();
    initEventListeners();
    renderHome();
});

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW registration failed:', err));
    });
}
