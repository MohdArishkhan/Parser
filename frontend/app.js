(function () {
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
  // Print / save as PDF
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

  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB — keep in sync with the server's MAX_UPLOAD_SIZE_BYTES

  function handleFiles(incoming) {
    if (!incoming || incoming.length === 0) return;

    const files = Array.from(incoming);
    const accepted = files.filter((f) => f.size <= MAX_FILE_SIZE);
    const tooLarge = files.filter((f) => f.size > MAX_FILE_SIZE);

    if (tooLarge.length > 0) {
      const names = tooLarge.map((f) => f.name).join(', ');
      alert(
        `${tooLarge.length === 1 ? 'This file exceeds' : 'These files exceed'} the 25 MB limit and ${tooLarge.length === 1 ? 'was' : 'were'} skipped: ${names}`
      );
    }

    if (accepted.length === 0) return;

    currentFiles = currentFiles.concat(accepted);
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

      // Auto-fill form fields cleanly
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
  // Auto-fill logic — schema-aware token matching
  // =========================================================

  function tokenize(path) {
    return path
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter(Boolean);
  }

  // Build a searchable index once per parse: [{ path, tokens, value }]
  function buildIndex(flatData) {
    return Object.entries(flatData)
      .filter(([, val]) => val !== '' && val !== null && val !== undefined && val !== '-')
      .map(([path, value]) => ({ path, tokens: tokenize(path), value: String(value) }));
  }

  // A rule matches an entry if every `include` token is present and no
  // `exclude` token is present among that entry's path tokens.
  function findByRules(index, rules) {
    for (const rule of rules) {
      const include = rule.include || [];
      const exclude = rule.exclude || [];
      const hit = index.find(
        (entry) =>
          include.every((tok) => entry.tokens.includes(tok)) &&
          !exclude.some((tok) => entry.tokens.includes(tok))
      );
      if (hit) return hit.value;
    }
    return '';
  }

  // Common exclusions so tenant-scoped rules never pick up a relative's
  // or guardian's data, and vice versa.
  const NOT_FATHER = ['father', 'husband'];
  const NOT_MOTHER = ['mother'];
  const NOT_GUARDIAN = ['guardian'];
  const NOT_TENANT_PEOPLE = [...NOT_FATHER, ...NOT_MOTHER, ...NOT_GUARDIAN, 'parent'];
  const NOT_ADDRESS_META = ['police', 'pin', 'station'];

  const RULES = {
    tenantName: [
      { include: ['tenant', 'name'] },
      { include: ['full', 'name'], exclude: NOT_TENANT_PEOPLE },
      { include: ['name'], exclude: [...NOT_TENANT_PEOPLE, 'institution', 'college', 'school', 'university', 'department'] },
    ],
    mobileNo: [
      { include: ['tenant', 'mobile'] },
      { include: ['mobile'], exclude: [...NOT_TENANT_PEOPLE, 'alt', 'alternate', 'secondary'] },
      { include: ['phone'], exclude: [...NOT_TENANT_PEOPLE, 'alt', 'alternate', 'secondary'] },
      { include: ['contact'], exclude: NOT_TENANT_PEOPLE },
    ],
    altMobileNo: [
      { include: ['alt', 'mobile'] },
      { include: ['alternate', 'mobile'] },
      { include: ['secondary', 'phone'] },
    ],
    tenantEmail: [
      { include: ['tenant', 'email'] },
      { include: ['email'], exclude: NOT_TENANT_PEOPLE },
    ],
    dob: [
      { include: ['dob', 'yob'] },
      { include: ['date', 'birth'] },
      { include: ['dob'] },
    ],
    idNumber: [
      { include: ['aadhaar', 'number'], exclude: NOT_TENANT_PEOPLE },
      { include: ['aadhar', 'number'], exclude: NOT_TENANT_PEOPLE },
      { include: ['aadhaar'], exclude: NOT_TENANT_PEOPLE },
      { include: ['aadhar'], exclude: NOT_TENANT_PEOPLE },
      { include: ['id', 'number'], exclude: NOT_TENANT_PEOPLE },
      { include: ['passport'], exclude: NOT_TENANT_PEOPLE },
      { include: ['voter'], exclude: NOT_TENANT_PEOPLE },
    ],
    fatherName: [
      { include: ['father', 'name'] },
      { include: ['husband', 'name'] },
    ],
    fatherMobileAadhar: [
      { include: ['father', 'mobile'] },
      { include: ['husband', 'mobile'] },
      { include: ['father', 'aadhaar'] },
      { include: ['father', 'aadhar'] },
    ],
    fatherEmail: [
      { include: ['father', 'email'] },
      { include: ['husband', 'email'] },
    ],
    motherName: [{ include: ['mother', 'name'] }],
    motherMobileAadhar: [
      { include: ['mother', 'mobile'] },
      { include: ['mother', 'aadhaar'] },
      { include: ['mother', 'aadhar'] },
    ],
    motherEmail: [{ include: ['mother', 'email'] }],
    permanentAddress: [
      { include: ['permanent', 'address'], exclude: NOT_ADDRESS_META },
      { include: ['address'], exclude: [...NOT_ADDRESS_META, 'previous', 'temporary', 'current', 'guardian', 'office', 'school', 'institution', 'college'] },
    ],
    permanentPoliceStation: [{ include: ['permanent', 'police'] }],
    permanentPin: [{ include: ['permanent', 'pin'] }],
    previousAddress: [
      { include: ['previous', 'address'], exclude: NOT_ADDRESS_META },
      { include: ['temporary', 'address'], exclude: NOT_ADDRESS_META },
      { include: ['current', 'address'], exclude: NOT_ADDRESS_META },
    ],
    previousPoliceStation: [{ include: ['previous', 'police'] }],
    previousPin: [{ include: ['previous', 'pin'] }],
    guardianAddress: [{ include: ['guardian', 'address'] }, { include: ['guardian', 'name'] }],
    guardianMobile1: [{ include: ['guardian', 'mobile'] }, { include: ['guardian', 'phone'] }],
    guardianMobile2: [
      { include: ['guardian', 'mobile', '2'] },
      { include: ['guardian', 'mobile2'] },
      { include: ['guardian', 'alternate'] },
    ],
    guardianPoliceStation: [{ include: ['guardian', 'police'] }],
    guardianPin: [{ include: ['guardian', 'pin'] }],
    deptPost: [{ include: ['department'] }, { include: ['post'] }, { include: ['designation'] }],
    programClass: [{ include: ['program'] }, { include: ['course'] }, { include: ['class'] }],
    semesterYear: [{ include: ['semester'] }, { include: ['year'], exclude: ['financial'] }],
    institutionName: [
      { include: ['institution'] },
      { include: ['college'] },
      { include: ['school'] },
      { include: ['university'] },
      { include: ['office'] },
    ],
    stayMinimum: [{ include: ['stay', 'minimum'] }, { include: ['expected', 'stay'] }],
    joiningDate: [{ include: ['joining', 'date'] }, { include: ['join', 'date'] }],
    quitDate: [{ include: ['quit', 'date'] }, { include: ['leaving', 'date'] }, { include: ['leave', 'date'] }],
    rentAdvance: [{ include: ['rent', 'advance'] }, { include: ['advance'], exclude: ['security'] }],
    securityDeposit: [{ include: ['security', 'deposit'] }, { include: ['deposit'] }],
    rentStartDate: [{ include: ['rent', 'start'] }, { include: ['start', 'date'], exclude: ['quit'] }],
  };

  // ---- Value cleanup & Sanitization helpers ----

  function cleanMobile(raw) {
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
      return digits.slice(2);
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return digits.slice(1);
    }
    return String(raw).trim();
  }

  function cleanDate(raw) {
    return String(raw).trim().replace(/\//g, '-');
  }

  // Converts currency strings like "Rs. 10,500/-" or "10,500" to "10500" for <input type="number">
  function cleanNumberInput(raw) {
    if (!raw) return '';
    const match = String(raw).replace(/,/g, '').match(/\d+(\.\d+)?/);
    return match ? match[0] : '';
  }

  // Converts DD-MM-YY or DD-MM-YYYY to YYYY-MM-DD for <input type="date">
  function formatDateInput(raw) {
    if (!raw) return '';
    let str = String(raw).trim().replace(/\//g, '-');
    const parts = str.split('-');
    if (parts.length === 3) {
      let [p1, p2, p3] = parts;
      if (p1.length <= 2 && p3.length >= 2) {
        let day = p1.padStart(2, '0');
        let month = p2.padStart(2, '0');
        let year = p3;
        if (year.length === 2) year = '20' + year;
        return `${year}-${month}-${day}`;
      }
      if (p1.length === 4) {
        return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
      }
    }
    return str;
  }

  // Fallback DOM lookup helper (checks ID first, then Name attribute)
  function getElement(id) {
    return document.getElementById(id) || document.getElementsByName(id)[0] || null;
  }

  const MOBILE_FIELDS = new Set([
    'mobileNo', 'altMobileNo', 'fatherMobileAadhar', 'motherMobileAadhar',
    'guardianMobile1', 'guardianMobile2',
  ]);
  const DATE_FIELDS = new Set(['dob', 'joiningDate', 'quitDate', 'rentStartDate']);

  // =========================================================
  // Source of Truth Auto-Fill Logic
  // =========================================================
  function autoFillForm(data) {
    if (!data || !Array.isArray(data.results)) return;

    let successfulFiles = data.results.filter((r) => r.status === 'success' && r.data);
    if (successfulFiles.length === 0) return;

    // Sort files so Aadhaar ALWAYS comes first (acting as Source of Truth over form errors)
    successfulFiles.sort((a, b) => {
      const typeA = (a.data?.detected_document_type || '').toLowerCase();
      const typeB = (b.data?.detected_document_type || '').toLowerCase();
      if (typeA === 'aadhaar' && typeB !== 'aadhaar') return -1;
      if (typeB === 'aadhaar' && typeA !== 'aadhaar') return 1;
      return 0;
    });

    const indexes = successfulFiles.map((r) => buildIndex(flatten(r.data, '', {})));

    function resolve(fieldId) {
      const rules = RULES[fieldId];
      if (!rules) return '';
      for (const index of indexes) {
        const val = findByRules(index, rules);
        if (val) return val.trim();
      }
      return '';
    }

    for (const id of Object.keys(RULES)) {
      const el = getElement(id);
      if (!el) {
        console.warn(`[AutoFill Warning] No HTML element found for rule key: "${id}" (checked both id and name attributes)`);
        continue;
      }

      let val = resolve(id);
      if (!val) continue;

      if (MOBILE_FIELDS.has(id)) val = cleanMobile(val);

      // Safe assignment based on element input type
      if (el.type === 'number') {
        val = cleanNumberInput(val);
      } else if (el.type === 'date') {
        val = formatDateInput(val);
      } else if (DATE_FIELDS.has(id)) {
        val = cleanDate(val);
      }

      // Check if this element is a container for digit boxes
      const digitBoxes = el.querySelectorAll ? el.querySelectorAll('.digit-box:not(.is-prefix)') : [];
      if (digitBoxes.length > 0) {
        let cleanDigits = val.replace(/[^a-zA-Z0-9]/g, '');
        for (let i = 0; i < digitBoxes.length && i < cleanDigits.length; i++) {
          digitBoxes[i].value = cleanDigits[i];
        }
      } else {
        el.value = val;
      }
    }

    // Handle "Same" in Previous Address
    const previousEl = getElement('previousAddress');
    if (previousEl && /^same$/i.test(previousEl.value.trim())) {
      const permanentEl = getElement('permanentAddress');
      if (permanentEl && permanentEl.value) previousEl.value = permanentEl.value;
    }

    // Marital Status Radio Buttons
    for (const index of indexes) {
      const marital = findByRules(index, [{ include: ['marital', 'status'] }, { include: ['marital'] }]).toLowerCase();
      if (!marital) continue;
      if (marital.includes('unmarried') || marital.includes('single')) {
        const r = document.querySelector('input[name="maritalStatus"][value="Unmarried"]');
        if (r) r.checked = true;
      } else if (marital.includes('married')) {
        const r = document.querySelector('input[name="maritalStatus"][value="Married"]');
        if (r) r.checked = true;
      }
      break;
    }

    // Room / Flat / Bed split field
    for (const index of indexes) {
      const roomStr = findByRules(index, [
        { include: ['room', 'no'] },
        { include: ['room', 'flat'] },
        { include: ['flat', 'room', 'bed'] },
      ]);
      if (!roomStr) continue;
      const parts = roomStr.split(/[/,-]+/).map((p) => p.trim()).filter(Boolean);
      const flatEl = getElement('roomFlat');
      const roomEl = getElement('roomRoom');
      const bedEl = getElement('roomBed');
      if (parts[0] && flatEl) flatEl.value = parts[0];
      if (parts[1] && roomEl) roomEl.value = parts[1];
      if (parts[2] && bedEl) bedEl.value = parts[2];
      break;
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