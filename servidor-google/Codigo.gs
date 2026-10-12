// Servidor del quiz "Repaso". Nunca borra nada: solo cambia el "estado" de las filas.
// Hojas: Subidas (preguntas subidas), Resultados (rondas), Alias (nombres unidos),
//        Premios (los cambias tú: nombre, puntos y activo = si/no), Canjes (premios pedidos)
//        y Ajustes (desde cuándo cuentan los puntos, si se empezó de cero).

// PIN para confirmar premios. CÁMBIALO por uno tuyo antes de implementar.
var PIN_PADRES = '1234';
var CAB_S = ['id','fecha','nombre','estado','xml'];
var CAB_R = ['id','fecha','datos'];
var CAB_A = ['id','fecha','tipo','de','a','estado','original'];
var CAB_P = ['id','nombre','puntos','activo'];
var CAB_J = ['clave','valor','fecha'];
var CAB_V = ['id','fecha','preguntaId','datos','estado'];
var CAB_C = ['id','fecha','premioId','nombre','puntos','estado','resuelto'];
var PREMIOS_INICIALES = [
  ['pantalla','1 hora extra de pantalla el fin de semana',400],['comida','Pedir comida a domicilio (eliges tú)',700],
  ['tareas','Un día sin tareas de casa',800],['euros5','5 €',1000],['euros10','10 €',1800],
  ['cena','Merienda o cena fuera con una amiga',2000],['pijamas','Fiesta de pijamas en casa',2500],['euros20','20 €',3500],
  ['tarjeta','Tarjeta regalo de 25 € de tu tienda favorita',4500],['cine','Cine con amigas: entradas y palomitas',5000],
  ['euros50','50 €',8000],['ropa','Ropa o zapatillas que elijas (hasta 60 €)',10000],['auriculares','Auriculares inalámbricos',12000],
  ['parque','Día en un parque de atracciones o acuático',15000],['gran','Gran premio: lo que tú elijas hasta 150 €',25000]
];
// La primera lista (más infantil). Si la hoja sigue exactamente con ella, se cambia sola por la nueva.
var PREMIOS_V1 = 'postre,peli,pantalla,tarea,plan,merienda,amiga,libro,cine,capricho,actividad';

