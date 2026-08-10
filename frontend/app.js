// (function () {
//   // =========================================================
//   // Digit-box fields (mobile numbers, dates, PIN codes, etc.)
//   // =========================================================
//   function buildDigitGroups() {
//     document.querySelectorAll('[data-digit-group]').forEach((container) => {
//       const prefix = container.dataset.prefix || '';
//       const segments = (container.dataset.segments || '')
//         .split(',')
//         .map((n) => parseInt(n, 10))
//         .filter((n) => !isNaN(n) && n > 0);
//       const separator = container.dataset.separator || '';
//       const editableBoxes = [];

//       prefix.split('').forEach((ch) => {
//         const input = document.createElement('input');
//         input.type = 'text';
//         input.className = 'digit-box is-prefix';
//         input.value = ch;
//         input.readOnly = true;
//         input.tabIndex = -1;
//         input.setAttribute('aria-hidden', 'true');
//         container.appendChild(input);
//       });

//       segments.forEach((segLen, segIdx) => {
//         for (let i = 0; i < segLen; i++) {
//           const input = document.createElement('input');
//           input.type = 'text';
//           input.inputMode = 'numeric';
//           input.autocomplete = 'off';
//           input.maxLength = 1;
//           input.className = 'digit-box';
//           container.appendChild(input);
//           editableBoxes.push(input);
//         }
//         if (separator && segIdx < segments.length - 1) {
//           const sep = document.createElement('span');
//           sep.className = 'digit-sep';
//           sep.textContent = separator;
//           sep.setAttribute('aria-hidden', 'true');
//           container.appendChild(sep);
//         }
//       });

//       editableBoxes.forEach((box, i) => {
//         box.addEventListener('input', () => {
//           box.value = box.value.replace(/[^0-9a-zA-Z]/g, '').slice(-1);
//           if (box.value && i < editableBoxes.length - 1) editableBoxes[i + 1].focus();
//         });
//         box.addEventListener('keydown', (e) => {
//           if (e.key === 'Backspace' && !box.value && i > 0) {
//             editableBoxes[i - 1].focus();
//           } else if (e.key === 'ArrowLeft' && i > 0) {
//             e.preventDefault();
//             editableBoxes[i - 1].focus();
//           } else if (e.key === 'ArrowRight' && i < editableBoxes.length - 1) {
//             e.preventDefault();
//             editableBoxes[i + 1].focus();
//           }
//         });
//         box.addEventListener('paste', (e) => {
//           const text = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9a-zA-Z]/g, '');
//           if (!text) return;
//           e.preventDefault();
//           for (let k = 0; k < text.length && i + k < editableBoxes.length; k++) {
//             editableBoxes[i + k].value = text[k];
//           }
//           editableBoxes[Math.min(i + text.length, editableBoxes.length - 1)].focus();
//         });
//       });
//     });
//   }
//   buildDigitGroups();

//   // =========================================================
//   // Tenant photo preview
//   // =========================================================
//   const photoInput = document.getElementById('photoInput');
//   const photoPreview = document.getElementById('photoPreview');
//   const photoPlaceholder = document.getElementById('photoPlaceholder');
//   if (photoInput) {
//     photoInput.addEventListener('change', () => {
//       const file = photoInput.files && photoInput.files[0];
//       if (!file) return;
//       const reader = new FileReader();
//       reader.onload = () => {
//         photoPreview.src = reader.result;
//         photoPreview.classList.remove('hidden');
//         photoPlaceholder.classList.add('hidden');
//       };
//       reader.readAsDataURL(file);
//     });
//   }

//   // =========================================================
//   // Print / save as PDF (uses the browser's native print dialog)
//   // =========================================================
//   const printFormBtn = document.getElementById('printFormBtn');
//   if (printFormBtn) {
//     printFormBtn.addEventListener('click', () => {
//       window.print();
//     });
//   }

//   // =========================================================
//   // Upload modal logic
//   // =========================================================
//   const openUploadBtn = document.getElementById('openUploadBtn');
//   const closeUploadBtn = document.getElementById('closeUploadBtn');
//   const uploadModal = document.getElementById('uploadModal');

//   function openModal() {
//     uploadModal.classList.remove('hidden');
//     document.body.style.overflow = 'hidden';
//     const firstFocusable = uploadModal.querySelector('#dropzone');
//     if (firstFocusable) firstFocusable.focus();
//   }
//   function closeModal() {
//     uploadModal.classList.add('hidden');
//     document.body.style.overflow = '';
//     openUploadBtn.focus();
//   }
//   if (openUploadBtn && uploadModal) {
//     openUploadBtn.addEventListener('click', openModal);
//     closeUploadBtn.addEventListener('click', closeModal);
//     uploadModal.addEventListener('click', (e) => {
//       if (e.target === uploadModal) closeModal();
//     });
//     document.addEventListener('keydown', (e) => {
//       if (e.key === 'Escape' && !uploadModal.classList.contains('hidden')) closeModal();
//     });
//   }

