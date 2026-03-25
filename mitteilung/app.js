/* Durchfuehrungsmitteilung – app.js */

var $ = function(s) { return document.querySelector(s); };

var elKunde     = $('#kunde');
var elBetreff   = $('#betreff');
var elObjekt    = $('#objekt');
var elNummer    = $('#nummer');
var elDatum     = $('#datum');
var dropzone    = $('#dropzone');
var statusBox   = $('#status');
var fileInput   = $('#fileInput');

var prevKunde   = $('#preview-kunde');
var prevBetreff = $('#preview-betreff');
var prevObjekt  = $('#preview-objekt');
var prevNummer  = $('#preview-nummer');
var prevDatum   = $('#preview-datum');
var prevDatumTop = $('#preview-datum-top');

/* ===== Default date (today) ===== */
(function setDefaults() {
  var d = new Date();
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  elDatum.value = dd + '.' + mm + '.' + d.getFullYear();
  updatePreview();
})();

/* ===== Live preview ===== */
function updatePreview() {
  prevKunde.textContent   = elKunde.value || '[Kunde]';
  prevBetreff.textContent = elBetreff.value || 'Durchführung der beauftragten Arbeiten';
  prevObjekt.textContent  = elObjekt.value || '[Bauvorhaben]';
  prevNummer.textContent  = elNummer.value || '[Nr]';
  prevDatum.textContent   = elDatum.value || '[Datum]';
  prevDatumTop.textContent = elDatum.value || '[Datum]';
}

[elKunde, elBetreff, elObjekt, elNummer, elDatum].forEach(function(el) {
  el.addEventListener('input', updatePreview);
});

