/* ---- IndexedDB persistence ---- */

var DB_NAME = 'bassa-fotodoku';
var DB_VERSION = 2;
var db = null;

function openDB() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function(e) {
      var d = e.target.result;
      if (!d.objectStoreNames.contains('images')) {
        d.createObjectStore('images', { keyPath: 'id', autoIncrement: true });
      }
      if (!d.objectStoreNames.contains('settings')) {
        d.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = function(e) { db = e.target.result; resolve(db); };
    req.onerror = function(e) { console.error('DB open error', e); reject(e); };
  });
}

function dbPut(store, data) {
  return new Promise(function(resolve, reject) {
    if (!db) { resolve(); return; }
    var tx = db.transaction(store, 'readwrite');
    var s = tx.objectStore(store);
    s.put(data);
    tx.oncomplete = function() { resolve(); };
    tx.onerror = function(e) { reject(e); };
  });
}

function dbGetAll(store) {
  return new Promise(function(resolve, reject) {
    if (!db) { resolve([]); return; }
    var tx = db.transaction(store, 'readonly');
    var s = tx.objectStore(store);
    var req = s.getAll();
    req.onsuccess = function() { resolve(req.result || []); };
    req.onerror = function(e) { reject(e); };
  });
}

function dbGet(store, key) {
  return new Promise(function(resolve, reject) {
    if (!db) { resolve(null); return; }
    var tx = db.transaction(store, 'readonly');
    var s = tx.objectStore(store);
    var req = s.get(key);
    req.onsuccess = function() { resolve(req.result || null); };
    req.onerror = function(e) { reject(e); };
  });
}

function dbClearStore(store) {
  return new Promise(function(resolve, reject) {
    if (!db) { resolve(); return; }
    var tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = function() { resolve(); };
    tx.onerror = function(e) { reject(e); };
  });
}

function saveSettings() {
  if (!db) return;
  dbPut('settings', {
    key: 'form',
    docTitle: docTitle.value,
    customerName: customerName.value,
    objectName: objectName.value,
    docDate: docDate.value,
    layoutMode: layoutMode.value
  });
}

function saveImages() {
  if (!db) return;
  dbClearStore('images').then(function() {
    images.forEach(function(img) {
      dbPut('images', { name: img.name, src: img.src, caption: img.caption || '' });
    });
  });
}

async function loadSavedData() {
  try {
    await openDB();
    var settings = await dbGet('settings', 'form');
    if (settings) {
      docTitle.value = settings.docTitle || 'FOTODOKUMENTATION';
      customerName.value = settings.customerName || '';
      objectName.value = settings.objectName || '';
      docDate.value = settings.docDate || '';
      layoutMode.value = settings.layoutMode || 'grid';
    }
    var savedImages = await dbGetAll('images');
    if (savedImages && savedImages.length > 0) {
      images = savedImages.map(function(row) {
        return { name: row.name, src: row.src, caption: row.caption || '' };
      });
    }
  } catch (e) {
    console.error('Failed to load saved data:', e);
  }
  render();
}

/* ---- Iframe detection: hide topbar when embedded ---- */
if (window !== window.top) {
  var topbarEl = document.getElementById('fotodokuTopbar');
  if (topbarEl) topbarEl.style.display = 'none';

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.action) return;
    if (e.data.action === 'pickImages') {
      document.getElementById('fileInput').click();
    } else if (e.data.action === 'exportPdf') {
      saveAsPdf();
    }
  });
}

/* ---- DOM references ---- */

var fileInput = document.getElementById('fileInput');
var pickBtn = document.getElementById('pickBtn');
var pdfBtn = document.getElementById('pdfBtn');
var clearBtn = document.getElementById('clearBtn');
var docTitle = document.getElementById('docTitle');
var customerName = document.getElementById('customerName');
var objectName = document.getElementById('objectName');
var docDate = document.getElementById('docDate');
var layoutMode = document.getElementById('layoutMode');

if (typeof BassaDatepicker !== 'undefined') {
  new BassaDatepicker(docDate, { defaultToday: true });
}
var dragOverlay = document.getElementById('dragOverlay');
var thumbbar = document.getElementById('thumbbar');
var pages = document.getElementById('pages');

var images = [];
var deletedGridPages = new Set();

/* ---- Event listeners ---- */

pickBtn.addEventListener('click', function() { fileInput.click(); });
fileInput.addEventListener('change', function(e) {
  addFiles(e.target.files);
  fileInput.value = '';
});
pdfBtn.addEventListener('click', function() { saveAsPdf(); });

var pickBtnTop = document.getElementById('pickBtnTop');
var pdfBtnTop = document.getElementById('pdfBtnTop');
if (pickBtnTop) pickBtnTop.addEventListener('click', function() { fileInput.click(); });
if (pdfBtnTop) pdfBtnTop.addEventListener('click', function() { saveAsPdf(); });

clearBtn.addEventListener('click', function() {
  if (!window.confirm('Wirklich ALLE Daten und Bilder löschen? Dieser Schritt kann nicht rückgängig gemacht werden.')) return;

  images = [];
  deletedGridPages = new Set();
  docTitle.value = 'FOTODOKUMENTATION';
  customerName.value = '';
  objectName.value = '';
  docDate.value = '';
  layoutMode.value = 'grid';

  if (db) {
    dbClearStore('images');
    dbClearStore('settings');
  }

  render();
});