//   // =========================================================
//   // Workflow Variables
//   // =========================================================
//   const dropzone = document.getElementById('dropzone');
//   const fileInput = document.getElementById('fileInput');
//   const fileInfo = document.getElementById('fileInfo');
//   const fileCount = document.getElementById('fileCount');
//   const fileList = document.getElementById('fileList');
//   const clearFileBtn = document.getElementById('clearFileBtn');
//   const uploadForm = document.getElementById('uploadForm');
//   const submitBtn = document.getElementById('submitBtn');

//   const stepsEl = document.getElementById('steps');
//   const stepEls = {
//     upload: stepsEl.querySelector('[data-step="upload"]'),
//     parse: stepsEl.querySelector('[data-step="parse"]'),
//     export: stepsEl.querySelector('[data-step="export"]'),
//   };

//   const batchSummary = document.getElementById('batchSummary');
//   const emptyState = document.getElementById('emptyState');
//   const loadingState = document.getElementById('loadingState');
//   const errorState = document.getElementById('errorState');
//   const tableView = document.getElementById('tableView');
//   const tableHeadRow = document.getElementById('tableHeadRow');
//   const tableBody = document.getElementById('tableBody');
//   const jsonView = document.getElementById('jsonView');
//   const viewToggle = document.getElementById('viewToggle');
//   const exportRow = document.getElementById('exportRow');

//   let currentFiles = [];
//   let parsedData = null;
//   let currentView = 'table';

//   // ---- Step tracker ----
//   function setStep(name) {
//     const order = ['upload', 'parse', 'export'];
//     const idx = order.indexOf(name);
//     order.forEach((key, i) => {
//       stepEls[key].classList.remove('is-active', 'is-done');
//       if (i < idx) stepEls[key].classList.add('is-done');
//       if (i === idx) stepEls[key].classList.add('is-active');
//     });
//   }
//   setStep('upload');

//   // ---- Helpers ----
//   function formatBytes(bytes) {
//     if (!bytes) return '0 KB';
//     const kb = bytes / 1024;
//     if (kb < 1024) return `${kb.toFixed(1)} KB`;
//     return `${(kb / 1024).toFixed(1)} MB`;
//   }

//   function escapeHtml(str) {
//     return String(str).replace(/[&<>"']/g, (c) => ({
//       '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
//     }[c]));
//   }

//   // ---- File list ----
//   function renderFileList() {
//     fileList.innerHTML = '';

//     currentFiles.forEach((file, i) => {
//       const li = document.createElement('li');
//       li.className = 'file-item';

//       let thumbHtml;
//       if (file.type.startsWith('image/')) {
//         thumbHtml = `<img class="file-thumb" src="${URL.createObjectURL(file)}" alt="">`;
//       } else {
//         const ext = (file.name.split('.').pop() || '?').toUpperCase().slice(0, 4);
//         thumbHtml = `<span class="file-badge">${escapeHtml(ext)}</span>`;
//       }

//       li.innerHTML = `
//         ${thumbHtml}
//         <div class="file-meta">
//           <p class="file-name">${escapeHtml(file.name)}</p>
//           <p class="file-size">${formatBytes(file.size)}</p>
//         </div>
//         <button type="button" class="file-remove" data-index="${i}" aria-label="Remove ${escapeHtml(file.name)}">&times;</button>
//       `;
//       fileList.appendChild(li);
//     });

//     fileCount.textContent = currentFiles.length === 1
//       ? '1 file selected'
//       : `${currentFiles.length} files selected`;
//   }

//   function handleFiles(incoming) {
//     if (!incoming || incoming.length === 0) return;
//     currentFiles = currentFiles.concat(Array.from(incoming));
//     fileInfo.classList.remove('hidden');
//     renderFileList();
//     submitBtn.disabled = false;
//     fileInput.value = '';
//   }

//   fileList.addEventListener('click', (e) => {
//     const btn = e.target.closest('.file-remove');
//     if (!btn) return;
//     const idx = Number(btn.dataset.index);
//     currentFiles.splice(idx, 1);
//     if (currentFiles.length === 0) {
//       fileInfo.classList.add('hidden');
//       submitBtn.disabled = true;
//     } else {
//       renderFileList();
//     }
//   });

