// Servidor del quiz "Repaso". Nunca borra nada: solo cambia el "estado" de las filas.
// Hojas: Subidas (preguntas subidas), Resultados (rondas) y Alias (nombres unidos).
var CAB_S = ['id','fecha','nombre','estado','xml'];
var CAB_R = ['id','fecha','datos'];
var CAB_A = ['id','fecha','tipo','de','a','estado','original'];

function doGet() {
  var subidas = filas(hoja('Subidas', CAB_S))
    .filter(function(f){ return f[3] === 'activa'; })
    .map(function(f){ return {id:String(f[0]), fecha:String(f[1]), nombre:String(f[2]), xml:String(f[4])}; });
  var resultados = filas(hoja('Resultados', CAB_R))
    .map(function(f){ try { return JSON.parse(f[2]); } catch(e) { return null; } })
    .filter(function(r){ return r; });
  var alias = filas(hoja('Alias', CAB_A))
    .filter(function(f){ return f[5] === 'activa'; })
    .map(function(f){ return {id:String(f[0]), tipo:String(f[2]), de:String(f[3]), a:String(f[4]), original:String(f[6])}; });
  return json({ok:true, subidas:subidas, resultados:resultados, alias:alias});
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.accion === 'subir') {
      var xml = String(d.xml || '');
      if (xml.indexOf('<pregunta') < 0) return json({ok:false, error:'no hay preguntas en el archivo'});
      if (xml.length > 48000) return json({ok:false, error:'el archivo es demasiado grande; súbelo en dos partes'});
      var h = hoja('Subidas', CAB_S);
      var id = Utilities.getUuid();
      h.appendRow([id, new Date().toISOString(), texto(d.nombre, 120), 'activa', xml]);
      if (d.reemplaza) cambiarEstado(h, String(d.reemplaza), 'reemplazada', 4);
      return json({ok:true, id:id});
    }
    if (d.accion === 'retirar') {
      var ok = cambiarEstado(hoja('Subidas', CAB_S), String(d.id || ''), 'retirada', 4);
      return json(ok ? {ok:true} : {ok:false, error:'no se ha encontrado'});
    }
    if (d.accion === 'resultado') {
      var datos = JSON.stringify(d.datos || {});
      if (datos.length > 20000) return json({ok:false, error:'resultado demasiado grande'});
      var hr = hoja('Resultados', CAB_R);
      var rid = String((d.datos && d.datos.id) || Utilities.getUuid());
      var ya = filas(hr).some(function(f){ return String(f[0]) === rid; });
      if (!ya) hr.appendRow([texto(rid, 60), new Date().toISOString(), datos]);
      return json({ok:true});
    }
    if (d.accion === 'alias') {
      if (['curso','asignatura','tema'].indexOf(d.tipo) < 0 || !d.de || !d.a) return json({ok:false, error:'datos incompletos'});
      var aid = Utilities.getUuid();
      hoja('Alias', CAB_A).appendRow([aid, new Date().toISOString(), d.tipo, texto(d.de, 300), texto(d.a, 200), 'activa', texto(d.original, 200)]);
      return json({ok:true, id:aid});
    }
    if (d.accion === 'quitarAlias') {
      var ok2 = cambiarEstado(hoja('Alias', CAB_A), String(d.id || ''), 'deshecha', 6);
      return json(ok2 ? {ok:true} : {ok:false, error:'no se ha encontrado'});
    }
    return json({ok:false, error:'acción desconocida'});
  } catch (err) {
    return json({ok:false, error:String(err)});
  } finally {
    lock.releaseLock();
  }
}

function hoja(nombre, cab) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var h = ss.getSheetByName(nombre);
  if (!h) { h = ss.insertSheet(nombre); h.appendRow(cab); h.getRange('A:Z').setNumberFormat('@'); h.setFrozenRows(1); }
  return h;
}
function filas(h) { var n = h.getLastRow(); return n < 2 ? [] : h.getRange(2, 1, n - 1, h.getLastColumn()).getValues(); }
function cambiarEstado(h, id, estado, col) {
  var ids = filas(h).map(function(f){ return String(f[0]); });
  var i = ids.indexOf(id);
  if (i < 0) return false;
  h.getRange(i + 2, col).setValue(estado);
  return true;
}
function texto(v, max) { var s = String(v == null ? '' : v).slice(0, max); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function json(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