/* ===== Drag-and-drop ===== */
['dragenter', 'dragover'].forEach(function(evt) {
  dropzone.addEventListener(evt, function(e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(function(evt) {
  dropzone.addEventListener(evt, function(e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});
dropzone.addEventListener('drop', function(e) {
  var file = e.dataTransfer.files[0];
  if (file) processFile(file);
});
fileInput.addEventListener('change', function() {
  if (fileInput.files[0]) processFile(fileInput.files[0]);
});

function showStatus(text, type) {
  statusBox.textContent = text;
  statusBox.className = 'status show ' + (type || 'ok');
}

/* ===== File processing ===== */
function processFile(file) {
  var name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    showStatus('📄 PDF wird analysiert …', 'warn');
    extractPdf(file);
  } else if (/\.(jpg|jpeg|png|webp|tiff?)$/i.test(name)) {
    showStatus('🔍 OCR läuft – Bild wird gelesen …', 'warn');
    extractImage(file);
  } else {
    showStatus('⚠ Nicht unterstütztes Format. Bitte PDF oder Bild hochladen.', 'warn');
  }
}

/* ===== PDF extraction via pdf.js ===== */
function extractPdf(file) {
  var reader = new FileReader();
  reader.onload = function() {
    var typedArray = new Uint8Array(reader.result);
    pdfjsLib.getDocument({data: typedArray}).promise.then(function(pdf) {
      var pages = [];
      var totalPages = pdf.numPages;

      function getPage(i) {
        if (i > totalPages) {
          var allText = pages.join('\n');
          fillFieldsFromText(allText);
          return;
        }
        pdf.getPage(i).then(function(page) {
          page.getTextContent().then(function(tc) {
            var str = tc.items.map(function(item) { return item.str; }).join(' ');
            pages.push(str);
            getPage(i + 1);
          });
        });
      }
      getPage(1);
    }).catch(function() {
      showStatus('⚠ PDF konnte nicht gelesen werden. Versuchen Sie es mit einem Bild.', 'warn');
    });
  };
  reader.readAsArrayBuffer(file);
}

/* ===== OCR via Tesseract.js ===== */
function extractImage(file) {
  var reader = new FileReader();
  reader.onload = function() {
    Tesseract.recognize(reader.result, 'deu', {
      logger: function(m) {
        if (m.status === 'recognizing text') {
          showStatus('🔍 OCR: ' + Math.round(m.progress * 100) + '%', 'warn');
        }
      }
    }).then(function(result) {
      fillFieldsFromText(result.data.text);
    }).catch(function() {
      showStatus('⚠ OCR fehlgeschlagen. Bitte Felder manuell ausfüllen.', 'warn');
    });
  };
  reader.readAsDataURL(file);
}

/* ===== Smart field extraction ===== */
function extractFieldsFromText(text) {
  var fields = {};
  var lines = text.split(/\n/);
  var fullText = text;

  // Kunde (first non-empty line or line with Firma/name pattern)
  for (var i = 0; i < lines.length; i++) {
    var trimmed = lines[i].trim();
    if (trimmed.length > 3 && !/^(angebot|auftrag|rechnung|bestell|datum|betreff|objekt|bauvorhaben|nr|pos)/i.test(trimmed)) {
      fields.kunde = trimmed;
      break;
    }
  }

  // Betreff
  var betreffMatch = fullText.match(/Betreff[:\s]*([^\n]+)/i);
  if (betreffMatch) fields.betreff = betreffMatch[1].trim();

  // Bauvorhaben / Objekt
  var bvMatch = fullText.match(/(?:Bauvorhaben|Objekt|Baustelle)[:\s]*([^\n]+)/i);
  if (bvMatch) fields.objekt = bvMatch[1].trim();

  // Angebots-/Auftragsnummer
  var nrMatch = fullText.match(/(?:Angebot|Auftrag|Bestell)(?:s)?(?:nummer|[-\s]?(?:Nr|No)\.?)[:\s]*(\S+)/i);
  if (nrMatch) fields.nummer = nrMatch[1].trim();
  if (!fields.nummer) {
    var nrFallback = fullText.match(/(?:Nr|Nummer)[.:\s]*(\d[\d\-\/]+)/i);
    if (nrFallback) fields.nummer = nrFallback[1].trim();
  }

  // Datum
  var datumMatch = fullText.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/);
  if (datumMatch) fields.datum = datumMatch[1];

  return fields;
}

function fillFieldsFromText(text) {
  var f = extractFieldsFromText(text);
  var count = 0;
  if (f.kunde)   { elKunde.value = f.kunde;   count++; }
  if (f.betreff) { elBetreff.value = f.betreff; count++; }
  if (f.objekt)  { elObjekt.value = f.objekt;  count++; }
  if (f.nummer)  { elNummer.value = f.nummer;  count++; }
  if (f.datum)   { elDatum.value = f.datum;    count++; }

  updatePreview();

  if (count > 0) {
    showStatus('✅ ' + count + ' Feld(er) automatisch erkannt.\nBitte überprüfen und ggf. korrigieren.', 'ok');
  } else {
    showStatus('⚠ Keine Felder automatisch erkannt.\nBitte manuell ausfüllen.', 'warn');
  }
}

/* ===== Actions ===== */
function doPrint() {
  window.print();
}

function doReset() {
  elKunde.value = '';
  elBetreff.value = '';
  elObjekt.value = '';
  elNummer.value = '';
  var d = new Date();
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  elDatum.value = dd + '.' + mm + '.' + d.getFullYear();
  statusBox.className = 'status';
  updatePreview();
}

function doDemo() {
  elKunde.value = 'Mustermann GmbH\nMusterstraße 1\n1234 Musterstadt';
  elBetreff.value = 'Durchführung der beauftragten Arbeiten\nPreisvorteil Dachsanierung';
  elObjekt.value = 'Neubau Musterstraße 1, 1234 Musterstadt';
  elNummer.value = 'ANG-2025-0042';
  var d = new Date();
  d.setDate(d.getDate() + 7);
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  elDatum.value = dd + '.' + mm + '.' + d.getFullYear();
  updatePreview();
  showStatus('✅ Demo-Daten eingefüllt – so sieht der Brief aus.', 'ok');
}