//   fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

//   dropzone.addEventListener('click', () => fileInput.click());
//   dropzone.addEventListener('keydown', (e) => {
//     if (e.key === 'Enter' || e.key === ' ') {
//       e.preventDefault();
//       fileInput.click();
//     }
//   });

//   ['dragenter', 'dragover'].forEach((evt) =>
//     dropzone.addEventListener(evt, (e) => {
//       e.preventDefault();
//       dropzone.classList.add('is-dragover');
//     })
//   );
//   ['dragleave', 'drop'].forEach((evt) =>
//     dropzone.addEventListener(evt, (e) => {
//       e.preventDefault();
//       dropzone.classList.remove('is-dragover');
//     })
//   );
//   dropzone.addEventListener('drop', (e) => {
//     handleFiles(e.dataTransfer.files);
//   });

//   clearFileBtn.addEventListener('click', () => {
//     currentFiles = [];
//     fileInput.value = '';
//     fileInfo.classList.add('hidden');
//     submitBtn.disabled = true;
//   });

//   // ---- Result panel states ----
//   function showState(state) {
//     emptyState.classList.add('hidden');
//     loadingState.classList.add('hidden');
//     errorState.classList.add('hidden');
//     tableView.classList.add('hidden');
//     jsonView.classList.add('hidden');
//     exportRow.hidden = true;
//     if (state !== 'result') batchSummary.classList.add('hidden');

//     if (state === 'empty') emptyState.classList.remove('hidden');
//     if (state === 'loading') loadingState.classList.remove('hidden');
//     if (state === 'error') errorState.classList.remove('hidden');
//     if (state === 'result') {
//       exportRow.hidden = false;
//       if (currentView === 'table') tableView.classList.remove('hidden');
//       else jsonView.classList.remove('hidden');
//     }
//   }
//   showState('empty');

//   viewToggle.addEventListener('click', (e) => {
//     const btn = e.target.closest('.toggle-btn');
//     if (!btn) return;
//     currentView = btn.dataset.view;
//     [...viewToggle.querySelectorAll('.toggle-btn')].forEach((b) => {
//       b.classList.toggle('is-active', b === btn);
//       b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
//     });
//     if (parsedData !== null) showState('result');
//   });

//   // ---- Parse (batch) ----
//   uploadForm.addEventListener('submit', async (e) => {
//     e.preventDefault();
//     if (currentFiles.length === 0) return;

//     const formData = new FormData();
//     currentFiles.forEach((file) => formData.append('files', file));

//     submitBtn.disabled = true;
//     setStep('parse');
//     showState('loading');

//     try {
//       const response = await fetch('/parse-batch', { method: 'POST', body: formData });
//       if (!response.ok) {
//         throw new Error(`Server responded with status ${response.status}`);
//       }
//       const result = await response.json();
//       parsedData = result;
//       jsonView.textContent = JSON.stringify(result, null, 2);
//       renderBatchSummary();
//       renderTable();
//       showState('result');
//       setStep('export');

//       // 💥 NEW: Trigger Form Auto-Fill when parsing finishes
//       autoFillForm(parsedData);

//     } catch (err) {
//       errorState.textContent = `Could not parse this batch. ${err.message}`;
//       showState('error');
//       setStep('upload');
//     } finally {
//       submitBtn.disabled = currentFiles.length === 0;
//     }
//   });

//   function renderBatchSummary() {
//     if (!parsedData || !Array.isArray(parsedData.results)) {
//       batchSummary.classList.add('hidden');
//       return;
//     }
//     const total = parsedData.results.length;
//     const successCount = parsedData.results.filter((r) => r.status === 'success').length;
//     const errorCount = total - successCount;

//     batchSummary.textContent = errorCount > 0
//       ? `${successCount} of ${total} files parsed successfully — ${errorCount} failed`
//       : `${total} of ${total} files parsed successfully`;
//     batchSummary.classList.toggle('has-errors', errorCount > 0);
//     batchSummary.classList.remove('hidden');
//   }

//   // ---- Flatten nested JSON into Field / Value rows ----
//   function flatten(value, prefix, res) {
//     res = res || {};
//     if (value === null || value === undefined) {
//       res[prefix || 'value'] = '';
//       return res;
//     }
//     if (Array.isArray(value)) {
//       if (value.length === 0) {
//         res[prefix || 'value'] = '[]';
//         return res;
//       }
//       value.forEach((item, i) => flatten(item, prefix ? `${prefix}[${i}]` : `[${i}]`, res));
//       return res;
//     }
//     if (typeof value === 'object') {
//       const keys = Object.keys(value);
//       if (keys.length === 0) {
//         res[prefix || 'value'] = '{}';
//         return res;
//       }
//       keys.forEach((k) => flatten(value[k], prefix ? `${prefix}.${k}` : k, res));
//       return res;
//     }
//     res[prefix || 'value'] = value;
//     return res;
//   }

