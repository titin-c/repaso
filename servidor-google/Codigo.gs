/**
 * Servidor del quiz "Repaso" — Google Apps Script + Google Sheets.
 * Guarda las preguntas que se suben y los resultados de todas las rondas.
 * Nunca borra nada: al quitar o sustituir una subida solo cambia su "estado".
 *
 * Hojas que crea solas:
 *   Subidas    → id | fecha | nombre | estado (activa / retirada / reemplazada) | xml
 *   Resultados → id | fecha | datos (JSON de la ronda)
 */

var HOJA_SUBIDAS = 'Subidas';
var HOJA_RESULTADOS = 'Resultados';
var MAX_XML = 48000;      // una celda de Sheets admite hasta 50.000 caracteres
var MAX_RESULTADO = 20000;

function doGet() {
  var subidas = filas(hoja(HOJA_SUBIDAS, ['id', 'fecha', 'nombre', 'estado', 'xml']))
    .filter(function (f) { return f[3] === 'activa'; })
    .map(function (f) { return { id: String(f[0]), fecha: iso(f[1]), nombre: String(f[2]), xml: String(f[4]) }; });
  var resultados = filas(hoja(HOJA_RESULTADOS, ['id', 'fecha', 'datos']))
    .map(function (f) { try { return JSON.parse(f[2]); } catch (e) { return null; } })
    .filter(function (r) { return r; });
  return json({ ok: true, subidas: subidas, resultados: resultados });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents);

    if (d.accion === 'subir') {
      var xml = String(d.xml || '');
      if (xml.indexOf('<pregunta') < 0) return json({ ok: false, error: 'no hay preguntas en el archivo' });
      if (xml.length > MAX_XML) return json({ ok: false, error: 'el archivo es demasiado grande; súbelo en dos partes' });
      var h = hoja(HOJA_SUBIDAS, ['id', 'fecha', 'nombre', 'estado', 'xml']);
      var id = Utilities.getUuid();
      h.appendRow([id, new Date().toISOString(), texto(d.nombre, 120), 'activa', xml]);
      if (d.reemplaza) cambiarEstado(h, String(d.reemplaza), 'reemplazada');
      return json({ ok: true, id: id });
    }

    if (d.accion === 'retirar') {
      var ok = cambiarEstado(hoja(HOJA_SUBIDAS, ['id', 'fecha', 'nombre', 'estado', 'xml']), String(d.id || ''), 'retirada');
      return json(ok ? { ok: true } : { ok: false, error: 'no se ha encontrado' });
    }

    if (d.accion === 'resultado') {
      var datos = JSON.stringify(d.datos || {});
      if (datos.length > MAX_RESULTADO) return json({ ok: false, error: 'resultado demasiado grande' });
      var hr = hoja(HOJA_RESULTADOS, ['id', 'fecha', 'datos']);
      var rid = String((d.datos && d.datos.id) || Utilities.getUuid());
      var ya = filas(hr).some(function (f) { return String(f[0]) === rid; });
      if (!ya) hr.appendRow([texto(rid, 60), new Date().toISOString(), datos]);
      return json({ ok: true });
    }

    return json({ ok: false, error: 'acción desconocida' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- utilidades ---------- */
function hoja(nombre, cabecera) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var h = ss.getSheetByName(nombre);
  if (!h) {
    h = ss.insertSheet(nombre);
    h.appendRow(cabecera);
    h.getRange('A:Z').setNumberFormat('@'); // todo como texto: nada se interpreta como fórmula ni fecha
    h.setFrozenRows(1);
  }
  return h;
}
function filas(h) {
  var n = h.getLastRow();
  return n < 2 ? [] : h.getRange(2, 1, n - 1, h.getLastColumn()).getValues();
}
function cambiarEstado(h, id, estado) {
  var ids = filas(h).map(function (f) { return String(f[0]); });
  var i = ids.indexOf(id);
  if (i < 0) return false;
  h.getRange(i + 2, 4).setValue(estado);
  return true;
}
function texto(v, max) {
  var s = String(v == null ? '' : v).slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function iso(v) { return v instanceof Date ? v.toISOString() : String(v); }
function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