docTitle.addEventListener('input', function() { render(); saveSettings(); });
customerName.addEventListener('input', function() { render(); saveSettings(); });
objectName.addEventListener('input', function() { render(); saveSettings(); });
docDate.addEventListener('input', function() { render(); saveSettings(); });
layoutMode.addEventListener('change', function() {
  deletedGridPages = new Set();
  render();
  saveSettings();
});

var dragCounter = 0;
document.addEventListener('dragenter', function(e) {
  e.preventDefault(); e.stopPropagation();
  dragCounter++;
  if (dragCounter === 1) dragOverlay.classList.add('show');
}, false);
document.addEventListener('dragover', function(e) {
  e.preventDefault(); e.stopPropagation();
}, false);
document.addEventListener('dragleave', function(e) {
  e.preventDefault(); e.stopPropagation();
  dragCounter--;
  if (dragCounter <= 0) { dragCounter = 0; dragOverlay.classList.remove('show'); }
}, false);
document.addEventListener('drop', function(e) {
  e.preventDefault(); e.stopPropagation();
  dragCounter = 0;
  dragOverlay.classList.remove('show');
  var dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length) addFiles(dt.files);
}, false);

/* ---- Image compression ---- */

function compressImage(file, maxDim, quality) {
  maxDim = maxDim || 1600;
  quality = quality || 0.85;
  return new Promise(function(resolve) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function() {
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      var c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      var dataUrl = c.toDataURL('image/jpeg', quality);
      URL.revokeObjectURL(url);
      resolve({ name: file.name, src: dataUrl, caption: '' });
    };
    img.onerror = function() {
      URL.revokeObjectURL(url);
      var reader = new FileReader();
      reader.onload = function(ev) { resolve({ name: file.name, src: ev.target.result, caption: '' }); };
      reader.readAsDataURL(file);
    };
    img.src = url;
  });
}

function addFiles(fileList) {
  var files = Array.from(fileList || []).filter(function(f) {
    return f.type && f.type.startsWith('image/');
  });
  if (!files.length) return;
  Promise.all(files.map(function(file) {
    return compressImage(file, 1600, 0.85);
  })).then(function(newImages) {
    images = images.concat(newImages);
    render();
    saveImages();
  });
}

/* ---- Helpers ---- */

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, function(m) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}

function formatDate(value) {
  if (!value) return '';
  if (value.indexOf('.') !== -1) return value;
  var parts = value.split('-');
  if (parts.length !== 3) return value;
  return parts[2] + '.' + parts[1] + '.' + parts[0];
}

function combinedLine() {
  var c = (customerName.value || '').trim();
  var o = (objectName.value || '').trim();
  if (c && o) return escapeHtml(c + ' - ' + o);
  return escapeHtml(c || o);
}

/* ---- Caption handling ---- */

var captionSaveTimer = null;

function onCaptionInput(globalIndex, value) {
  if (globalIndex >= 0 && globalIndex < images.length) {
    images[globalIndex].caption = value;
    var captionEl = document.querySelector('.slot-caption[data-img-idx="' + globalIndex + '"]');
    if (captionEl) captionEl.textContent = value;
    if (captionSaveTimer) clearTimeout(captionSaveTimer);
    captionSaveTimer = setTimeout(function() { saveImages(); }, 800);
  }
}

/* ---- Rendering ---- */

function removeImage(idx) {
  if (idx < 0 || idx >= images.length) return;
  images.splice(idx, 1);
  saveImages();
  render();
}

function renderThumbs() {
  thumbbar.innerHTML = '';
  images.forEach(function(img, idx) {
    var d = document.createElement('div');
    d.className = 'thumb';
    d.title = (idx + 1) + ': ' + img.name;
    d.innerHTML = '<img src="' + img.src + '" alt="">' +
      '<button class="thumb-remove" type="button" data-idx="' + idx + '">&times;</button>';
    d.querySelector('.thumb-remove').addEventListener('click', function(e) {
      e.stopPropagation();
      removeImage(idx);
    });
    thumbbar.appendChild(d);
  });
}

var HEADER_HTML = '<div class="header-img"><img src="assets/header.png" alt=""></div>';
var FOOTER_HTML = '<div class="footer-img"><img src="assets/footer.png" alt=""></div>';

function pageNumber(n) {
  return '<div class="page-number">Seite ' + n + '</div>';
}