//   function getRows() {
//     if (parsedData && Array.isArray(parsedData.results)) {
//       const rows = [];
//       parsedData.results.forEach((r) => {
//         const label = r.file_name || 'Unnamed file';
//         if (r.status === 'success') {
//           const flat = flatten(r.data, '', {});
//           const entries = Object.entries(flat);
//           if (entries.length === 0) {
//             rows.push({ File: label, Field: '(no fields found)', Value: '' });
//           } else {
//             entries.forEach(([field, val]) => {
//               rows.push({ File: label, Field: field, Value: String(val) });
//             });
//           }
//         } else {
//           rows.push({ File: label, Field: 'error', Value: String(r.error || 'Unknown error') });
//         }
//       });
//       return rows;
//     }

//     const flat = flatten(parsedData, '', {});
//     return Object.entries(flat).map(([field, val]) => ({ Field: field, Value: String(val) }));
//   }

//   function renderTable() {
//     const rows = getRows();
//     const columns = rows.length > 0 ? Object.keys(rows[0]) : ['Field', 'Value'];

//     tableHeadRow.innerHTML = '';
//     columns.forEach((col) => {
//       const th = document.createElement('th');
//       th.textContent = col;
//       th.className = `col-${col.toLowerCase()}`;
//       tableHeadRow.appendChild(th);
//     });

//     tableBody.innerHTML = '';
//     rows.forEach((row) => {
//       const tr = document.createElement('tr');
//       if (row.Field === 'error') tr.classList.add('is-error-row');
//       columns.forEach((col) => {
//         const td = document.createElement('td');
//         td.textContent = row[col];
//         td.className = `col-${col.toLowerCase()}`;
//         tr.appendChild(td);
//       });
//       tableBody.appendChild(tr);
//     });
//   }

//   // =========================================================
//   // 💥 NEW: Auto-Fill Form Logic
//   // Matches extracted JSON to your HTML inputs perfectly
//   // =========================================================
//   function autoFillForm(data) {
//     if (!data || !Array.isArray(data.results)) return;

//     // 1. Combine all extracted data from the batch into one flat dictionary
//     let flatData = {};
//     data.results.forEach(res => {
//       if (res.status === 'success' && res.data) {
//         Object.assign(flatData, flatten(res.data, '', {}));
//       }
//     });

//     // 2. Helper to fuzzy-search keys in the extracted JSON
//     function findVal(keywords) {
//       for (const [key, val] of Object.entries(flatData)) {
//         const lowerKey = key.toLowerCase();
//         if (keywords.some(kw => lowerKey.includes(kw))) {
//           return String(val);
//         }
//       }
//       return '';
//     }

//     // 3. Map standard text & textarea inputs
//     const textMappings = {
//       'tenantName': ['name', 'full_name', 'tenant_name'],
//       'tenantEmail': ['email', 'tenant_email'],
//       'fatherName': ['father_name', 'husband_name', 'parent_name'],
//       'fatherEmail': ['father_email', 'parent_email'],
//       'motherName': ['mother_name'],
//       'motherEmail': ['mother_email'],
//       'permanentAddress': ['permanent_address'],
//       'permanentPoliceStation': ['permanent_police_station', 'police_station'],
//       'previousAddress': ['previous_address', 'temporary_address'],
//       'previousPoliceStation': ['previous_police_station'],
//       'guardianAddress': ['guardian_address', 'local_guardian_address'],
//       'guardianPoliceStation': ['guardian_police_station'],
//       'deptPost': ['department', 'post', 'dept'],
//       'programClass': ['program', 'class', 'course'],
//       'semesterYear': ['semester', 'year'],
//       'institutionName': ['institution', 'school', 'college', 'office', 'university'],
//       'stayMinimum': ['expected_stay', 'stay_minimum'],
//       'rentAdvance': ['rent_advance', 'advance', 'one_month_rent'],
//       'securityDeposit': ['security_deposit', 'deposit', 'refundable']
//     };

//     for (const [id, keys] of Object.entries(textMappings)) {
//       const el = document.getElementById(id);
//       if (el) {
//         const extracted = findVal(keys);
//         if (extracted) el.value = extracted;
//       }
//     }

