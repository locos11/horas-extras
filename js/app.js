/* ============================================
   APP MAIN — Initialization & Event Listeners
   Depends on: storage.js, calculations.js, render.js
   ============================================ */

// ===== STATE =====
let currentYear, currentMonth;
let deleteTargetId = null;
let editTargetId = null;

// ===== HANDLERS =====
function handleDelete(id) {
    // Undo-capable delete: soft delete + snackbar with undo
    const record = _cachedRecords.find(r => r.id === id);
    if (!record) return;

    const backup = { ...record };
    deleteRecord(id);
    renderDashboard();

    showToast('delete', 'Registro eliminado', 'error', () => {
        // Undo: re-add the record
        _cachedRecords.push(backup);
        _cachedRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
        idbSaveRecords();
        autoSaveFile();
        renderDashboard();
        showToast('undo', 'Registro restaurado', 'success');
    });
}

// ===== EVENT LISTENERS =====
function initEventListeners() {
    // Settings navigation
    document.getElementById('btn-settings').addEventListener('click', () => {
        renderSettings();
        showView('view-settings', 'forward');
    });

    document.getElementById('btn-back').addEventListener('click', () => {
        showView('view-dashboard', 'back');
        renderDashboard();
    });

    // Month navigation
    document.getElementById('btn-prev-month').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('btn-next-month').addEventListener('click', () => navigateMonth(1));

    // Calendar toggle
    const calToggle = document.getElementById('btn-toggle-calendar');
    if (calToggle) {
        calToggle.addEventListener('click', () => {
            const calSection = document.getElementById('calendar-section');
            const isVisible = calSection.classList.toggle('calendar-visible');
            calToggle.classList.toggle('active', isVisible);
            if (isVisible) renderCalendar();
        });
    }

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
            showView('view-dashboard', 'back');
        });
    }
    const btnAnnualPrev = document.getElementById('btn-annual-prev');
    if (btnAnnualPrev) {
        btnAnnualPrev.addEventListener('click', () => {
            currentYear--;
            renderAnnualSummary();
        });
    }
    const btnAnnualNext = document.getElementById('btn-annual-next');
    if (btnAnnualNext) {
        btnAnnualNext.addEventListener('click', () => {
            currentYear++;
            renderAnnualSummary();
        });
    }

    // FAB
    document.getElementById('fab-add').addEventListener('click', openAddModal);

    // Modal close
    document.getElementById('btn-close-modal').addEventListener('click', () => closeModal('modal-overlay'));
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal('modal-overlay');
    });

    // Detail modal close
    const detailOverlay = document.getElementById('modal-detail-overlay');
    if (detailOverlay) {
        document.getElementById('btn-close-detail').addEventListener('click', () => closeModal('modal-detail-overlay'));
        detailOverlay.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal('modal-detail-overlay');
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

    // Form submit (add or edit)
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

    // Delete modal (legacy — now mostly handled by undo snackbar)
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
        if (e.target === e.currentTarget) {
            deleteTargetId = null;
            closeModal('modal-delete-overlay');
        }
    });

    // Undo button in snackbar
    const undoBtn = document.getElementById('toast-undo');
    if (undoBtn) {
        undoBtn.addEventListener('click', handleUndoClick);
    }

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
            renderDashboard();
            showToast('download', 'Datos importados correctamente', 'success');
        } catch (err) {
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
