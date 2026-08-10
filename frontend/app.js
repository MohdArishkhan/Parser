(function () {
  // =========================================================
  // Digit-box fields (mobile numbers, dates, PIN codes, etc.)
  // =========================================================
  function buildDigitGroups() {
    document.querySelectorAll('[data-digit-group]').forEach((container) => {
      const prefix = container.dataset.prefix || '';
      const segments = (container.dataset.segments || '')
        .split(',')
        .map((n) => parseInt(n, 10))
        .filter((n) => !isNaN(n) && n > 0);
      const separator = container.dataset.separator || '';
      const editableBoxes = [];

      prefix.split('').forEach((ch) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'digit-box is-prefix';
        input.value = ch;
        input.readOnly = true;
        input.tabIndex = -1;
        input.setAttribute('aria-hidden', 'true');
        container.appendChild(input);
      });

      segments.forEach((segLen, segIdx) => {
        for (let i = 0; i < segLen; i++) {
          const input = document.createElement('input');
          input.type = 'text';
          input.inputMode = 'numeric';
          input.autocomplete = 'off';
          input.maxLength = 1;
          input.className = 'digit-box';
          container.appendChild(input);
          editableBoxes.push(input);
        }
        if (separator && segIdx < segments.length - 1) {
          const sep = document.createElement('span');
          sep.className = 'digit-sep';
          sep.textContent = separator;
          sep.setAttribute('aria-hidden', 'true');
          container.appendChild(sep);
        }
      });

      editableBoxes.forEach((box, i) => {
        box.addEventListener('input', () => {
          box.value = box.value.replace(/[^0-9a-zA-Z]/g, '').slice(-1);
          if (box.value && i < editableBoxes.length - 1) editableBoxes[i + 1].focus();
        });
        box.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !box.value && i > 0) {
            editableBoxes[i - 1].focus();
          } else if (e.key === 'ArrowLeft' && i > 0) {
            e.preventDefault();
            editableBoxes[i - 1].focus();
          } else if (e.key === 'ArrowRight' && i < editableBoxes.length - 1) {
            e.preventDefault();
            editableBoxes[i + 1].focus();
          }
        });
        box.addEventListener('paste', (e) => {
          const text = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9a-zA-Z]/g, '');
          if (!text) return;
          e.preventDefault();
          for (let k = 0; k < text.length && i + k < editableBoxes.length; k++) {
            editableBoxes[i + k].value = text[k];
          }
          editableBoxes[Math.min(i + text.length, editableBoxes.length - 1)].focus();
        });
      });
    });
  }
  buildDigitGroups();

  // =========================================================
  // Tenant photo preview
  // =========================================================
  const photoInput = document.getElementById('photoInput');
  const photoPreview = document.getElementById('photoPreview');
  const photoPlaceholder = document.getElementById('photoPlaceholder');
  if (photoInput) {
    photoInput.addEventListener('change', () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        photoPreview.src = reader.result;
        photoPreview.classList.remove('hidden');
        photoPlaceholder.classList.add('hidden');
      };
      reader.readAsDataURL(file);
    });
  }

  // =========================================================
  // Print / save as PDF (uses the browser's native print dialog)
  // =========================================================
  const printFormBtn = document.getElementById('printFormBtn');
  if (printFormBtn) {
    printFormBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // =========================================================
  // Upload modal logic
  // =========================================================
  const openUploadBtn = document.getElementById('openUploadBtn');
  const closeUploadBtn = document.getElementById('closeUploadBtn');
  const uploadModal = document.getElementById('uploadModal');

  function openModal() {
    uploadModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const firstFocusable = uploadModal.querySelector('#dropzone');
    if (firstFocusable) firstFocusable.focus();
  }
  function closeModal() {
    uploadModal.classList.add('hidden');
    document.body.style.overflow = '';
    openUploadBtn.focus();
  }
  if (openUploadBtn && uploadModal) {
    openUploadBtn.addEventListener('click', openModal);
    closeUploadBtn.addEventListener('click', closeModal);
    uploadModal.addEventListener('click', (e) => {
      if (e.target === uploadModal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !uploadModal.classList.contains('hidden')) closeModal();
    });
  }

  // =========================================================
  // Workflow Variables
  // =========================================================
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileCount = document.getElementById('fileCount');
  const fileList = document.getElementById('fileList');
  const clearFileBtn = document.getElementById('clearFileBtn');
  const uploadForm = document.getElementById('uploadForm');
  const submitBtn = document.getElementById('submitBtn');

  const stepsEl = document.getElementById('steps');
  const stepEls = {
    upload: stepsEl.querySelector('[data-step="upload"]'),
    parse: stepsEl.querySelector('[data-step="parse"]'),
    export: stepsEl.querySelector('[data-step="export"]'),
  };

  const batchSummary = document.getElementById('batchSummary');
  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const tableView = document.getElementById('tableView');
  const tableHeadRow = document.getElementById('tableHeadRow');
  const tableBody = document.getElementById('tableBody');
  const jsonView = document.getElementById('jsonView');
  const viewToggle = document.getElementById('viewToggle');
  const exportRow = document.getElementById('exportRow');

  let currentFiles = [];
  let parsedData = null;
  let currentView = 'table';

  // ---- Step tracker ----
  function setStep(name) {
    const order = ['upload', 'parse', 'export'];
    const idx = order.indexOf(name);
    order.forEach((key, i) => {
      stepEls[key].classList.remove('is-active', 'is-done');
      if (i < idx) stepEls[key].classList.add('is-done');
      if (i === idx) stepEls[key].classList.add('is-active');
    });
  }
  setStep('upload');

  // ---- Helpers ----
  function formatBytes(bytes) {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ---- File list ----
  function renderFileList() {
    fileList.innerHTML = '';

    currentFiles.forEach((file, i) => {
      const li = document.createElement('li');
      li.className = 'file-item';

      let thumbHtml;
      if (file.type.startsWith('image/')) {
        thumbHtml = `<img class="file-thumb" src="${URL.createObjectURL(file)}" alt="">`;
      } else {
        const ext = (file.name.split('.').pop() || '?').toUpperCase().slice(0, 4);
        thumbHtml = `<span class="file-badge">${escapeHtml(ext)}</span>`;
      }

      li.innerHTML = `
        ${thumbHtml}
        <div class="file-meta">
          <p class="file-name">${escapeHtml(file.name)}</p>
          <p class="file-size">${formatBytes(file.size)}</p>
        </div>
        <button type="button" class="file-remove" data-index="${i}" aria-label="Remove ${escapeHtml(file.name)}">&times;</button>
      `;
      fileList.appendChild(li);
    });

    fileCount.textContent = currentFiles.length === 1
      ? '1 file selected'
      : `${currentFiles.length} files selected`;
  }

  function handleFiles(incoming) {
    if (!incoming || incoming.length === 0) return;
    currentFiles = currentFiles.concat(Array.from(incoming));
    fileInfo.classList.remove('hidden');
    renderFileList();
    submitBtn.disabled = false;
    fileInput.value = '';
  }

  fileList.addEventListener('click', (e) => {
    const btn = e.target.closest('.file-remove');
    if (!btn) return;
    const idx = Number(btn.dataset.index);
    currentFiles.splice(idx, 1);
    if (currentFiles.length === 0) {
      fileInfo.classList.add('hidden');
      submitBtn.disabled = true;
    } else {
      renderFileList();
    }
  });

  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  ['dragenter', 'dragover'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
    })
  );
  dropzone.addEventListener('drop', (e) => {
    handleFiles(e.dataTransfer.files);
  });

  clearFileBtn.addEventListener('click', () => {
    currentFiles = [];
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    submitBtn.disabled = true;
  });

  // ---- Result panel states ----
  function showState(state) {
    emptyState.classList.add('hidden');
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    tableView.classList.add('hidden');
    jsonView.classList.add('hidden');
    exportRow.hidden = true;
    if (state !== 'result') batchSummary.classList.add('hidden');

    if (state === 'empty') emptyState.classList.remove('hidden');
    if (state === 'loading') loadingState.classList.remove('hidden');
    if (state === 'error') errorState.classList.remove('hidden');
    if (state === 'result') {
      exportRow.hidden = false;
      if (currentView === 'table') tableView.classList.remove('hidden');
      else jsonView.classList.remove('hidden');
    }
  }
  showState('empty');

  viewToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    currentView = btn.dataset.view;
    [...viewToggle.querySelectorAll('.toggle-btn')].forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
    if (parsedData !== null) showState('result');
  });

  // ---- Parse (batch) ----
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (currentFiles.length === 0) return;

    const formData = new FormData();
    currentFiles.forEach((file) => formData.append('files', file));

    submitBtn.disabled = true;
    setStep('parse');
    showState('loading');

    try {
      const response = await fetch('/parse-batch', { method: 'POST', body: formData });
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      const result = await response.json();
      parsedData = result;
      jsonView.textContent = JSON.stringify(result, null, 2);
      renderBatchSummary();
      renderTable();
      showState('result');
      setStep('export');

      // 💥 NEW: Trigger Form Auto-Fill when parsing finishes
      autoFillForm(parsedData);

    } catch (err) {
      errorState.textContent = `Could not parse this batch. ${err.message}`;
      showState('error');
      setStep('upload');
    } finally {
      submitBtn.disabled = currentFiles.length === 0;
    }
  });

  function renderBatchSummary() {
    if (!parsedData || !Array.isArray(parsedData.results)) {
      batchSummary.classList.add('hidden');
      return;
    }
    const total = parsedData.results.length;
    const successCount = parsedData.results.filter((r) => r.status === 'success').length;
    const errorCount = total - successCount;

    batchSummary.textContent = errorCount > 0
      ? `${successCount} of ${total} files parsed successfully — ${errorCount} failed`
      : `${total} of ${total} files parsed successfully`;
    batchSummary.classList.toggle('has-errors', errorCount > 0);
    batchSummary.classList.remove('hidden');
  }

  // ---- Flatten nested JSON into Field / Value rows ----
  function flatten(value, prefix, res) {
    res = res || {};
    if (value === null || value === undefined) {
      res[prefix || 'value'] = '';
      return res;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        res[prefix || 'value'] = '[]';
        return res;
      }
      value.forEach((item, i) => flatten(item, prefix ? `${prefix}[${i}]` : `[${i}]`, res));
      return res;
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        res[prefix || 'value'] = '{}';
        return res;
      }
      keys.forEach((k) => flatten(value[k], prefix ? `${prefix}.${k}` : k, res));
      return res;
    }
    res[prefix || 'value'] = value;
    return res;
  }

  function getRows() {
    if (parsedData && Array.isArray(parsedData.results)) {
      const rows = [];
      parsedData.results.forEach((r) => {
        const label = r.file_name || 'Unnamed file';
        if (r.status === 'success') {
          const flat = flatten(r.data, '', {});
          const entries = Object.entries(flat);
          if (entries.length === 0) {
            rows.push({ File: label, Field: '(no fields found)', Value: '' });
          } else {
            entries.forEach(([field, val]) => {
              rows.push({ File: label, Field: field, Value: String(val) });
            });
          }
        } else {
          rows.push({ File: label, Field: 'error', Value: String(r.error || 'Unknown error') });
        }
      });
      return rows;
    }

    const flat = flatten(parsedData, '', {});
    return Object.entries(flat).map(([field, val]) => ({ Field: field, Value: String(val) }));
  }

  function renderTable() {
    const rows = getRows();
    const columns = rows.length > 0 ? Object.keys(rows[0]) : ['Field', 'Value'];

    tableHeadRow.innerHTML = '';
    columns.forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col;
      th.className = `col-${col.toLowerCase()}`;
      tableHeadRow.appendChild(th);
    });

    tableBody.innerHTML = '';
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      if (row.Field === 'error') tr.classList.add('is-error-row');
      columns.forEach((col) => {
        const td = document.createElement('td');
        td.textContent = row[col];
        td.className = `col-${col.toLowerCase()}`;
        tr.appendChild(td);
      });
      tableBody.appendChild(tr);
    });
  }

  // =========================================================
  // 💥 NEW: Auto-Fill Form Logic
  // Matches extracted JSON to your HTML inputs perfectly
  // =========================================================
  function autoFillForm(data) {
    if (!data || !Array.isArray(data.results)) return;

    // 1. Combine all extracted data from the batch into one flat dictionary
    let flatData = {};
    data.results.forEach(res => {
      if (res.status === 'success' && res.data) {
        Object.assign(flatData, flatten(res.data, '', {}));
      }
    });

    // 2. Helper to fuzzy-search keys in the extracted JSON
    function findVal(keywords) {
      for (const [key, val] of Object.entries(flatData)) {
        const lowerKey = key.toLowerCase();
        if (keywords.some(kw => lowerKey.includes(kw))) {
          return String(val);
        }
      }
      return '';
    }

    // 3. Map standard text & textarea inputs
    const textMappings = {
      'tenantName': ['name', 'full_name', 'tenant_name'],
      'tenantEmail': ['email', 'tenant_email'],
      'fatherName': ['father_name', 'husband_name', 'parent_name'],
      'fatherEmail': ['father_email', 'parent_email'],
      'motherName': ['mother_name'],
      'motherEmail': ['mother_email'],
      'permanentAddress': ['permanent_address'],
      'permanentPoliceStation': ['permanent_police_station', 'police_station'],
      'previousAddress': ['previous_address', 'temporary_address'],
      'previousPoliceStation': ['previous_police_station'],
      'guardianAddress': ['guardian_address', 'local_guardian_address'],
      'guardianPoliceStation': ['guardian_police_station'],
      'deptPost': ['department', 'post', 'dept'],
      'programClass': ['program', 'class', 'course'],
      'semesterYear': ['semester', 'year'],
      'institutionName': ['institution', 'school', 'college', 'office', 'university'],
      'stayMinimum': ['expected_stay', 'stay_minimum'],
      'rentAdvance': ['rent_advance', 'advance', 'one_month_rent'],
      'securityDeposit': ['security_deposit', 'deposit', 'refundable']
    };

    for (const [id, keys] of Object.entries(textMappings)) {
      const el = document.getElementById(id);
      if (el) {
        const extracted = findVal(keys);
        if (extracted) el.value = extracted;
      }
    }

    // 4. Map the complex Digit-Box fields
    const digitMappings = {
      'mobileNo': ['mobile_no', 'phone_number', 'contact', 'tenant_mobile'],
      'altMobileNo': ['alt_mobile', 'alternate', 'secondary_phone'],
      'dob': ['dob', 'date_of_birth', 'birth'],
      'idNumber': ['aadhar', 'aadhaar', 'voter', 'passport', 'id_number'],
      'fatherMobileAadhar': ['father_mobile', 'father_aadhar', 'father_aadhaar'],
      'motherMobileAadhar': ['mother_mobile', 'mother_aadhar', 'mother_aadhaar'],
      'permanentPin': ['permanent_pin', 'pin_code', 'pincode', 'zip'],
      'previousPin': ['previous_pin'],
      'guardianMobile1': ['guardian_mobile', 'local_guardian_mobile'],
      'guardianPin': ['guardian_pin'],
      'joiningDate': ['joining_date', 'date_of_joining'],
      'quitDate': ['quit_date', 'leave_date'],
      'rentStartDate': ['rent_start', 'start_date']
    };

    for (const [id, keys] of Object.entries(digitMappings)) {
      const container = document.getElementById(id);
      if (!container) continue;
      
      // Strip formatting (spaces, slashes) to push into the individual boxes
      let val = findVal(keys).replace(/[^a-zA-Z0-9]/g, ''); 
      if (!val) continue;

      const boxes = container.querySelectorAll('.digit-box:not(.is-prefix)');
      for (let i = 0; i < boxes.length && i < val.length; i++) {
        boxes[i].value = val[i];
      }
    }

    // 5. Map Marital Status Radio Buttons
    const marital = findVal(['marital', 'status']).toLowerCase();
    if (marital.includes('unmarried') || marital.includes('single')) {
      const r = document.querySelector('input[name="maritalStatus"][value="Unmarried"]');
      if (r) r.checked = true;
    } else if (marital.includes('married')) {
      const r = document.querySelector('input[name="maritalStatus"][value="Married"]');
      if (r) r.checked = true;
    }

    // 6. Map Triple Field (Room / Flat / Bed)
    const roomStr = findVal(['room', 'flat', 'bed']);
    if (roomStr) {
      // Splits the AI's string by spaces, slashes, or commas
      const parts = roomStr.split(/[\/, -]+/);
      if (parts[0]) document.getElementById('roomFlat').value = parts[0];
      if (parts[1]) document.getElementById('roomRoom').value = parts[1];
      if (parts[2]) document.getElementById('roomBed').value = parts[2];
    }
  }

  // ---- Export helpers ----
  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  document.getElementById('exportJson').addEventListener('click', () => {
    if (!parsedData) return;
    downloadBlob(JSON.stringify(parsedData, null, 2), 'document-data.json', 'application/json');
  });

  document.getElementById('exportCsv').addEventListener('click', () => {
    if (!parsedData) return;
    const rows = getRows();
    if (rows.length === 0) return;
    const columns = Object.keys(rows[0]);
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const csv = [
      columns.join(','),
      ...rows.map((r) => columns.map((c) => esc(r[c])).join(',')),
    ].join('\n');
    downloadBlob(csv, 'document-data.csv', 'text/csv');
  });

  document.getElementById('exportXlsx').addEventListener('click', () => {
    if (!parsedData || typeof XLSX === 'undefined') return;
    const rows = getRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parsed Data');
    XLSX.writeFile(wb, 'document-data.xlsx');
  });

  document.getElementById('exportPdf').addEventListener('click', () => {
    if (!parsedData || typeof window.jspdf === 'undefined') return;
    const rows = getRows();
    if (rows.length === 0) return;
    const columns = Object.keys(rows[0]);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(13);
    doc.text('Document Parse Result', 14, 16);
    const body = rows.map((r) => columns.map((c) => r[c]));

    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        head: [columns],
        body,
        startY: 22,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [44, 86, 151] },
      });
    } else {
      let y = 26;
      rows.forEach((r) => {
        doc.setFontSize(9);
        doc.text(columns.map((c) => `${c}: ${r[c]}`).join('   '), 14, y);
        y += 6;
      });
    }
    doc.save('document-data.pdf');
  });

  document.getElementById('copyJsonBtn').addEventListener('click', () => {
    if (!parsedData) return;
    navigator.clipboard.writeText(JSON.stringify(parsedData, null, 2));
    const btn = document.getElementById('copyJsonBtn');
    const original = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => (btn.textContent = original), 1600);
  });
})();