//     // 4. Map the complex Digit-Box fields
//     const digitMappings = {
//       'mobileNo': ['mobile_no', 'phone_number', 'contact', 'tenant_mobile'],
//       'altMobileNo': ['alt_mobile', 'alternate', 'secondary_phone'],
//       'dob': ['dob', 'date_of_birth', 'birth'],
//       'idNumber': ['aadhar', 'aadhaar', 'voter', 'passport', 'id_number'],
//       'fatherMobileAadhar': ['father_mobile', 'father_aadhar', 'father_aadhaar'],
//       'motherMobileAadhar': ['mother_mobile', 'mother_aadhar', 'mother_aadhaar'],
//       'permanentPin': ['permanent_pin', 'pin_code', 'pincode', 'zip'],
//       'previousPin': ['previous_pin'],
//       'guardianMobile1': ['guardian_mobile', 'local_guardian_mobile'],
//       'guardianPin': ['guardian_pin'],
//       'joiningDate': ['joining_date', 'date_of_joining'],
//       'quitDate': ['quit_date', 'leave_date'],
//       'rentStartDate': ['rent_start', 'start_date']
//     };

//     for (const [id, keys] of Object.entries(digitMappings)) {
//       const container = document.getElementById(id);
//       if (!container) continue;
      
//       // Strip formatting (spaces, slashes) to push into the individual boxes
//       let val = findVal(keys).replace(/[^a-zA-Z0-9]/g, ''); 
//       if (!val) continue;

//       const boxes = container.querySelectorAll('.digit-box:not(.is-prefix)');
//       for (let i = 0; i < boxes.length && i < val.length; i++) {
//         boxes[i].value = val[i];
//       }
//     }

//     // 5. Map Marital Status Radio Buttons
//     const marital = findVal(['marital', 'status']).toLowerCase();
//     if (marital.includes('unmarried') || marital.includes('single')) {
//       const r = document.querySelector('input[name="maritalStatus"][value="Unmarried"]');
//       if (r) r.checked = true;
//     } else if (marital.includes('married')) {
//       const r = document.querySelector('input[name="maritalStatus"][value="Married"]');
//       if (r) r.checked = true;
//     }

//     // 6. Map Triple Field (Room / Flat / Bed)
//     const roomStr = findVal(['room', 'flat', 'bed']);
//     if (roomStr) {
//       // Splits the AI's string by spaces, slashes, or commas
//       const parts = roomStr.split(/[\/, -]+/);
//       if (parts[0]) document.getElementById('roomFlat').value = parts[0];
//       if (parts[1]) document.getElementById('roomRoom').value = parts[1];
//       if (parts[2]) document.getElementById('roomBed').value = parts[2];
//     }
//   }

//   // ---- Export helpers ----
//   function downloadBlob(content, filename, type) {
//     const blob = new Blob([content], { type });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = filename;
//     document.body.appendChild(a);
//     a.click();
//     a.remove();
//     URL.revokeObjectURL(url);
//   }

//   document.getElementById('exportJson').addEventListener('click', () => {
//     if (!parsedData) return;
//     downloadBlob(JSON.stringify(parsedData, null, 2), 'document-data.json', 'application/json');
//   });

//   document.getElementById('exportCsv').addEventListener('click', () => {
//     if (!parsedData) return;
//     const rows = getRows();
//     if (rows.length === 0) return;
//     const columns = Object.keys(rows[0]);
//     const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
//     const csv = [
//       columns.join(','),
//       ...rows.map((r) => columns.map((c) => esc(r[c])).join(',')),
//     ].join('\n');
//     downloadBlob(csv, 'document-data.csv', 'text/csv');
//   });

//   document.getElementById('exportXlsx').addEventListener('click', () => {
//     if (!parsedData || typeof XLSX === 'undefined') return;
//     const rows = getRows();
//     const ws = XLSX.utils.json_to_sheet(rows);
//     const wb = XLSX.utils.book_new();
//     XLSX.utils.book_append_sheet(wb, ws, 'Parsed Data');
//     XLSX.writeFile(wb, 'document-data.xlsx');
//   });

//   document.getElementById('exportPdf').addEventListener('click', () => {
//     if (!parsedData || typeof window.jspdf === 'undefined') return;
//     const rows = getRows();
//     if (rows.length === 0) return;
//     const columns = Object.keys(rows[0]);

//     const { jsPDF } = window.jspdf;
//     const doc = new jsPDF();
//     doc.setFontSize(13);
//     doc.text('Document Parse Result', 14, 16);
//     const body = rows.map((r) => columns.map((c) => r[c]));

