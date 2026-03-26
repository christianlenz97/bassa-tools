/* ---- Supabase persistence ---- */

var fotodokuUserId = null;
var imageDbRecords = [];

async function getFotodokuUserId() {
  if (fotodokuUserId) return fotodokuUserId;
  try {
    var res = await sbGetSession();
    if (res.data && res.data.session && res.data.session.user) {
      fotodokuUserId = res.data.session.user.id;
    }
  } catch (e) {}
  if (!fotodokuUserId && window !== window.top) {
    try {
      var parentUser = window.parent.currentUser;
      if (parentUser) fotodokuUserId = parentUser.id;
    } catch (e) {}
  }
  return fotodokuUserId;
}

async function saveSettings() {
  var uid = await getFotodokuUserId();
  if (!uid) return;
  await sbUpsertFotodokuSettings({
    user_id: uid,
    doc_title: docTitle.value,
    customer_name: customerName.value,
    object_name: objectName.value,
    doc_date: docDate.value,
    layout_mode: layoutMode.value,
    updated_at: new Date().toISOString()
  });
}

async function saveImages() {
  var uid = await getFotodokuUserId();
  if (!uid) return;

  await sbDeleteAllFotodokuImages(uid);
  imageDbRecords = [];

  for (var i = 0; i < images.length; i++) {
    var img = images[i];
    var storagePath = img.storagePath || '';

    if (!storagePath && img.src) {
      var blob = await dataUrlToBlob(img.src);
      var uploadRes = await sbUploadImage(uid, img.name || ('img_' + i + '.jpg'), blob);
      if (!uploadRes.error && uploadRes.path) {
        storagePath = uploadRes.path;
        images[i].storagePath = storagePath;
      }
    }

    var res = await sbInsertFotodokuImage({
      user_id: uid,
      name: img.name || '',
      storage_path: storagePath,
      caption: img.caption || '',
      sort_order: i
    });
    if (res.data) imageDbRecords.push(res.data);
  }
}

function dataUrlToBlob(dataUrl) {
  return new Promise(function(resolve) {
    if (dataUrl.startsWith('blob:') || !dataUrl.startsWith('data:')) {
      fetch(dataUrl).then(function(r) { return r.blob(); }).then(resolve);
      return;
    }
    var parts = dataUrl.split(',');
    var mime = parts[0].match(/:(.*?);/)[1];
    var b64 = atob(parts[1]);
    var arr = new Uint8Array(b64.length);
    for (var i = 0; i < b64.length; i++) arr[i] = b64.charCodeAt(i);
    resolve(new Blob([arr], { type: mime }));
  });
}