function createPageWrap(pageElement, pageNo, isGridPage, captionInputsHtml) {
  var wrap = document.createElement('div');
  wrap.className = 'page-wrap';
  if (isGridPage && deletedGridPages.has(pageNo)) wrap.classList.add('deleted');

  var actions = document.createElement('div');
  actions.className = 'page-actions';

  if (isGridPage) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'page-btn ' + (deletedGridPages.has(pageNo) ? 'restore' : 'delete');
    btn.textContent = deletedGridPages.has(pageNo) ? 'SEITE WIEDERHERSTELLEN' : 'SEITE LÖSCHEN';
    btn.addEventListener('click', function() {
      if (deletedGridPages.has(pageNo)) deletedGridPages.delete(pageNo);
      else deletedGridPages.add(pageNo);
      render();
    });
    actions.appendChild(btn);
  }

  wrap.appendChild(actions);
  wrap.appendChild(pageElement);

  if (captionInputsHtml) {
    var captionDiv = document.createElement('div');
    captionDiv.className = 'caption-inputs';
    captionDiv.innerHTML = captionInputsHtml;
    wrap.appendChild(captionDiv);
  }

  return wrap;
}

function renderSlot(item, label, globalIndex) {
  var captionText = (item && item.caption) ? escapeHtml(item.caption) : '';
  var idxAttr = (globalIndex >= 0) ? ' data-img-idx="' + globalIndex + '"' : '';
  var removeBtn = (item && globalIndex >= 0)
    ? '<button class="slot-remove" type="button" onclick="removeImage(' + globalIndex + ')">&times;</button>'
    : '';
  return '<div class="slot">' +
    '<div class="slot-image-area">' +
    (item
      ? '<span class="img-number">' + label + '</span>' + removeBtn + '<img src="' + item.src + '" alt="">'
      : '<div class="placeholder">FREI</div>') +
    '</div>' +
    '<div class="slot-caption"' + idxAttr + '>' + captionText + '</div>' +
    '</div>';
}

function buildCaptionInputs(indices) {
  return indices.map(function(globalIdx) {
    var img = images[globalIdx];
    if (!img) return '';
    var val = escapeHtml(img.caption || '');
    return '<div class="caption-field">' +
      '<label>Bild ' + (globalIdx + 1) + '</label>' +
      '<input type="text" placeholder="Beschreibung..." value="' + val + '" oninput="onCaptionInput(' + globalIdx + ', this.value)" />' +
      '</div>';
  }).join('');
}

function renderFirstPage() {
  var mode = layoutMode.value || 'grid';
  var page = document.createElement('div');
  page.className = 'page';
  var captionHtml = '';

  if (mode === 'cover') {
    page.innerHTML =
      HEADER_HTML +
      '<div class="title">' + escapeHtml(docTitle.value || 'FOTODOKUMENTATION') +
        '<div class="customer">' + combinedLine() + '</div>' +
      '</div>' +
      '<div class="cover-slot">' + (images[0] ? '<img src="' + images[0].src + '" alt="">' : '<div class="placeholder">TITELBILD</div>') + '</div>' +
      '<div class="docdate">' + (docDate.value ? formatDate(docDate.value) : '') + '</div>' +
      FOOTER_HTML +
      pageNumber(1);
  } else {
    var indices = [];
    page.innerHTML =
      HEADER_HTML +
      '<div class="title">' + escapeHtml(docTitle.value || 'FOTODOKUMENTATION') +
        '<div class="customer">' + combinedLine() + '</div>' +
      '</div>' +
      '<div class="grid-cover">' +
        [0,1,2,3].map(function(i) {
          if (images[i]) indices.push(i);
          return renderSlot(images[i], 'Bild ' + (i + 1), i);
        }).join('') +
      '</div>' +
      '<div class="docdate">' + (docDate.value ? formatDate(docDate.value) : '') + '</div>' +
      FOOTER_HTML +
      pageNumber(1);
    captionHtml = buildCaptionInputs(indices);
  }

  return createPageWrap(page, 1, false, captionHtml);
}

function renderGridPage(chunk, pageNo, firstImageNumber, globalStartIdx) {
  var page = document.createElement('div');
  page.className = 'page';
  var indices = [];
  page.innerHTML =
    '<div class="grid-standard">' +
      [0,1,2,3].map(function(i) {
        var globalIdx = globalStartIdx + i;
        var item = chunk[i];
        if (item) indices.push(globalIdx);
        return renderSlot(item, 'Bild ' + (firstImageNumber + i), item ? globalIdx : -1);
      }).join('') +
    '</div>' +
    FOOTER_HTML +
    pageNumber(pageNo);
  var captionHtml = buildCaptionInputs(indices);
  return createPageWrap(page, pageNo, true, captionHtml);
}

function render() {
  renderThumbs();
  pages.innerHTML = '';

  pages.appendChild(renderFirstPage());

  var coverMode = layoutMode.value === 'cover';
  var restStartIdx = coverMode ? 1 : 4;
  var rest = images.slice(restStartIdx);
  var neededPages = Math.max(1, Math.ceil(rest.length / 4));
  if (rest.length === 0) neededPages = 0;
  var firstImageNumber = coverMode ? 2 : 5;

  for (var p = 0; p < neededPages; p++) {
    var start = p * 4;
    var chunk = rest.slice(start, start + 4);
    var pageNo = p + 2;
    var startLabel = firstImageNumber + start;
    var globalStartIdx = restStartIdx + start;
    pages.appendChild(renderGridPage(chunk, pageNo, startLabel, globalStartIdx));
  }
}

/* ---- Init: load saved data, then render ---- */
loadSavedData();