// La app pide primero un índice ligero (v=2): las subidas sin el XML y solo las rondas nuevas desde la última vez.
// Luego descarga el XML solo de las subidas que aún no tiene guardadas (?xml=id1,id2…).
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.xml) return json({ok:true, xml:xmlDe(String(p.xml).split(','))});
  var ligera = p.v === '2';
  var hs = hoja('Subidas', CAB_S);
  var subidas = filas(hs, ligera ? 4 : 5)
    .filter(function(f){ return f[3] === 'activa'; })
    .map(function(f){ var o = {id:String(f[0]), fecha:String(f[1]), nombre:String(f[2])}; if (!ligera) o.xml = String(f[4]); return o; });
  var res = resultadosDesde(ligera ? String(p.desde || '') : '');
  var alias = filas(hoja('Alias', CAB_A))
    .filter(function(f){ return f[5] === 'activa'; })
    .map(function(f){ return {id:String(f[0]), tipo:String(f[2]), de:String(f[3]), a:String(f[4]), original:String(f[6])}; });
  var premios = filas(hojaPremios())
    .filter(function(f){ return String(f[1]) && String(f[3]).toLowerCase() !== 'no'; })
    .map(function(f){ return {id:String(f[0]), nombre:String(f[1]), puntos:Number(f[2]) || 0}; });
  var canjes = filas(hoja('Canjes', CAB_C))
    .map(function(f){ return {id:String(f[0]), fecha:String(f[1]), premioId:String(f[2]), nombre:String(f[3]), puntos:Number(f[4]) || 0, estado:String(f[5]), resuelto:String(f[6])}; });
  return json({ok:true, v:2, subidas:subidas, resultados:res.lista, hasta:res.hasta, parcial:!!(ligera && p.desde),
    alias:alias, premios:premios, canjes:canjes, ajustes:ajustes(), avisos:avisos()});
}
// Rondas guardadas después de «desde» (las filas van en orden, así que solo se leen las del final)
function resultadosDesde(desde) {
  var h = hoja('Resultados', CAB_R), n = h.getLastRow();
  if (n < 2) return {lista:[], hasta:desde};
  var fechas = h.getRange(2, 2, n - 1, 1).getValues();
  var i = 0;
  if (desde) { i = fechas.length; while (i > 0 && String(fechas[i - 1][0]) > desde) i--; }
  var hasta = String(fechas[fechas.length - 1][0]) || desde;
  if (i >= fechas.length) return {lista:[], hasta:hasta};
  var lista = h.getRange(i + 2, 3, fechas.length - i, 1).getValues()
    .map(function(f){ try { return JSON.parse(f[0]); } catch(e) { return null; } })
    .filter(function(r){ return r; });
  return {lista:lista, hasta:hasta};
}
function xmlDe(ids) {
  var h = hoja('Subidas', CAB_S), n = h.getLastRow(), out = {};
  if (n < 2) return out;
  var col = h.getRange(2, 1, n - 1, 1).getValues();
  ids = ids.slice(0, 40);
  col.forEach(function(f, i){ var id = String(f[0]); if (ids.indexOf(id) >= 0) out[id] = String(h.getRange(i + 2, 5, 1, 1).getValues()[0][0]); });
  return out;
}
// Avisos de «creo que mi respuesta está bien» que aún no se han revisado
function avisos() {
  return filas(hoja('Avisos', CAB_V))
    .filter(function(f){ return f[4] === 'pendiente'; })
    .map(function(f){ var o = {}; try { o = JSON.parse(f[3]); } catch(e) {} o.id = String(f[0]); o.fecha = String(f[1]); o.preguntaId = String(f[2]); return o; });
}
function ajustes() {
  var o = {};
  filas(hoja('Ajustes', CAB_J)).forEach(function(f){ o[String(f[0])] = String(f[1]); });
  return o;
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
      // «recibido»: hora real del servidor, para que no valga cambiar la fecha del móvil
      var dd = d.datos || {}; dd.recibido = new Date().toISOString();
      var datos = JSON.stringify(dd);
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
    if (d.accion === 'aviso') {
      var dv = d.datos || {}, txt = JSON.stringify(dv);
      if (!dv.preguntaId || txt.length > 4000) return json({ok:false, error:'datos incompletos'});
      var hv = hoja('Avisos', CAB_V);
      // si ya hay un aviso pendiente de esa pregunta, no se repite
      var ya2 = filas(hv).some(function(f){ return String(f[2]) === String(dv.preguntaId) && f[4] === 'pendiente'; });
      if (!ya2) hv.appendRow([Utilities.getUuid(), new Date().toISOString(), texto(dv.preguntaId, 80), txt, 'pendiente']);
      return json({ok:true});
    }
    if (d.accion === 'resolverAviso') {
      var ok4 = cambiarEstado(hoja('Avisos', CAB_V), String(d.id || ''), 'revisado', 5);
      return json(ok4 ? {ok:true} : {ok:false, error:'no se ha encontrado'});
    }
    if (d.accion === 'reiniciar') {
      // Empezar de cero: los puntos, rondas y medallas cuentan desde ahora. No se borra nada; con «deshacer» vuelve todo.
      if (String(d.pin || '') !== String(PIN_PADRES)) return json({ok:false, error:'PIN incorrecto'});
      var ahora = new Date().toISOString();
      hoja('Ajustes', CAB_J).appendRow(['inicio', d.deshacer ? '' : ahora, ahora]);
      return json({ok:true});
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
  } else if (filas(h).map(function(f){ return String(f[0]); }).join(',') === PREMIOS_V1) {
    h.deleteRows(2, h.getLastRow() - 1);
    PREMIOS_INICIALES.forEach(function(p){ h.appendRow([p[0], p[1], p[2], 'si']); });
  }
  return h;
}
function filas(h, cols) { var n = h.getLastRow(); return n < 2 ? [] : h.getRange(2, 1, n - 1, cols || h.getLastColumn()).getValues(); }
function cambiarEstado(h, id, estado, col) {
  var ids = filas(h).map(function(f){ return String(f[0]); });
  var i = ids.indexOf(id);
  if (i < 0) return false;
  h.getRange(i + 2, col).setValue(estado);
  return true;
}
function texto(v, max) { var s = String(v == null ? '' : v).slice(0, max); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function json(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
