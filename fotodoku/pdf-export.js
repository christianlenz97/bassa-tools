/* PDF Export - depends on jsPDF + html2canvas from CDN, and globals from app.js */

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function sanitizeFileName(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'FOTODOKU';
}

function buildPdfFileName() {
  var rawDate = (docDate.value || '').trim();
  var rawObject = (objectName.value || '').trim();
  var rawCustomer = (customerName.value || '').trim();

  var datePart = sanitizeFileName(rawDate || new Date().toISOString().slice(0,10));
  var objectPart = sanitizeFileName(rawObject || 'Objekt');
  var customerPart = sanitizeFileName(rawCustomer || 'Kunde');

  return datePart + '_' + objectPart + '_' + customerPart + '_FOTODOKU.pdf';
}

function showProgress(current, total) {
  pdfBtn.textContent = 'SEITE ' + current + ' / ' + total + ' ...';
}

function triggerDownload(blob, fileName) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }, 5000);
}

async function saveAsPdf() {
  var fileName = buildPdfFileName();

  if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) {
    var oldTitle = document.title;
    document.title = fileName.replace('.pdf','');
    window.print();
    setTimeout(function() { document.title = oldTitle; }, 1200);
    alert('Die PDF-Bibliothek konnte nicht geladen werden. Deshalb wurde auf "Drucken / Als PDF sichern" umgeschaltet.');
    return;
  }

  var originalText = pdfBtn.textContent;
  pdfBtn.classList.add('loading');

  var settingsBar = document.querySelector('.settings-bar');
  var topbarEl = document.getElementById('fotodokuTopbar');
  var thumbbarEl = document.getElementById('thumbbar');
  var dragOv = document.getElementById('dragOverlay');
  var captionInputs = document.querySelectorAll('.caption-inputs');
  var slotRemoves = document.querySelectorAll('.slot-remove');
  var pageNodes = Array.from(document.querySelectorAll('.page-wrap:not(.deleted) .page'));

  if (pageNodes.length === 0) {
    alert('Keine sichtbaren Seiten zum Exportieren vorhanden.');
    pdfBtn.classList.remove('loading');
    return;
  }

  var previous = {
    settingsBar: settingsBar ? settingsBar.style.display : '',
    topbar: topbarEl ? topbarEl.style.display : '',
    thumbbar: thumbbarEl ? thumbbarEl.style.display : '',
    dragOv: dragOv ? dragOv.style.display : '',
    bodyBg: document.body.style.background
  };

  if (settingsBar) settingsBar.style.display = 'none';
  if (topbarEl) topbarEl.style.display = 'none';
  if (thumbbarEl) thumbbarEl.style.display = 'none';
  if (dragOv) dragOv.style.display = 'none';
  document.body.style.background = '#ffffff';
  captionInputs.forEach(function(el) { el.style.display = 'none'; });
  slotRemoves.forEach(function(el) { el.style.display = 'none'; });

  var allPages = document.querySelectorAll('.page');
  var savedTransforms = [];
  allPages.forEach(function(p) {
    savedTransforms.push(p.style.transform || '');
    p.style.transform = 'none';
    p.style.marginBottom = '0';
  });

  try {
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF('p', 'mm', 'a4');
    var pdfWidth = 210;
    var pdfHeight = 297;
    var total = pageNodes.length;

    for (var i = 0; i < total; i++) {
      showProgress(i + 1, total);
      await new Promise(function(r) { setTimeout(r, 50); });

      var canvas = await html2canvas(pageNodes[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      var imgData = canvas.toDataURL('image/jpeg', 0.92);
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

      canvas.width = 0;
      canvas.height = 0;
      canvas = null;
      imgData = null;
    }

    pdfBtn.textContent = 'PDF WIRD GESPEICHERT...';

    var blob = pdf.output('blob');
    triggerDownload(blob, fileName);

  } catch (error) {
    console.error('PDF-Export Fehler:', error);
    alert('PDF-Erstellung fehlgeschlagen: ' + (error.message || 'Unbekannter Fehler') + '\n\nTipp: Bei vielen Bildern kann der Speicher knapp werden. Versuche es mit weniger Seiten.');
  } finally {
    allPages.forEach(function(p, idx) {
      p.style.transform = savedTransforms[idx];
      p.style.marginBottom = '';
    });
    captionInputs.forEach(function(el) { el.style.display = ''; });
    slotRemoves.forEach(function(el) { el.style.display = ''; });
    if (settingsBar) settingsBar.style.display = previous.settingsBar;
    if (topbarEl) topbarEl.style.display = previous.topbar;
    if (thumbbarEl) thumbbarEl.style.display = previous.thumbbar;
    if (dragOv) dragOv.style.display = previous.dragOv;
    document.body.style.background = previous.bodyBg;
    pdfBtn.textContent = originalText;
    pdfBtn.classList.remove('loading');
  }
}