async function loadSavedData() {
  var uid = await getFotodokuUserId();
  if (!uid) { render(); return; }

  try {
    var settingsRes = await sbGetFotodokuSettings(uid);
    if (settingsRes.data) {
      var s = settingsRes.data;
      docTitle.value = s.doc_title || 'FOTODOKUMENTATION';
      customerName.value = s.customer_name || '';
      objectName.value = s.object_name || '';
      docDate.value = s.doc_date || '';
      layoutMode.value = s.layout_mode || 'grid';
    }

    var imagesRes = await sbGetFotodokuImages(uid);
    if (imagesRes.data && imagesRes.data.length > 0) {
      imageDbRecords = imagesRes.data;
      images = [];
      for (var i = 0; i < imagesRes.data.length; i++) {
        var row = imagesRes.data[i];
        var src = '';
        if (row.storage_path) {
          var urlRes = await sbGetImageUrl(row.storage_path);
          if (urlRes.data && urlRes.data.signedUrl) src = urlRes.data.signedUrl;
        }
        images.push({
          name: row.name || '',
          src: src,
          caption: row.caption || '',
          storagePath: row.storage_path || '',
          dbId: row.id
        });
      }
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
var dropzone = document.getElementById('dropzone');

if (typeof BassaDatepicker !== 'undefined') {
  new BassaDatepicker(docDate, { defaultToday: true });
}
var dragOverlay = document.getElementById('dragOverlay');
var thumbbar = document.getElementById('thumbbar');
var thumbSection = document.getElementById('thumbSection');
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

if (dropzone) {
  dropzone.addEventListener('click', function(e) {
    if (e.target.tagName !== 'LABEL') fileInput.click();
  });
  dropzone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', function() {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });
}

clearBtn.addEventListener('click', async function() {
  if (!window.confirm('Wirklich ALLE Daten und Bilder löschen? Dieser Schritt kann nicht rückgängig gemacht werden.')) return;

  var uid = await getFotodokuUserId();
  if (uid) {
    await sbDeleteAllFotodokuImages(uid);
    await sbDeleteAllStorageImages(uid);
    await sbUpsertFotodokuSettings({
      user_id: uid,
      doc_title: 'FOTODOKUMENTATION',
      customer_name: '',
      object_name: '',
      doc_date: '',
      layout_mode: 'grid',
      updated_at: new Date().toISOString()
    });
  }

  images = [];
  imageDbRecords = [];
  deletedGridPages = new Set();
  docTitle.value = 'FOTODOKUMENTATION';
  customerName.value = '';
  objectName.value = '';
  docDate.value = '';
  layoutMode.value = 'grid';

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
      resolve({ name: file.name, src: dataUrl, caption: '', storagePath: '' });
    };
    img.onerror = function() {
      URL.revokeObjectURL(url);
      var reader = new FileReader();
      reader.onload = function(ev) { resolve({ name: file.name, src: ev.target.result, caption: '', storagePath: '' }); };
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
    captionSaveTimer = setTimeout(function() {
      var img = images[globalIndex];
      if (img && img.dbId) {
        sbUpdateFotodokuImage(img.dbId, { caption: value });
      }
    }, 800);
  }
}

/* ---- Rendering ---- */

function removeImage(idx) {
  if (idx < 0 || idx >= images.length) return;
  var removed = images.splice(idx, 1)[0];
  if (removed && removed.dbId) {
    sbDeleteFotodokuImage(removed.dbId);
  }
  if (removed && removed.storagePath) {
    sbDeleteStorageImage(removed.storagePath);
  }
  render();
}

function renderThumbs() {
  thumbbar.innerHTML = '';
  if (thumbSection) thumbSection.style.display = images.length ? '' : 'none';
  images.forEach(function(img, idx) {
    var row = document.createElement('div');
    row.className = 'thumb-row';
    var captionVal = escapeHtml(img.caption || '');
    row.innerHTML =
      '<span class="thumb-num">' + (idx + 1) + '</span>' +
      '<img class="thumb-img" src="' + img.src + '" alt="">' +
      '<input class="thumb-caption" type="text" placeholder="Beschreibung..." value="' + captionVal + '" />' +
      '<button class="thumb-del" type="button" title="Entfernen">&times;</button>';
    row.querySelector('.thumb-caption').addEventListener('input', function(e) {
      onCaptionInput(idx, e.target.value);
    });
    row.querySelector('.thumb-del').addEventListener('click', function() {
      removeImage(idx);
    });
    thumbbar.appendChild(row);
  });
}

var HEADER_HTML = '<div class="header-img"><img src="assets/header.png" alt=""></div>';
var FOOTER_HTML = '<div class="footer-img"><img src="assets/footer.png" alt=""></div>';

function pageNumber(n) {
  return '<div class="page-number">Seite ' + n + '</div>';
}

function createPageWrap(pageElement, pageNo, isGridPage) {
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

function renderFirstPage() {
  var mode = layoutMode.value || 'grid';
  var page = document.createElement('div');
  page.className = 'page';

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
    page.innerHTML =
      HEADER_HTML +
      '<div class="title">' + escapeHtml(docTitle.value || 'FOTODOKUMENTATION') +
        '<div class="customer">' + combinedLine() + '</div>' +
      '</div>' +
      '<div class="grid-cover">' +
        [0,1,2,3].map(function(i) {
          return renderSlot(images[i], 'Bild ' + (i + 1), i);
        }).join('') +
      '</div>' +
      '<div class="docdate">' + (docDate.value ? formatDate(docDate.value) : '') + '</div>' +
      FOOTER_HTML +
      pageNumber(1);
  }

  return createPageWrap(page, 1, false);
}

function renderGridPage(chunk, pageNo, firstImageNumber, globalStartIdx) {
  var page = document.createElement('div');
  page.className = 'page';
  page.innerHTML =
    '<div class="grid-standard">' +
      [0,1,2,3].map(function(i) {
        var globalIdx = globalStartIdx + i;
        var item = chunk[i];
        return renderSlot(item, 'Bild ' + (firstImageNumber + i), item ? globalIdx : -1);
      }).join('') +
    '</div>' +
    FOOTER_HTML +
    pageNumber(pageNo);
  return createPageWrap(page, pageNo, true);
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