//     if (typeof doc.autoTable === 'function') {
//       doc.autoTable({
//         head: [columns],
//         body,
//         startY: 22,
//         styles: { fontSize: 9, cellPadding: 3 },
//         headStyles: { fillColor: [44, 86, 151] },
//       });
//     } else {
//       let y = 26;
//       rows.forEach((r) => {
//         doc.setFontSize(9);
//         doc.text(columns.map((c) => `${c}: ${r[c]}`).join('   '), 14, y);
//         y += 6;
//       });
//     }
//     doc.save('document-data.pdf');
//   });

//   document.getElementById('copyJsonBtn').addEventListener('click', () => {
//     if (!parsedData) return;
//     navigator.clipboard.writeText(JSON.stringify(parsedData, null, 2));
//     const btn = document.getElementById('copyJsonBtn');
//     const original = btn.textContent;
//     btn.textContent = 'Copied';
//     setTimeout(() => (btn.textContent = original), 1600);
//   });
// })();



// ----------------------------------------------------------

// ----------------------------------------------------------

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
  //
  // The old version matched fields by a plain substring test on the
  // flattened key ("name" would match the *first* key anywhere that
  // contained "name" — which could just as easily be
  // parent_details.father_husband_name as tenant_details.name). That
  // silently cross-wired tenant / father / mother / guardian data.
  //
  // This version tokenizes each flattened key path (splitting on ".",
  // "_", "[", "]") and matches whole tokens, with each form field
  // trying an ordered list of rules from most specific to least. Every
  // rule can also *exclude* tokens that belong to a different person/
  // section, so "name" can never resolve to the father's name when
  // filling the tenant's name field, and vice versa.

  function tokenize(path) {
    return path
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter(Boolean);
  }

  // Build a searchable index once per parse: [{ path, tokens, value }]
  function buildIndex(flatData) {
    return Object.entries(flatData)
      .filter(([, val]) => val !== '' && val !== null && val !== undefined)
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

  // const RULES = {
  //   tenantName: [
  //     { include: ['tenant', 'name'] },
  //     { include: ['name'], exclude: [...NOT_TENANT_PEOPLE, 'institution', 'college', 'school', 'university', 'department'] },
  //   ],
  //   mobileNo: [
  //     { include: ['tenant', 'mobile'] },
  //     { include: ['mobile'], exclude: [...NOT_TENANT_PEOPLE, 'alt', 'alternate', 'secondary'] },
  //     { include: ['phone'], exclude: [...NOT_TENANT_PEOPLE, 'alt', 'alternate', 'secondary'] },
  //     { include: ['contact'], exclude: NOT_TENANT_PEOPLE },
  //   ],
  //   altMobileNo: [
  //     { include: ['alt', 'mobile'] },
  //     { include: ['alternate', 'mobile'] },
  //     { include: ['secondary', 'phone'] },
  //   ],
  //   tenantEmail: [
  //     { include: ['tenant', 'email'] },
  //     { include: ['email'], exclude: NOT_TENANT_PEOPLE },
  //   ],
  //   dob: [
  //     { include: ['date', 'birth'] },
  //     { include: ['dob'] },
  //   ],
  //   idNumber: [
  //     { include: ['aadhaar', 'voter'], exclude: NOT_TENANT_PEOPLE },
  //     { include: ['aadhar', 'voter'], exclude: NOT_TENANT_PEOPLE },
  //     { include: ['id', 'number'], exclude: NOT_TENANT_PEOPLE },
  //     { include: ['passport'], exclude: NOT_TENANT_PEOPLE },
  //     { include: ['voter'], exclude: NOT_TENANT_PEOPLE },
  //     { include: ['aadhaar'], exclude: NOT_TENANT_PEOPLE },
  //     { include: ['aadhar'], exclude: NOT_TENANT_PEOPLE },
  //   ],
  //   fatherName: [
  //     { include: ['father', 'name'] },
  //     { include: ['husband', 'name'] },
  //   ],
  //   fatherMobileAadhar: [
  //     { include: ['father', 'mobile'] },
  //     { include: ['husband', 'mobile'] },
  //     { include: ['father', 'aadhaar'] },
  //     { include: ['father', 'aadhar'] },
  //   ],
  //   fatherEmail: [
  //     { include: ['father', 'email'] },
  //     { include: ['husband', 'email'] },
  //   ],
  //   motherName: [{ include: ['mother', 'name'] }],
  //   motherMobileAadhar: [
  //     { include: ['mother', 'mobile'] },
  //     { include: ['mother', 'aadhaar'] },
  //     { include: ['mother', 'aadhar'] },
  //   ],
  //   motherEmail: [{ include: ['mother', 'email'] }],
  //   permanentAddress: [
  //     { include: ['permanent', 'address'], exclude: NOT_ADDRESS_META },
  //   ],
  //   permanentPoliceStation: [{ include: ['permanent', 'police'] }],
  //   permanentPin: [{ include: ['permanent', 'pin'] }],
  //   previousAddress: [
  //     { include: ['previous', 'address'], exclude: NOT_ADDRESS_META },
  //     { include: ['temporary', 'address'], exclude: NOT_ADDRESS_META },
  //     { include: ['current', 'address'], exclude: NOT_ADDRESS_META },
  //   ],
  //   previousPoliceStation: [{ include: ['previous', 'police'] }],
  //   previousPin: [{ include: ['previous', 'pin'] }],
  //   guardianAddress: [{ include: ['guardian', 'address'] }],
  //   guardianMobile1: [{ include: ['guardian', 'mobile'] }, { include: ['guardian', 'phone'] }],
  //   guardianMobile2: [
  //     { include: ['guardian', 'mobile', '2'] },
  //     { include: ['guardian', 'mobile2'] },
  //     { include: ['guardian', 'alternate'] },
  //   ],
  //   guardianPoliceStation: [{ include: ['guardian', 'police'] }],
  //   guardianPin: [{ include: ['guardian', 'pin'] }],
  //   deptPost: [{ include: ['department'] }, { include: ['post'] }, { include: ['designation'] }],
  //   programClass: [{ include: ['program'] }, { include: ['course'] }, { include: ['class'] }],
  //   semesterYear: [{ include: ['semester'] }, { include: ['year'], exclude: ['financial'] }],
  //   institutionName: [
  //     { include: ['institution'] },
  //     { include: ['college'] },
  //     { include: ['school'] },
  //     { include: ['university'] },
  //     { include: ['office'] },
  //   ],
  //   stayMinimum: [{ include: ['stay', 'minimum'] }, { include: ['expected', 'stay'] }],
  //   joiningDate: [{ include: ['joining', 'date'] }, { include: ['join', 'date'] }],
  //   quitDate: [{ include: ['quit', 'date'] }, { include: ['leaving', 'date'] }, { include: ['leave', 'date'] }],
  //   rentAdvance: [{ include: ['rent', 'advance'] }, { include: ['advance'], exclude: ['security'] }],
  //   securityDeposit: [{ include: ['security', 'deposit'] }, { include: ['deposit'] }],
  //   rentStartDate: [{ include: ['rent', 'start'] }, { include: ['start', 'date'], exclude: ['quit'] }],
  // };

  // // ---- Value cleanup helpers ----

  // // Extracted Indian mobile numbers often carry the "91" country code
  // // glued to the front (e.g. "916398378752"). The form wants a plain
  // // 10-digit number, so strip a leading "91" when the remainder looks
  // // like a real mobile number.
  // function cleanMobile(raw) {
  //   const digits = String(raw).replace(/\D/g, '');
  //   if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
  //     return digits.slice(2);
  //   }
  //   if (digits.length === 11 && digits.startsWith('0')) {
  //     return digits.slice(1);
  //   }
  //   return String(raw).trim();
  // }

  // function cleanDate(raw) {
  //   return String(raw).trim().replace(/\//g, '-');
  // }

  // const MOBILE_FIELDS = new Set([
  //   'mobileNo', 'altMobileNo', 'fatherMobileAadhar', 'motherMobileAadhar',
  //   'guardianMobile1', 'guardianMobile2',
  // ]);
  // const DATE_FIELDS = new Set(['dob', 'joiningDate', 'quitDate', 'rentStartDate']);

  // function autoFillForm(data) {
  //   if (!data || !Array.isArray(data.results)) return;

  //   const successfulFiles = data.results.filter((r) => r.status === 'success' && r.data);
  //   if (successfulFiles.length === 0) return;

  //   // Build one index per file, then fill each field from the first
  //   // file that actually has a match — instead of merging every file
  //   // into one dictionary (where a later file with a blank field would
  //   // silently overwrite a good value already found in an earlier one).
  //   const indexes = successfulFiles.map((r) => buildIndex(flatten(r.data, '', {})));

  //   function resolve(fieldId) {
  //     const rules = RULES[fieldId];
  //     if (!rules) return '';
  //     for (const index of indexes) {
  //       const val = findByRules(index, rules);
  //       if (val) return val.trim();
  //     }
  //     return '';
  //   }

  //   for (const id of Object.keys(RULES)) {
  //     const el = document.getElementById(id);
  //     if (!el) continue;
  //     let val = resolve(id);
  //     if (!val) continue;
  //     if (MOBILE_FIELDS.has(id)) val = cleanMobile(val);
  //     if (DATE_FIELDS.has(id)) val = cleanDate(val);
  //     el.value = val;
  //   }

  //   // "Previous address" is very often written as "Same" on the source
  //   // form, meaning "same as permanent address" — fill in the real
  //   // address rather than the literal word "Same".
  //   const previousEl = document.getElementById('previousAddress');
  //   if (previousEl && /^same$/i.test(previousEl.value.trim())) {
  //     const permanentEl = document.getElementById('permanentAddress');
  //     if (permanentEl && permanentEl.value) previousEl.value = permanentEl.value;
  //   }

  //   // Marital status → radio buttons
  //   for (const index of indexes) {
  //     const marital = findByRules(index, [{ include: ['marital', 'status'] }, { include: ['marital'] }]).toLowerCase();
  //     if (!marital) continue;
  //     if (marital.includes('unmarried') || marital.includes('single')) {
  //       const r = document.querySelector('input[name="maritalStatus"][value="Unmarried"]');
  //       if (r) r.checked = true;
  //     } else if (marital.includes('married')) {
  //       const r = document.querySelector('input[name="maritalStatus"][value="Married"]');
  //       if (r) r.checked = true;
  //     }
  //     break;
  //   }

  //   // Room / Flat / Bed → split triple field
  //   for (const index of indexes) {
  //     const roomStr = findByRules(index, [
  //       { include: ['room', 'no'] },
  //       { include: ['room', 'flat'] },
  //       { include: ['flat', 'room', 'bed'] },
  //     ]);
  //     if (!roomStr) continue;
  //     const parts = roomStr.split(/[/,-]+/).map((p) => p.trim()).filter(Boolean);
  //     if (parts[0]) document.getElementById('roomFlat').value = parts[0];
  //     if (parts[1]) document.getElementById('roomRoom').value = parts[1];
  //     if (parts[2]) document.getElementById('roomBed').value = parts[2];
  //     break;
  //   }
  // }
// --- Updated Rules to better catch Aadhaar fields ---
  const RULES = {
    tenantName: [
      { include: ['tenant', 'name'] },
      { include: ['full', 'name'], exclude: NOT_TENANT_PEOPLE }, // Catches Aadhaar "Full Name"
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
      { include: ['dob', 'yob'] }, // Catches Aadhaar "DOB_YOB"
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
      // Catches Aadhaar's generic "Address" field safely
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

  // ---- Value cleanup helpers ----
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

  const MOBILE_FIELDS = new Set([
    'mobileNo', 'altMobileNo', 'fatherMobileAadhar', 'motherMobileAadhar',
    'guardianMobile1', 'guardianMobile2',
  ]);
  const DATE_FIELDS = new Set(['dob', 'joiningDate', 'quitDate', 'rentStartDate']);

  // =========================================================
  // 💥 NEW: Source of Truth Auto-Fill Logic
  // =========================================================
  function autoFillForm(data) {
    if (!data || !Array.isArray(data.results)) return;

    let successfulFiles = data.results.filter((r) => r.status === 'success' && r.data);
    if (successfulFiles.length === 0) return;

    // 💥 THE OVERRIDE LOGIC: Sort files so Aadhaar ALWAYS comes first.
    // Because the form fills based on the first data it finds, this forces 
    // Aadhaar data to overwrite any handwriting mistakes on the form!
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
      const el = document.getElementById(id);
      if (!el) continue;
      let val = resolve(id);
      if (!val) continue;
      if (MOBILE_FIELDS.has(id)) val = cleanMobile(val);
      if (DATE_FIELDS.has(id)) val = cleanDate(val);
      el.value = val;
    }

    const previousEl = document.getElementById('previousAddress');
    if (previousEl && /^same$/i.test(previousEl.value.trim())) {
      const permanentEl = document.getElementById('permanentAddress');
      if (permanentEl && permanentEl.value) previousEl.value = permanentEl.value;
    }

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

    for (const index of indexes) {
      const roomStr = findByRules(index, [
        { include: ['room', 'no'] },
        { include: ['room', 'flat'] },
        { include: ['flat', 'room', 'bed'] },
      ]);
      if (!roomStr) continue;
      const parts = roomStr.split(/[/,-]+/).map((p) => p.trim()).filter(Boolean);
      if (parts[0]) document.getElementById('roomFlat').value = parts[0];
      if (parts[1]) document.getElementById('roomRoom').value = parts[1];
      if (parts[2]) document.getElementById('roomBed').value = parts[2];
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