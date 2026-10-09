// Servidor del quiz "Repaso". Nunca borra nada: solo cambia el "estado" de las filas.
// Hojas: Subidas (preguntas subidas), Resultados (rondas), Alias (nombres unidos),
//        Premios (los cambias tú: nombre, puntos y activo = si/no) y Canjes (premios pedidos).

// PIN para confirmar premios. CÁMBIALO por uno tuyo antes de implementar.
var PIN_PADRES = '1234';
var CAB_S = ['id','fecha','nombre','estado','xml'];
var CAB_R = ['id','fecha','datos'];
var CAB_A = ['id','fecha','tipo','de','a','estado','original'];
var CAB_P = ['id','nombre','puntos','activo'];
var CAB_C = ['id','fecha','premioId','nombre','puntos','estado','resuelto'];
var PREMIOS_INICIALES = [
  ['postre','Elegir el postre o la cena',400],['peli','Elegir la película familiar',400],['pantalla','30 minutos extra de pantalla',500],
  ['tarea','Librarte de una tarea de casa',600],['plan','Plan especial con papá o mamá',1500],['merienda','Merendar fuera',1800],
  ['amiga','Invitar a una amiga a casa o a dormir',2000],['libro','Un libro o cómic que elijas',2000],['cine','Entrada de cine con una amiga',5000],
  ['capricho','Un capricho que elijas',6000],['actividad','Una actividad: escape room, patinaje…',7000]
];

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
  var premios = filas(hojaPremios())
    .filter(function(f){ return String(f[1]) && String(f[3]).toLowerCase() !== 'no'; })
    .map(function(f){ return {id:String(f[0]), nombre:String(f[1]), puntos:Number(f[2]) || 0}; });
  var canjes = filas(hoja('Canjes', CAB_C))
    .map(function(f){ return {id:String(f[0]), fecha:String(f[1]), premioId:String(f[2]), nombre:String(f[3]), puntos:Number(f[4]) || 0, estado:String(f[5]), resuelto:String(f[6])}; });
  return json({ok:true, subidas:subidas, resultados:resultados, alias:alias, premios:premios, canjes:canjes});
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
    if (d.accion === 'canjear') {
      var pts = Math.round(Number(d.puntos) || 0);
      if (!d.nombre || pts <= 0) return json({ok:false, error:'datos incompletos'});
      var cid = Utilities.getUuid();
      hoja('Canjes', CAB_C).appendRow([cid, new Date().toISOString(), texto(d.premioId, 60), texto(d.nombre, 200), pts, 'pendiente', '']);
      return json({ok:true, id:cid});
    }
    if (d.accion === 'resolverCanje') {
      if (String(d.pin || '') !== String(PIN_PADRES)) return json({ok:false, error:'PIN incorrecto'});
      if (['entregado','rechazado'].indexOf(d.estado) < 0) return json({ok:false, error:'estado no válido'});
      var hc = hoja('Canjes', CAB_C);
      var ok3 = cambiarEstado(hc, String(d.id || ''), d.estado, 6);
      if (ok3) cambiarEstado(hc, String(d.id || ''), new Date().toISOString(), 7);
      return json(ok3 ? {ok:true} : {ok:false, error:'no se ha encontrado'});
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
function hojaPremios() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var h = ss.getSheetByName('Premios');
  if (!h) {
    h = hoja('Premios', CAB_P);
    PREMIOS_INICIALES.forEach(function(p){ h.appendRow([p[0], p[1], p[2], 'si']); });
    h.getRange('C:C').setNumberFormat('0');
  }
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
