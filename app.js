(function(){
'use strict';

const VERSION='6';
const CONFIG=Object.assign({servidor:'',repo:'',rama:'main',carpeta:'preguntas'},window.REPEPASO_CONFIG||{});

const LS={cache:'repaso.cache.v3',resultados:'repaso.resultados.v1',filtro:'repaso.filtro.v1',num:'repaso.num.v1',borrador:'repaso.borrador.v1',imp:'repaso.importar.v1'};
const TODOS='__todos__';
const MAX_XML=45000;
const ls={
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}},
  del(k){try{localStorage.removeItem(k)}catch(e){}}
};

/* ---------- utilidades ---------- */
const $=s=>document.querySelector(s);
const app=$('#app');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s==null?'':s).trim().replace(/\s+/g,' ');
const hashN=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return h>>>0};
const unicos=a=>Array.from(new Set(a.filter(Boolean))).sort((x,y)=>x.localeCompare(y,'es',{numeric:true}));
const barajar=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const pick=a=>a[Math.floor(Math.random()*a.length)];
const pct=(a,b)=>b?Math.round(a/b*100):0;
const fecha=iso=>{try{return new Date(iso).toLocaleDateString('es-ES',{day:'numeric',month:'long'})}catch(e){return ''}};
const fechaHora=iso=>{try{return new Date(iso).toLocaleString('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}catch(e){return ''}};
const slug=s=>norm(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[ºª]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const nuevoId=()=>'q'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const ic=n=>'<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-'+n+'"/></svg>';
const plural=(n,s,p)=>n+' '+(n===1?s:p);
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),3400)}
function descargar(contenido,nombre,tipo){
  const url=URL.createObjectURL(new Blob([contenido],{type:tipo+';charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=nombre;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function aviso(tipo,html){return '<div class="aviso '+tipo+'" role="status">'+ic(tipo==='err'?'alert':'info')+'<div>'+html+'</div></div>'}
const unicosOrden=a=>a.filter((x,i)=>a.findIndex(y=>y.toLowerCase()===x.toLowerCase())===i);
/* Texto de la respuesta correcta, sea de opciones o escrita */
const correctaDe=q=>q.tipo==='escrita'?(q.respuestas||[])[0]||'':q.opciones[q.correcta];

/* ---------- respuesta escrita: ¿lo que ha escrito vale? ----------
   No cuentan mayúsculas, espacios, signos ni artículos («la yegua» = «yegua»).
   Los números se comparan como números («3», «3,0», «3.0»).
   Si solo falla la tilde se da por buena, avisando. */
const ARTICULOS=/^(el|la|los|las|un|una|unos|unas|lo)\s+/;
function normEscrita(s,conTildes){
  let t=norm(s).toLowerCase().replace(/^[¿¡"'«“\s]+|[.,;:!?"'»”\s]+$/g,'').replace(/\s+/g,' ');
  if(!conTildes)t=t.normalize('NFD').replace(/[̀-̂̄-ͯ]/g,'').normalize('NFC');
  return t.replace(ARTICULOS,'');
}
const comoNumero=s=>{const t=norm(s).replace(/\s/g,'').replace(',','.');return /^[-+]?\d+(\.\d+)?$/.test(t)?parseFloat(t):null};
/* Corrección tolerante de la respuesta escrita.
   Devuelve {ok, tipo, forma}:  tipo = 'exacto' | 'tilde' | 'orto' (falta de ortografía) | 'parcial' (más corta que la completa)
   - Los números se comparan como números y nunca se aproximan.
   - Puede sobrar o faltar alguna palabra («comunicación no verbal» ↔ «no verbal»), pero nunca un «no», «sin», «ni»…
   - Faltas que suenan igual (b/v, h, ll/y, c/z/s, g/j, qu/k) y erratas de una letra en palabras largas se aceptan avisando.
   - Si la pregunta es de ortografía (exacta="si"), solo se perdona la tilde. */
const NEGACIONES=new Set(['no','ni','sin','nunca','jamas','tampoco','nada','nadie','ningun','ninguna','ninguno']);
const VACIAS=new Set(['el','la','los','las','un','una','unos','unas','lo','de','del','al','a','y','e','o','u','en','que','se','es','son','por','para','con','su','sus']);
const palabrasDe=s=>normEscrita(s,false).split(/[^a-z0-9ñ]+/).filter(Boolean);
function fonetica(w){
  return w.replace(/ch/g,'§').replace(/h/g,'').replace(/ll/g,'y').replace(/[vw]/g,'b')
    .replace(/qu(?=[ei])/g,'k').replace(/gu(?=[ei])/g,'g').replace(/g(?=[ei])/g,'j')
    .replace(/c(?=[ei])/g,'s').replace(/z/g,'s').replace(/c/g,'k').replace(/q/g,'k')
    .replace(/§/g,'ch').replace(/(.)\1+/g,'$1');
}
function compararPalabra(a,b){
  if(a===b)return 'exacto';
  if(/\d/.test(a)||/\d/.test(b))return '';
  const fa=fonetica(a),fb=fonetica(b);
  if(fa===fb)return 'orto';
  const L=Math.max(a.length,b.length);
  if(L>=6&&distancia(fa,fb)<=(L>=10?2:1))return 'orto';
  return '';
}
function evaluarEscrita(valor,respuestas,exacta){
  const v=norm(valor);if(!v)return {ok:false};
  const nv=comoNumero(v);
  for(const r of respuestas){
    const nr=comoNumero(r);
    if(nr!==null){if(nv!==null&&Math.abs(nv-nr)<1e-9)return {ok:true,tipo:'exacto',forma:r};continue}
    if(normEscrita(v,true)===normEscrita(r,true))return {ok:true,tipo:'exacto',forma:r};
  }
  for(const r of respuestas)if(comoNumero(r)===null&&normEscrita(v,false)===normEscrita(r,false))return {ok:true,tipo:'tilde',forma:r};
  if(exacta)return {ok:false};
  let mejor=null;
  for(const r of respuestas){
    if(comoNumero(r)!==null)continue;
    const V=palabrasDe(v),R=palabrasDe(r);
    const neg=x=>x.filter(w=>NEGACIONES.has(w)).sort().join(' ');
    if(neg(V)!==neg(R))continue;
    const Vc=V.filter(w=>!VACIAS.has(w)),Rc=R.filter(w=>!VACIAS.has(w));
    if(!Vc.length||!Rc.length)continue;
    let orto=false;
    const casa=(w,lista)=>{for(const x of lista){const c=compararPalabra(w,x);if(c){if(c==='orto')orto=true;return true}}return false};
    const rCubiertas=Rc.filter(w=>casa(w,Vc)).length,vCubiertas=Vc.filter(w=>casa(w,Rc)).length;
    let tipo='';
    if(rCubiertas===Rc.length&&Vc.length-vCubiertas<=2)tipo=orto?'orto':'exacto';                 /* están todas (puede sobrar alguna) */
    else if(vCubiertas===Vc.length&&rCubiertas*2>=Rc.length)tipo='parcial';                        /* más corta, pero lo esencial está */
    /* entre varias formas válidas, la que más se parece a lo escrito */
    const dif=(Vc.length-vCubiertas)+(Rc.length-rCubiertas),rango=(tipo==='exacto'?0:tipo==='orto'?1:2)*100+dif;
    if(tipo&&(!mejor||rango<mejor.rango))mejor={ok:true,tipo,forma:r,orto,rango};
  }
  return mejor||{ok:false};
}

/* ---------- nombres: mismo curso/asignatura/tema aunque se escriban distinto ---------- */
/* «Tema2: Biologia», «tema 2 - biología» y «Biologia» (valenciano) dan la misma clave */
const clave=s=>norm(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'');
const numerosDe=s=>(norm(s).match(/\d+/g)||[]).map(Number).join(',');
function distancia(a,b){
  if(a===b)return 0;if(!a.length)return b.length;if(!b.length)return a.length;
  let prev=Array.from({length:b.length+1},(_,j)=>j);
  for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}
  return prev[b.length];
}
/* ¿Parecen el mismo nombre con una errata o en otro idioma parecido? Los números (Tema 2 / Tema 3) tienen que coincidir. */
function parecido(a,b){
  if(numerosDe(a)!==numerosDe(b))return 0;
  const x=clave(a).replace(/\d+/g,''),y=clave(b).replace(/\d+/g,'');
  if(!x||!y)return 0;
  if(x===y)return 1;
  const s=1-distancia(x,y)/Math.max(x.length,y.length);
  const contiene=Math.min(x.length,y.length)>=5&&(x.indexOf(y)>=0||y.indexOf(x)>=0)?.8:0;
  return Math.max(s,contiene);
}
function masParecido(nombre,lista){
  let mejor=null,nota=0;
  lista.forEach(x=>{const p=parecido(nombre,x);if(p>nota){nota=p;mejor=x}});
  return nota>=.72?mejor:null;
}
const ctxTema=(c,a)=>clave(c)+'|'+clave(a)+'|';
/* Eliminar un nombre = una «unión» con este destino especial: sus preguntas dejan de salir (se puede deshacer) */
const OCULTO='__oculto__';
const esOculto=q=>q.curso===OCULTO||q.asignatura===OCULTO||q.tema===OCULTO;
/* ¿Esta pregunta cae dentro de un nombre eliminado? (para avisar al volver a subir algo con ese nombre) */
function tocaOculto(q,o){
  if(o.tipo==='curso')return clave(q.curso)===o.de;
  if(o.tipo==='asignatura')return clave(q.asignatura)===o.de;
  return ctxTema(q.curso,q.asignatura)+clave(q.tema)===o.de;
}
/* Aplica las uniones guardadas y deja un único nombre visible por clave (el primero que apareció) */
function canonizar(listas,alias){
  const A={};(alias||[]).forEach(x=>{A[x.tipo+':'+x.de]=x.a});
  const canon={};
  const res=(tipo,ctx,nombre)=>{
    let k=ctx+clave(nombre);const vistos={};
    while(A[tipo+':'+k]&&!vistos[k]){vistos[k]=1;nombre=A[tipo+':'+k];k=ctx+clave(nombre)}
    const ck=tipo+':'+k;if(!canon[ck])canon[ck]=nombre;return canon[ck];
  };
  listas.forEach(l=>l.forEach(q=>{
    if(!q.curso||!q.asignatura)return;
    q.curso=res('curso','',q.curso);
    q.asignatura=res('asignatura','',q.asignatura);
    if(q.tema)q.tema=res('tema',ctxTema(q.curso,q.asignatura),q.tema);
  }));
}
function irA(sel){const el=$(sel);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}

/* ---------- servidor (Google Apps Script) ---------- */
async function servidorGet(){
  if(!CONFIG.servidor)return null;
  try{
    const r=await fetch(CONFIG.servidor+(CONFIG.servidor.indexOf('?')>=0?'&':'?')+'t='+Date.now());
    if(!r.ok)return null;const j=await r.json();return j&&j.ok?j:null;
  }catch(e){return null}
}
function servidorPost(datos){return red(servidorPost0(datos))}
async function servidorPost0(datos){
  if(!CONFIG.servidor)throw new Error('el servidor no está configurado');
  let j;
  try{
    const r=await fetch(CONFIG.servidor,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(datos)});
    j=await r.json();
  }catch(e){throw new Error('no hay conexión con el servidor')}
  if(!j||!j.ok)throw new Error((j&&j.error)||'el servidor no ha respondido bien');
  return j;
}

/* ---------- GitHub (XML de base en la carpeta del repositorio, opcional) ---------- */
function repo(){
  if(CONFIG.repo)return CONFIG.repo;
  const m=location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);if(!m)return '';
  const seg=location.pathname.split('/').filter(Boolean)[0];
  return (seg&&!/\.html?$/i.test(seg))?m[1]+'/'+seg:m[1]+'/'+m[1]+'.github.io';
}
async function listarArchivos(){
  const r=repo();
  if(r){
    try{
      const res=await fetch('https://api.github.com/repos/'+r+'/contents/'+CONFIG.carpeta+'?ref='+CONFIG.rama,{cache:'no-cache'});
      if(res.ok){
        const j=await res.json();
        if(Array.isArray(j))return j.filter(f=>f.type==='file'&&/\.xml$/i.test(f.name)&&!/^plantilla/i.test(f.name))
          .map(f=>({nombre:f.name,sha:f.sha,url:f.download_url+'?v='+f.sha.slice(0,10)}));
      }
      if(res.status===404)return [];
    }catch(e){}
  }
  try{
    const res=await fetch(CONFIG.carpeta+'/indice.json',{cache:'no-cache'});
    if(res.ok){const l=await res.json();return l.filter(n=>/\.xml$/i.test(n)).map(n=>({nombre:n,sha:'',url:CONFIG.carpeta+'/'+encodeURIComponent(n)}))}
  }catch(e){}
  return null;
}

/* ---------- lectura y validación de XML ---------- */
const SI=/^(si|sí|true|1|yes|correcta|x)$/i;
const hijos=(n,nombres)=>Array.from(n.children).filter(c=>nombres.indexOf(c.localName.toLowerCase())>=0);
const esVF=q=>q.tipo!=='escrita'&&q.opciones.length===2&&/^verdadero$/i.test(q.opciones[0])&&/^falso$/i.test(q.opciones[1]);
/* Limpia lo que pega la IA: quita texto alrededor y bloques ```, arregla los & sueltos */
/* Limpia lo que pega la IA: quita texto alrededor y bloques ```, arregla los & sueltos.
   Si la respuesta se cortó a medias (pasa con la versión gratis de ChatGPT), se queda con las
   preguntas completas, quita la última a medias y cierra el archivo. */
/* Limpia lo que se pega de la IA y reconstruye un XML válido.
   No importa cómo venga: con marcos de código (```xml), partido en varios bloques, con texto de la IA
   entre medias, con varias cabeceras <?xml…?>, empezando o acabando a mitad de una pregunta…
   Se buscan las <pregunta>…</pregunta> completas, cada una con su curso/asignatura/tema, y se
   monta un archivo nuevo. Lo que no está completo se descarta. Si falta curso, asignatura o tema,
   se usan los del paso 1 (def). */
function arreglarXMLInfo(t,def){
  def=def||{};
  t=String(t||'').replace(/^﻿/,'').replace(/[​-‍⁠]/g,'').replace(/ /g,' ');
  /* Al copiar desde ChatGPT a veces llegan los símbolos «escapados»: \<pregunta\> o &lt;pregunta&gt; */
  t=t.replace(/\\([<>"'_*#=\-\[\]()?!.\\])/g,'$1');
  if(!/<(banco|pregunta)[\s>]/i.test(t)&&/&lt;(banco|pregunta)/i.test(t))t=t.replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'");
  /* marcos de código (``` o ~~~, con o sin «xml») */
  t=t.replace(/(`{3,}|~{3,})[ \t]*[a-z]*/gi,'\n');
  /* comillas tipográficas en los atributos (nombre=“…”) */
  t=t.replace(/=\s*[“”„«‘’]([^“”„»‘’]*)[“”„»‘’]/g,'="$1"');
  const info={cortado:false,descartada:false,inicioCortado:false,malas:0,conDatosPaso1:false};
  const ini=t.search(/<pregunta[\s>]/i),fin1=t.search(/<\/pregunta>/i);
  if(fin1>=0&&(ini<0||fin1<ini))info.inicioCortado=true;
  /* recorrer etiquetas de contexto y preguntas completas, en orden */
  const ctx={curso:'',asignatura:'',tema:''},trozos=[];
  const re=/<(curso|asignatura|tema)\b([^>]*)>|<pregunta\b[^>]*>[\s\S]*?<\/pregunta>/gi;let m,ultimo=0;
  const attr=(a,n)=>{const x=new RegExp('\\b'+n+'\\s*=\\s*"([^"]*)"','i').exec(a)||new RegExp("\\b"+n+"\\s*=\\s*'([^']*)'",'i').exec(a);return x?x[1]:''};
  while((m=re.exec(t))){
    ultimo=re.lastIndex;
    if(m[1]){const v=attr(m[2],'nombre');if(v){ctx[m[1].toLowerCase()]=v;if(m[1].toLowerCase()==='curso'){ctx.asignatura='';ctx.tema=''}else if(m[1].toLowerCase()==='asignatura')ctx.tema=''}continue}
    let q=m[0];
    /* si dentro hay otra <pregunta (la anterior quedó a medias), quedarse con la última */
    const dentro=[...q.slice(1).matchAll(/<pregunta[\s>]/gi)];
    if(dentro.length){q=q.slice(dentro[dentro.length-1].index+1);info.malas+=dentro.length}
    const abre=/^<pregunta\b[^>]*>/i.exec(q)[0];
    let nuevaAbre=abre;
    ['curso','asignatura','tema'].forEach(c=>{
      if(attr(abre,c))return;
      let v=ctx[c];if(!v&&def[c]){v=def[c];info.conDatosPaso1=true}
      if(v)nuevaAbre=nuevaAbre.replace(/>$/,' '+c+'="'+v.replace(/"/g,'&quot;')+'">');
    });
    q=nuevaAbre+q.slice(abre.length);
    q=q.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi,'&amp;');
    /* cada pregunta tiene que ser XML válido por sí sola; si no, se descarta */
    const d=new DOMParser().parseFromString(q,'application/xml');
    if(d.getElementsByTagName('parsererror').length){info.malas++;if(!info.detalle)info.detalle=norm(d.getElementsByTagName('parsererror')[0].textContent).slice(0,200)+' · En: '+norm(q).slice(0,80);continue}
    trozos.push(q);
  }
  const resto=t.slice(ultimo);
  if(/<pregunta[\s>]/i.test(resto)){info.cortado=true;info.descartada=true}
  else if(trozos.length&&!/<\/banco>/i.test(resto))info.cortado=true;
  if(!trozos.length&&/<pregunta[\s>]/i.test(t))info.sinCompletas=true;
  info.n=trozos.length;
  info.xml='<?xml version="1.0" encoding="UTF-8"?>\n<banco>\n'+trozos.join('\n')+'\n</banco>';
  return info;
}
const arreglarXML=t=>arreglarXMLInfo(t).xml;
function heredar(n,campo){
  let el=n;
  while(el&&el.nodeType===1){
    const v=el.getAttribute(campo);if(v&&v.trim())return norm(v);
    if(el!==n&&el.localName.toLowerCase()===campo){const nm=el.getAttribute('nombre');if(nm&&nm.trim())return norm(nm)}
    el=el.parentNode;
  }
  return '';
}
function leerPregunta(n){
  const curso=heredar(n,'curso'),asignatura=heredar(n,'asignatura'),tema=heredar(n,'tema');
  const en=hijos(n,['enunciado'])[0];const enunciado=norm(en?en.textContent:n.getAttribute('texto'));
  let ops=hijos(n,['opcion','opción']).map(o=>({t:norm(o.textContent),c:SI.test((o.getAttribute('correcta')||'').trim())})).filter(o=>o.t);
  const resp=(n.getAttribute('respuesta')||'').trim().toLowerCase();
  if(!ops.length&&resp){const v=/^(v|verdadero|true|si|sí)/.test(resp);ops=[{t:'Verdadero',c:v},{t:'Falso',c:!v}]}
  const ex=hijos(n,['explicacion','explicación'])[0];
  /* respuesta escrita: una o varias <respuesta> con las formas válidas («3», «tres») */
  const escritas=hijos(n,['respuesta']).map(r=>norm(r.textContent)).filter(Boolean);
  const escrita=escritas.length>0||/^escrit/i.test(n.getAttribute('tipo')||'');
  const q={id:norm(n.getAttribute('id')),curso,asignatura,tema,enunciado,
    opciones:escrita?[]:ops.map(o=>o.t),correcta:escrita?-1:ops.findIndex(o=>o.c),nCorrectas:escrita?0:ops.filter(o=>o.c).length,
    explicacion:ex?norm(ex.textContent):''};
  if(escrita){q.tipo='escrita';q.respuestas=escritas;q.exacta=SI.test((n.getAttribute('exacta')||'').trim())}
  if(!q.id){q.id=idDe(q);q.idAuto=true}
  return q;
}
/* id estable a partir de los nombres (ya normalizados) y el enunciado: la misma pregunta no se duplica */
function idDe(q){
  return (q.curso&&q.asignatura&&q.tema&&q.enunciado)?'q'+hashN([clave(q.curso),clave(q.asignatura),clave(q.tema),clave(q.enunciado)].join('|')).toString(36):nuevoId();
}
function errorDe(q){
  const falta=['curso','asignatura','tema','enunciado'].filter(k=>!norm(q[k]));
  if(falta.length)return 'falta '+falta.join(', ').replace('enunciado','la pregunta');
  if(q.tipo==='escrita')return (q.respuestas||[]).some(r=>norm(r))?'':'falta la respuesta correcta';
  if(q.opciones.filter(o=>norm(o)).length<2)return 'necesita al menos 2 respuestas';
  if(q.nCorrectas>1)return 'tiene más de una respuesta marcada como correcta';
  if(q.correcta<0||!norm(q.opciones[q.correcta]))return 'no tiene marcada la respuesta correcta';
  return '';
}
function limpiar(q){
  if(q.tipo==='escrita')return {id:q.id,idAuto:!!q.idAuto,tipo:'escrita',curso:norm(q.curso),asignatura:norm(q.asignatura),tema:norm(q.tema),enunciado:norm(q.enunciado),
    opciones:[],correcta:-1,respuestas:unicosOrden((q.respuestas||[]).map(norm).filter(Boolean)),exacta:!!q.exacta,explicacion:norm(q.explicacion)};
  const keep=[];q.opciones.forEach((o,i)=>{if(norm(o))keep.push(i)});
  return {id:q.id,idAuto:!!q.idAuto,curso:norm(q.curso),asignatura:norm(q.asignatura),tema:norm(q.tema),enunciado:norm(q.enunciado),
    opciones:keep.map(i=>norm(q.opciones[i])),correcta:keep.indexOf(q.correcta),explicacion:norm(q.explicacion)};
}
const etiqueta=(q,i)=>q.enunciado?'«'+q.enunciado.slice(0,60)+(q.enunciado.length>60?'…':'')+'»':'Pregunta '+(i+1);
function parsearXML(txt,archivo){
  const doc=new DOMParser().parseFromString(txt,'application/xml');
  if(doc.getElementsByTagName('parsererror').length){
    const e=new Error('El texto no es un XML válido: puede que esté incompleto o que falte cerrar alguna etiqueta.');
    e.xml=true;e.detalle=norm(doc.getElementsByTagName('parsererror')[0].textContent).slice(0,300);throw e;
  }
  const todas=Array.from(doc.getElementsByTagName('pregunta')).map(leerPregunta);
  const ok=[],errores=[];
  if(!todas.length)errores.push('No hay ninguna <pregunta> en el texto.');
  todas.forEach((q,i)=>{const e=errorDe(q);if(e)errores.push(etiqueta(q,i)+': '+e+'.');else ok.push(Object.assign(limpiar(q),{archivo}))});
  return {ok,errores,todas};
}
function aXML(P){
  const x=s=>esc(s);
  const out=['<?xml version="1.0" encoding="UTF-8"?>','<banco>'],arbol={};
  P.forEach(q=>{const c=arbol[q.curso]=arbol[q.curso]||{};const a=c[q.asignatura]=c[q.asignatura]||{};(a[q.tema]=a[q.tema]||[]).push(q)});
  Object.keys(arbol).forEach(c=>{
    out.push('  <curso nombre="'+x(c)+'">');
    Object.keys(arbol[c]).forEach(a=>{
      out.push('    <asignatura nombre="'+x(a)+'">');
      Object.keys(arbol[c][a]).forEach(t=>{
        out.push('      <tema nombre="'+x(t)+'">');
        arbol[c][a][t].forEach(q=>{
          if(esVF(q)){
            out.push('        <pregunta id="'+x(q.id)+'" respuesta="'+(q.correcta===0?'verdadero':'falso')+'">','          <enunciado>'+x(q.enunciado)+'</enunciado>');
          }else if(q.tipo==='escrita'){
            out.push('        <pregunta id="'+x(q.id)+'" tipo="escrita"'+(q.exacta?' exacta="si"':'')+'>','          <enunciado>'+x(q.enunciado)+'</enunciado>');
            q.respuestas.forEach(r=>out.push('          <respuesta>'+x(r)+'</respuesta>'));
          }else{
            out.push('        <pregunta id="'+x(q.id)+'">','          <enunciado>'+x(q.enunciado)+'</enunciado>');
            q.opciones.forEach((o,i)=>out.push('          <opcion'+(i===q.correcta?' correcta="si"':'')+'>'+x(o)+'</opcion>'));
          }
          if(q.explicacion)out.push('          <explicacion>'+x(q.explicacion)+'</explicacion>');
          out.push('        </pregunta>');
        });
        out.push('      </tema>');
      });
      out.push('    </asignatura>');
    });
    out.push('  </curso>');
  });
  out.push('</banco>');
  return out.join('\n')+'\n';
}

/* ---------- datos ---------- */
const Datos={
  base:[],extra:[],archivos:[],subidas:[],resSrv:[],alias:[],premios:[],canjes:[],fecha:null,estado:'cargando',servidorOk:false,
  async cargar(forzar){
    this.estado='cargando';
    const cache=ls.get(LS.cache,null)||{};
    const [lista,srv]=await Promise.all([listarArchivos(),servidorGet()]);
    let archivos=cache.archivos||[];
    if(lista){
      const prev={};archivos.forEach(a=>{prev[a.nombre]=a});
      archivos=await Promise.all(lista.map(async a=>{
        const p=prev[a.nombre];
        if(!forzar&&a.sha&&p&&p.sha===a.sha)return p;
        try{
          const r=await fetch(a.url,{cache:'no-cache'});
          if(!r.ok)throw new Error('No se ha podido descargar ('+r.status+').');
          const res=parsearXML(await r.text(),a.nombre);
          return {nombre:a.nombre,sha:a.sha,preguntas:res.ok,errores:res.errores,todas:res.todas};
        }catch(e){return (e.xml||!p)?{nombre:a.nombre,sha:a.sha,preguntas:[],errores:[e.message],todas:[]}:p}
      }));
    }
    const enLinea=!!(lista||srv);
    const c={fecha:enLinea?new Date().toISOString():cache.fecha,archivos,
      subidas:srv?srv.subidas||[]:cache.subidas||[],resSrv:srv?srv.resultados||[]:cache.resSrv||[],
      alias:srv?srv.alias||[]:cache.alias||[],
      premios:srv?srv.premios||[]:cache.premios||[],canjes:srv?srv.canjes||[]:cache.canjes||[]};
    if(enLinea)ls.set(LS.cache,c);
    this.usar(c);
    this.servidorOk=!!srv;
    this.estado=(!enLinea&&cache.fecha)?'offline':(this.base.length?'ok':'vacio');
    if(srv)this.sincronizar();
  },
  usar(c){
    this.archivos=c.archivos||[];this.fecha=c.fecha;this.resSrv=c.resSrv||[];this.alias=c.alias||[];
    this.premios=(c.premios||[]).map(p=>({id:String(p.id),nombre:norm(p.nombre),puntos:Math.round(+p.puntos||0)}));this.canjes=c.canjes||[];
    this.subidas=(c.subidas||[]).slice().sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))).map(s=>{
      let r;try{r=parsearXML(arreglarXML(s.xml),s.nombre)}catch(e){r={ok:[],errores:[e.message],todas:[]}}
      return {id:s.id,nombre:s.nombre||'Sin nombre',fecha:s.fecha,preguntas:r.ok,errores:r.errores,todas:r.todas};
    });
    const todos=this.archivos.concat(this.subidas);
    canonizar(todos.map(a=>a.preguntas).concat(todos.map(a=>a.todas||[])),this.alias);
    const m=new Map();
    todos.forEach(a=>a.preguntas.forEach(q=>{q.archivo=a.nombre;m.set(q.id,q)}));
    this.base=Array.from(m.values()).filter(q=>!esOculto(q));
  },
  todas(){
    if(!this.extra.length)return this.base;
    const m=new Map();this.base.forEach(q=>m.set(q.id,q));this.extra.forEach(q=>m.set(q.id,q));
    return Array.from(m.values());
  },
  /* resultados de este dispositivo + los del servidor (todos los dispositivos) */
  resultados(){
    const m=new Map();
    this.resSrv.concat(ls.get(LS.resultados,[])).forEach(r=>{if(r&&r.fecha)m.set(r.id||r.fecha,r)});
    return Array.from(m.values()).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
  },
  guardarResultado(r){
    r.id=nuevoId();r.enviado=false;
    const a=ls.get(LS.resultados,[]);a.push(r);ls.set(LS.resultados,a);
    if(CONFIG.servidor)this.enviar(r);
  },
  enviar(r){
    const datos=Object.assign({},r);delete datos.enviado;
    servidorPost({accion:'resultado',datos}).then(()=>{
      const a=ls.get(LS.resultados,[]);a.forEach(x=>{if(x.id===r.id)x.enviado=true});ls.set(LS.resultados,a);
      if(!this.resSrv.some(x=>x.id===r.id))this.resSrv.push(datos);
    }).catch(()=>{});
  },
  sincronizar(){ls.get(LS.resultados,[]).filter(r=>r.id&&r.enviado===false).forEach(r=>this.enviar(r))}
};
{const c=Datos.cargar;Datos.cargar=function(f){return red(c.call(this,f))}}
async function subirXML(lista,nombre,reemplaza){
  const xml=aXML(lista);
  if(xml.length>MAX_XML)throw new Error('son demasiadas preguntas de una vez; súbelas en dos partes');
  const j=await servidorPost({accion:'subir',nombre,xml,reemplaza:reemplaza||''});
  await Datos.cargar();
  return j;
}
/* ---------- botones ocupados ----------
   Cualquier acción que tarda (habla con el servidor, lee el portapapeles…) devuelve una promesa.
   Mientras dura, su botón se desactiva y cambia el texto: «Guardando…», «Recuperando…», etc. */
function ocupado(btn,p,texto){
  if(!btn||!p||typeof p.then!=='function')return p;
  const antes=btn.innerHTML;
  btn.setAttribute('aria-busy','true');btn.disabled=true;
  btn.innerHTML='<span class="puntos">'+esc(texto||'Un momento')+'</span>';
  return Promise.resolve(p).finally(()=>{if(document.body.contains(btn)){btn.removeAttribute('aria-busy');btn.disabled=false;btn.innerHTML=antes}});
}
function conBoton(btn,texto,fn){return ocupado(btn,fn(),texto.replace(/…$/,''))}
const OCUPADO={actualizar:'Actualizando',subirImp:'Guardando',guardarNombre:'Guardando',unirFicha:'Uniendo',eliminarFicha:'Eliminando',
  unirPar:'Uniendo',canjear:'Pidiendo',resolverCanje:'Guardando',retirarEd:'Quitando',pegarResp:'Pegando',
  deshacerAlias:el=>/recuperar/i.test(el.textContent)?'Recuperando':'Deshaciendo'};
const etiquetaOcupado=(a,el)=>typeof OCUPADO[a]==='function'?OCUPADO[a](el):(OCUPADO[a]||'Un momento');
/* Barra fina bajo la cabecera mientras se habla con el servidor */
let pendientes=0;
function red(p){pendientes++;marcarCarga();return Promise.resolve(p).finally(()=>{pendientes--;marcarCarga()})}
function marcarCarga(){const c=$('#carga');if(c)c.classList.toggle('on',pendientes>0)}
const FRASE='La paciencia es la madre de todas las ciencias';
const splash=(peq)=>'<div class="splash'+(peq?' peq':'')+'" role="status">'+(peq?'':'<p class="splash-marca">re<b>PEPA</b>so</p>')+
  '<div class="linea carga-linea" aria-hidden="true"><i></i></div><p class="splash-t">Cargando…</p><p class="splash-f">'+FRASE+'</p></div>';

/* ---------- estado y navegación ---------- */
const E={mes:0,soloFallos:ls.get('repaso.soloFallos.v1',false),pant:'inicio',filtro:ls.get(LS.filtro,{curso:TODOS,asignatura:TODOS,tema:TODOS}),num:ls.get(LS.num,10),sesion:null,ed:null,
  imp:Object.assign(ls.get(LS.imp,{curso:'',asignatura:'',tema:'',n:10,xml:''}),{extra:''}),rev:null};
const PANT={inicio:()=>renderInicio(),logros:()=>renderLogros(),progreso:()=>renderProgreso(),preguntas:()=>renderPreguntas(),editor:()=>renderEditor(),importar:()=>renderImportar(),nombres:()=>renderNombres(),nombre:()=>renderNombre()};
function ir(p){
  E.pant=p;E.sesion=null;PANT[p]();
  document.querySelectorAll('.nav [data-a]').forEach(b=>{
    if(b.dataset.a===p||((p==='editor'||p==='importar'||p==='nombres'||p==='nombre')&&b.dataset.a==='preguntas'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  window.scrollTo(0,0);
}

const cumple=(q,f)=>(f.curso===TODOS||q.curso===f.curso)&&(f.asignatura===TODOS||q.asignatura===f.asignatura)&&(f.tema===TODOS||q.tema===f.tema);
function listas(P,f){
  return {
    cursos:unicos(P.map(q=>q.curso)),
    asigs:unicos(P.filter(q=>f.curso===TODOS||q.curso===f.curso).map(q=>q.asignatura)),
    temas:unicos(P.filter(q=>(f.curso===TODOS||q.curso===f.curso)&&(f.asignatura===TODOS||q.asignatura===f.asignatura)).map(q=>q.tema))
  };
}
function validarFiltro(P){
  const f=E.filtro;
  if(f.curso!==TODOS&&listas(P,f).cursos.indexOf(f.curso)<0)f.curso=TODOS;
  if(f.asignatura!==TODOS&&listas(P,f).asigs.indexOf(f.asignatura)<0)f.asignatura=TODOS;
  if(f.tema!==TODOS&&listas(P,f).temas.indexOf(f.tema)<0)f.tema=TODOS;
}
const avisoConexion=()=>Datos.estado==='offline'?aviso('info','Sin conexión. Usando las preguntas guardadas el '+fecha(Datos.fecha)+'.'):'';
const datalist=(id,arr)=>'<datalist id="'+id+'">'+unicos(arr).map(v=>'<option value="'+esc(v)+'">').join('')+'</datalist>';

/* ================= INICIO ================= */
function renderInicio(){
  if(Datos.estado==='cargando'){app.innerHTML=splash();return}
  const P=Datos.todas();
  if(!P.length){
    app.innerHTML=avisoConexion()+'<p class="eyebrow">rePEPAso</p><h1>Todavía no hay preguntas</h1><p class="sub">Añade las primeras preguntas con ayuda de una IA. Solo hay que copiar, pegar y subir.</p><button class="btn" data-a="importar">'+ic('plus')+'Añadir preguntas</button>';
    return;
  }
  validarFiltro(P);
  const f=E.filtro,L=listas(P,f),F=falladas(),enFiltro=P.filter(q=>cumple(q,f)),nFallos=enFiltro.filter(q=>F.has(q.id)).length;
  const disp=E.soloFallos?nFallos:enFiltro.length;
  const sel=(id,label,todos,lista,val)=>'<div class="field"><label class="lbl-f" for="'+id+'">'+label+'</label><select class="in" id="'+id+'"><option value="'+TODOS+'">'+todos+'</option>'+
    lista.map(v=>'<option value="'+esc(v)+'"'+(v===val?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></div>';
  app.innerHTML=avisoConexion()+
    (Datos.extra.length?aviso('info','Estás probando '+plural(Datos.extra.length,'pregunta nueva','preguntas nuevas')+' que aún no están subidas. <button class="link" data-a="quitarExtra">Dejar de probar</button>'):'')+
    bannerHoy()+
    '<p class="eyebrow">Hola, Pepa</p><h1>¿Qué repasamos hoy?</h1><p class="sub">Elige un tema o déjalo todo en «Todos» para mezclar.</p>'+
    '<div class="box">'+
      sel('fCurso','Curso','Todos los cursos',L.cursos,f.curso)+
      sel('fAsig','Asignatura','Todas las asignaturas',L.asigs,f.asignatura)+
      sel('fTema','Tema','Todos los temas',L.temas,f.tema)+
      '<div class="field"><span class="lbl-f" id="lblNum">Número de preguntas</span><div class="chips" role="group" aria-labelledby="lblNum">'+
        [[5,'5'],[10,'10'],[20,'20'],[0,'Todas']].map(n=>'<button class="chip" data-n="'+n[0]+'" aria-pressed="'+(E.num===n[0])+'">'+n[1]+'</button>').join('')+
      '</div></div>'+
      '<button class="switch" role="switch" data-a="soloFallos" aria-checked="'+E.soloFallos+'"><span>Solo las que he fallado<small>'+
        (nFallos?plural(nFallos,'pregunta pendiente de acertar','preguntas pendientes de acertar'):'No tienes fallos pendientes aquí')+'</small></span><span class="pista" aria-hidden="true"></span></button>'+
    '</div>'+
    '<p class="count"><b>'+disp+'</b> '+(disp===1?'pregunta disponible':'preguntas disponibles')+'</p>'+
    '<button class="btn" id="go"'+(disp?'':' disabled')+'>Empezar '+ic('arrow')+'</button>';
  [['curso','#fCurso'],['asignatura','#fAsig'],['tema','#fTema']].forEach(([campo,id])=>{
    $(id).onchange=e=>{E.filtro[campo]=e.target.value;ls.set(LS.filtro,E.filtro);renderInicio();$(id).focus()};
  });
  app.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{E.num=+b.dataset.n;ls.set(LS.num,E.num);renderInicio();app.querySelector('.chip[data-n="'+E.num+'"]').focus()});
  $('#go').onclick=()=>empezar(ronda(f));
}
/* Preguntas cuya última respuesta fue un fallo (en cuanto se aciertan, salen de la lista) */
function falladas(){
  const ult=new Map();
  Datos.resultados().forEach(r=>(r.detalle||[]).forEach(d=>{if(d&&d.id)ult.set(d.id,!!d.ok)}));
  const out=new Set();ult.forEach((ok,id)=>{if(!ok)out.add(id)});return out;
}
function ronda(f){
  const F=E.soloFallos?falladas():null;
  let p=barajar(Datos.todas().filter(q=>cumple(q,f)&&(!F||F.has(q.id))));if(E.num)p=p.slice(0,E.num);return p;
}

/* ================= PREGUNTA ================= */
function empezar(lista){
  if(!lista.length)return;
  E.pant='pregunta';
  E.sesion={i:0,resp:[],filtro:JSON.parse(JSON.stringify(E.filtro)),
    preguntas:lista.map(q=>{const idx=q.opciones.map((_,i)=>i);return {q,orden:esVF(q)?idx:barajar(idx)}})};
  renderPregunta();
}
function renderPregunta(){
  const s=E.sesion,{q,orden}=s.preguntas[s.i],n=s.preguntas.length;
  app.innerHTML=
    '<div class="qhead"><button class="icbtn" data-a="salir" aria-label="Salir de la ronda">'+ic('x')+'</button>'+
    '<div class="linea" aria-hidden="true"><i style="width:'+(s.i/n*100)+'%"></i></div><span class="qn" aria-label="Pregunta '+(s.i+1)+' de '+n+'">'+(s.i+1)+'/'+n+'</span></div>'+
    '<p class="eyebrow">'+esc(q.asignatura)+' · '+esc(q.tema)+'</p>'+
    '<p class="enun" id="enun">'+esc(q.enunciado)+'</p>'+
    (q.tipo==='escrita'
      ?'<form class="escrita" id="fEsc" autocomplete="off"><label class="sr" for="rEsc">Tu respuesta</label>'+
        '<input class="in" id="rEsc" placeholder="Escribe tu respuesta" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"'+
        ((q.respuestas||[]).every(r=>comoNumero(r)!==null)?' inputmode="decimal"':'')+'>'+
        '<button class="btn" type="submit">'+ic('check')+'Comprobar</button></form>'
      :'<div class="opts" role="group" aria-labelledby="enun">'+orden.map((oi,k)=>'<button class="opt" data-o="'+oi+'"><span class="l">'+'ABCDEF'.charAt(k)+'</span><span>'+esc(q.opciones[oi])+'</span></button>').join('')+'</div>')+
    '<div id="fb" aria-live="polite"></div>';
  app.querySelectorAll('.opt').forEach(b=>b.onclick=()=>responder(+b.dataset.o));
  const f=$('#fEsc');
  if(f){f.onsubmit=e=>{e.preventDefault();const v=$('#rEsc').value;if(!norm(v)){$('#rEsc').focus();return}responderEscrita(v)};try{$('#rEsc').focus({preventScroll:true})}catch(e){}}
  window.scrollTo(0,0);
}
const BIEN=['¡Correcto!','¡Muy bien!','¡Eso es!','¡Perfecto!','¡Genial!'];
function responder(oi){
  const s=E.sesion,q=s.preguntas[s.i].q;if(s.resp[s.i])return;
  const ok=oi===q.correcta;s.resp[s.i]={elegida:oi,ok};
  app.querySelectorAll('.opt').forEach(b=>{
    const o=+b.dataset.o;b.disabled=true;
    if(o===q.correcta){b.classList.add('ok');b.querySelector('.l').innerHTML=ic('check')}
    else if(o===oi){b.classList.add('ko');b.querySelector('.l').innerHTML=ic('x')}
    else b.classList.add('dim');
  });
  feedback(s,q,ok,'',q.opciones[oi]);
}
/* Respuesta escrita */
function responderEscrita(valor){
  const s=E.sesion,q=s.preguntas[s.i].q;if(s.resp[s.i])return;
  const r=evaluarEscrita(valor,q.respuestas||[],q.exacta);
  s.resp[s.i]={escrita:valor,ok:r.ok};
  const inp=$('#rEsc');inp.disabled=true;inp.classList.add(r.ok?'ok':'ko');
  const b=app.querySelector('#fEsc .btn');if(b)b.remove();
  const f=r.forma?'<b>'+esc(r.forma)+'</b>':'';
  const nota=r.tipo==='tilde'?'Fíjate en la tilde: se escribe '+f+'.':
    r.tipo==='orto'||(r.tipo==='parcial'&&r.orto)?'Bien, pero fíjate en cómo se escribe: '+f+'.':
    r.tipo==='parcial'?'La respuesta completa es '+f+'.':'';
  feedback(s,q,r.ok,nota?'<p class="fb-nota">'+nota+'</p>':'',valor);
}
/* Explicación en párrafos; «Por ejemplo…» va aparte */
function explicacionHTML(t){
  t=norm(t);if(!t)return '';
  return t.split(/(?=Por ejemplo[,:])|\n+/i).map(x=>norm(x)).filter(Boolean).map(x=>/^Por ejemplo/i.test(x)?'<p class="fb-ej">'+esc(x)+'</p>':'<p>'+esc(x)+'</p>').join('');
}
function feedback(s,q,ok,extra,tuya){
  const ultima=s.i===s.preguntas.length-1;
  app.querySelector('.linea>i').style.width=((s.i+1)/s.preguntas.length*100)+'%';
  $('#fb').innerHTML='<div class="fb'+(ok?'':' ko')+'"><div class="fb-t">'+ic(ok?'check':'x')+(ok?pick(BIEN):'No es correcta')+'</div>'+extra+
    (ok?'':'<dl class="fb-cmp">'+(norm(tuya)?'<div><dt>Tu respuesta</dt><dd>'+esc(tuya)+'</dd></div>':'')+'<div><dt>La correcta</dt><dd><b>'+esc(correctaDe(q))+'</b></dd></div></dl>')+
    (q.explicacion?'<div class="fb-exp"><p class="eyebrow">Para entenderlo</p>'+explicacionHTML(q.explicacion)+'</div>':'')+'</div>'+
    '<button class="btn" id="sig" style="margin-top:16px">'+(ultima?'Ver resultado':'Siguiente')+' '+ic('arrow')+'</button>';
  const sig=$('#sig');
  sig.onclick=()=>{if(ultima)terminar();else{s.i++;renderPregunta()}};
  try{sig.focus({preventScroll:true})}catch(e){}
  sig.scrollIntoView({behavior:'smooth',block:'nearest'});
}

/* ================= RESULTADO ================= */
function terminar(){
  const s=E.sesion,f=s.filtro,total=s.preguntas.length,aciertos=s.resp.filter(r=>r&&r.ok).length;
  const reg={fecha:new Date().toISOString(),
    curso:f.curso===TODOS?null:f.curso,asignatura:f.asignatura===TODOS?null:f.asignatura,tema:f.tema===TODOS?null:f.tema,
    total,aciertos,
    detalle:s.preguntas.map(({q},i)=>({id:q.id,curso:q.curso,asignatura:q.asignatura,tema:q.tema,ok:!!(s.resp[i]&&s.resp[i].ok)}))};
  const antes=calcularLogros();
  Datos.guardarResultado(reg);
  const L=calcularLogros(),nv=novedades(antes,L);
  E.pant='resultado';
  renderResultado(reg,nv,L);
  modalLogros(nv,L);
}
function renderResultado(reg,nv,L){
  const s=E.sesion,p=pct(reg.aciertos,reg.total);
  const msg=p>=90?['Lo tienes dominado','Sigue así.']:p>=70?['Muy bien','Ya casi lo tienes.']:p>=50?['Buen trabajo','Vas por buen camino.']:['Sigue practicando','Repasa los fallos y vuelve a intentarlo.'];
  const fallos=s.preguntas.filter((_,i)=>!(s.resp[i]&&s.resp[i].ok)).map(it=>it.q);
  app.innerHTML=
    '<p class="eyebrow">Resultado</p>'+
    '<p class="big">'+reg.aciertos+'/'+reg.total+'<small>'+p+'%</small></p>'+
    '<div class="linea" aria-hidden="true" style="margin-bottom:24px"><i style="width:'+p+'%"></i></div>'+
    '<h1>'+msg[0]+'</h1><p class="sub">'+msg[1]+'</p>'+
    celebracion(nv,L)+
    (fallos.length?'<section class="sec-block"><h2>Para repasar</h2><div class="lista">'+fallos.map(q=>'<div>'+esc(q.enunciado)+'<span class="resp">'+ic('check')+esc(correctaDe(q))+'</span>'+(q.explicacion?'<span class="fallo-x">'+esc(q.explicacion)+'</span>':'')+'</div>').join('')+'</div></section>':'')+
    '<div class="stack">'+
      (fallos.length?'<button class="btn" id="rep">'+ic('repeat')+' Repetir los fallos ('+fallos.length+')</button>':'')+
      '<button class="btn'+(fallos.length?' sec':'')+'" id="otra">Otra ronda</button>'+
      '<button class="btn sec" data-a="inicio">Cambiar de tema</button>'+
    '</div>';
  if(fallos.length)$('#rep').onclick=()=>empezar(barajar(fallos));
  $('#otra').onclick=()=>empezar(ronda(s.filtro));
  window.scrollTo(0,0);
}

/* ================= PROGRESO ================= */
function agrupar(det,clave){
  const m={};det.forEach(d=>{const k=clave(d);(m[k]=m[k]||{n:0,ok:0,k}).n++;if(d.ok)m[k].ok++});
  return Object.keys(m).map(k=>m[k]);
}
function renderProgreso(){
  const R=Datos.resultados();
  const sub=CONFIG.servidor?'Resultados de todos los dispositivos.':'Resultados guardados en este dispositivo.';
  if(!R.length){
    app.innerHTML='<p class="eyebrow">Progreso</p><h1>Mi progreso</h1><p class="sub">Aquí verás cómo vas cuando termines tu primera ronda.</p><button class="btn" data-a="inicio">Empezar a repasar '+ic('arrow')+'</button>';
    return;
  }
  let det=[];R.forEach(r=>{det=det.concat(r.detalle||[])});
  const ok=det.filter(d=>d.ok).length;
  const porAsig=agrupar(det,d=>d.asignatura).sort((a,b)=>a.k.localeCompare(b.k,'es'));
  const reforzar=agrupar(det,d=>d.asignatura+'||'+d.tema).filter(g=>g.n>=3&&pct(g.ok,g.n)<70).sort((a,b)=>pct(a.ok,a.n)-pct(b.ok,b.n)).slice(0,5);
  const barra=(nombre,g,w)=>'<div class="stat"><div class="r"><span>'+esc(nombre)+'</span><span>'+pct(g.ok,g.n)+'%</span></div><div class="linea'+(w?' w':'')+'"><i style="width:'+pct(g.ok,g.n)+'%"></i></div><small>'+g.ok+' de '+g.n+' acertadas</small></div>';
  app.innerHTML=
    '<p class="eyebrow">Progreso</p><h1>Mi progreso</h1><p class="sub">'+sub+'</p>'+
    '<div class="kpis"><div class="kpi"><b>'+R.length+'</b><small>Rondas</small></div><div class="kpi"><b>'+det.length+'</b><small>Respuestas</small></div><div class="kpi"><b>'+pct(ok,det.length)+'%</b><small>Aciertos</small></div></div>'+
    '<section class="sec-block"><h2>Por asignatura</h2>'+porAsig.map(g=>barra(g.k,g)).join('')+'</section>'+
    (reforzar.length?'<section class="sec-block"><h2>Temas para reforzar</h2>'+reforzar.map(g=>{const t=g.k.split('||');return barra(t[1]+' · '+t[0],g,true)}).join('')+'</section>':'')+
    '<section class="sec-block"><h2>Últimas rondas</h2><div>'+R.slice(-6).reverse().map(r=>{
      const que=[r.asignatura,r.tema].filter(Boolean).join(' · ')||'Todo mezclado';
      return '<div class="ses"><span>'+esc(que)+'<small>'+fechaHora(r.fecha)+'</small></span><span>'+r.aciertos+'/'+r.total+'</span></div>';
    }).join('')+'</div></section>';
}

/* ================= LOGROS: días, rachas, medallas, puntos y premios =================
   Todo se calcula a partir de las rondas guardadas (de todos los dispositivos), así sale igual en el iPhone y en el iPad.
   · Un día cuenta cuando ese día se han respondido META.preguntas y acertado META.aciertos (en una o varias rondas).
     Si falla más, solo tiene que seguir jugando: en cuanto llega a los aciertos, el día cuenta.
   · Racha = días seguidos que cuentan. Si hoy aún no ha llegado, la racha sigue viva hasta medianoche.
   · Medallas: rachas de días, cada 7/15/30 días hechos (aunque no sean seguidos), aciertos seguidos y fallos recuperados.
   · Puntos: 10 por acierto, +5 si acierta una que había fallado, +50 por día hecho y un extra por cada medalla. */
const META=Object.assign({preguntas:15,aciertos:11},CONFIG.meta||{});
const PUNTOS={acierto:10,recuperada:5,dia:50};
const MEDALLAS=[
  {id:'primera',grupo:'otras',ic:'medal',nombre:'Primera ronda',txt:'Termina tu primera ronda',pts:20,v:L=>L.rondas,meta:1},
  ...[[3,50],[7,150],[15,300],[30,600],[60,1000],[100,2000]].map(([n,p])=>({id:'racha'+n,grupo:'racha',ic:'flame',nombre:n+' días seguidos',txt:'Haz '+n+' días seguidos',pts:p,v:L=>L.mejorRacha,meta:n})),
  {id:'semana',grupo:'dias',ic:'calendar',nombre:'Semana',txt:'Cada 7 días hechos',pts:100,v:L=>L.diasHechos,cada:7},
  {id:'quincena',grupo:'dias',ic:'calendar',nombre:'Quincena',txt:'Cada 15 días hechos',pts:200,v:L=>L.diasHechos,cada:15},
  {id:'mes',grupo:'dias',ic:'calendar',nombre:'Mes',txt:'Cada 30 días hechos',pts:500,v:L=>L.diasHechos,cada:30},
  ...[[10,50],[25,150],[50,300],[100,600]].map(([n,p])=>({id:'combo'+n,grupo:'combo',ic:'bolt',nombre:n+' aciertos seguidos',txt:'Acierta '+n+' seguidas sin fallar',pts:p,v:L=>L.mejorCombo,meta:n})),
  ...[[50,500],[100,1000],[200,2000],[365,4000]].map(([n,p])=>({id:'total'+n,grupo:'dias',ic:'calendar',nombre:n+' días hechos',txt:'Completa '+n+' días en total',pts:p,v:L=>L.diasHechos,meta:n})),
  ...[[30,'Un mes jugando',200],[182,'Medio año jugando',1000],[365,'Un año jugando',3000]].map(([n,t,p])=>({id:'tiempo'+n,grupo:'tiempo',ic:'star',nombre:t,txt:'Sigue jugando '+(n===30?'un mes':n===182?'medio año':'un año')+' desde tu primera ronda',pts:p,v:L=>L.antiguedad,meta:n})),
  {id:'errores10',grupo:'otras',ic:'repeat',nombre:'Aprendo de mis fallos',txt:'Acierta 10 que habías fallado',pts:100,v:L=>L.recuperadas,meta:10},
  {id:'errores50',grupo:'otras',ic:'repeat',nombre:'Ya no se me escapan',txt:'Acierta 50 que habías fallado',pts:300,v:L=>L.recuperadas,meta:50}
];
/* Lista inicial de premios. Los de verdad se cambian en la hoja «Premios» del servidor. */
const PREMIOS_BASE=[
  ['postre','Elegir el postre o la cena',400],['peli','Elegir la película familiar',400],['pantalla','30 minutos extra de pantalla',500],
  ['tarea','Librarte de una tarea de casa',600],['plan','Plan especial con papá o mamá',1500],['merienda','Merendar fuera',1800],
  ['amiga','Invitar a una amiga a casa o a dormir',2000],['libro','Un libro o cómic que elijas',2000],['cine','Entrada de cine con una amiga',5000],
  ['capricho','Un capricho que elijas',6000],['actividad','Una actividad: escape room, patinaje…',7000]
].map(([id,nombre,puntos])=>({id,nombre,puntos}));

const diaClave=d=>{d=d instanceof Date?d:new Date(d);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const sumarDias=(k,n)=>{const p=k.split('-').map(Number);return diaClave(new Date(p[0],p[1]-1,p[2]+n))};
const vecesMedalla=(m,L)=>m.cada?Math.floor(m.v(L)/m.cada):(m.v(L)>=m.meta?1:0);

function calcularLogros(R,ahora){
  R=R||Datos.resultados();ahora=ahora||new Date();
  const L={dias:{},diasHechos:0,racha:0,mejorRacha:0,combo:0,mejorCombo:0,recuperadas:0,rondas:R.length,puntos:0,puntosRespuestas:0,hoy:diaClave(ahora)};
  const ult=new Map();
  R.forEach(r=>{
    const k=diaClave(r.fecha),d=L.dias[k]||(L.dias[k]={n:0,ok:0,hecho:false});
    const det=(r.detalle&&r.detalle.length)?r.detalle:null;
    if(det)det.forEach(x=>{
      d.n++;
      if(x.ok){
        d.ok++;L.puntosRespuestas+=PUNTOS.acierto;L.combo++;
        if(ult.get(x.id)===false){L.recuperadas++;L.puntosRespuestas+=PUNTOS.recuperada}
      }else L.combo=0;
      if(L.combo>L.mejorCombo)L.mejorCombo=L.combo;
      if(x.id)ult.set(x.id,!!x.ok);
    });
    else{d.n+=r.total||0;d.ok+=r.aciertos||0}
    if(!d.hecho&&d.n>=META.preguntas&&d.ok>=META.aciertos)d.hecho=true;
  });
  const hechos=Object.keys(L.dias).filter(k=>L.dias[k].hecho).sort();
  L.diasHechos=hechos.length;
  /* días desde la primera ronda hasta la última */
  L.antiguedad=R.length?Math.round((new Date(diaClave(R[R.length-1].fecha)+'T12:00')-new Date(diaClave(R[0].fecha)+'T12:00'))/864e5):0;
  /* mejor racha */
  let run=0,prev=null;
  hechos.forEach(k=>{run=(prev&&sumarDias(prev,1)===k)?run+1:1;if(run>L.mejorRacha)L.mejorRacha=run;prev=k});
  /* racha actual: termina hoy o, si hoy aún no está hecho, ayer */
  const hecho=k=>!!(L.dias[k]&&L.dias[k].hecho);
  let k=hecho(L.hoy)?L.hoy:sumarDias(L.hoy,-1);
  while(hecho(k)){L.racha++;k=sumarDias(k,-1)}
  const h=L.dias[L.hoy]||{n:0,ok:0,hecho:false};
  L.hoyN=h.n;L.hoyOk=h.ok;L.hoyHecho=h.hecho;
  L.faltanN=Math.max(0,META.preguntas-h.n);L.faltanOk=Math.max(0,META.aciertos-h.ok);
  L.enRiesgo=L.racha>0&&!h.hecho;
  /* medallas y puntos */
  L.medallas=MEDALLAS.map(m=>({m,veces:vecesMedalla(m,L),valor:m.v(L)}));
  L.puntos=L.puntosRespuestas+L.diasHechos*PUNTOS.dia+L.medallas.reduce((s,x)=>s+x.veces*x.m.pts,0);
  const gastado=(Datos.canjes||[]).filter(c=>c.estado!=='rechazado').reduce((s,c)=>s+(+c.puntos||0),0);
  L.gastado=gastado;L.saldo=L.puntos-gastado;
  return L;
}
/* Qué ha cambiado con la última ronda (para celebrarlo en el resultado) */
function novedades(antes,despues){
  return {
    puntos:despues.puntos-antes.puntos,
    diaHecho:!antes.hoyHecho&&despues.hoyHecho,
    racha:despues.racha>antes.racha?despues.racha:0,
    record:despues.mejorRacha>antes.mejorRacha&&despues.mejorRacha>1,
    combo:despues.mejorCombo>antes.mejorCombo&&despues.mejorCombo>=5?despues.mejorCombo:0,
    medallas:despues.medallas.filter((x,i)=>x.veces>antes.medallas[i].veces).map(x=>x.m)
  };
}
const quePasa=L=>L.hoyHecho?'Día completado':
  'Te faltan '+[L.faltanN?plural(L.faltanN,'pregunta','preguntas'):'',L.faltanOk?plural(L.faltanOk,'acierto','aciertos'):''].filter(Boolean).join(' y ');
function progresoHoy(L){
  const p=L.hoyHecho?100:Math.min(pct(L.hoyN,META.preguntas),pct(L.hoyOk,META.aciertos));
  return '<div class="hoy-l"><div class="linea" aria-hidden="true"><i style="width:'+p+'%"></i></div>'+
    '<p class="hoy-n"><span><b>'+Math.min(L.hoyN,99)+'</b>/'+META.preguntas+' preguntas</span><span><b>'+L.hoyOk+'</b>/'+META.aciertos+' aciertos</span></p></div>';
}
/* Recuadro de «hoy» en el inicio. Por la tarde avisa si la racha está en peligro. */
function bannerHoy(){
  if(!Datos.resultados().length)return '';
  const L=calcularLogros(),tarde=new Date().getHours()>=18;
  const aviso=L.enRiesgo&&tarde
    ?'<p class="hoy-aviso">'+ic('alert')+'<span>Tu racha de '+plural(L.racha,'día','días')+' se pierde a medianoche. '+quePasa(L)+'.</span></p>':'';
  return '<button class="hoy'+(aviso?' riesgo':'')+'" data-a="logros" aria-label="Hoy: '+esc(quePasa(L))+'. Ver mis logros">'+
    '<span class="hoy-c"><span class="hoy-t">'+ic(L.hoyHecho?'check':'calendar')+(L.hoyHecho?'Día completado':'Hoy')+'</span>'+
    '<span class="hoy-k">'+ic('flame')+L.racha+'<span class="sep"></span>'+ic('medal')+L.saldo.toLocaleString('es-ES')+'</span></span>'+
    progresoHoy(L)+aviso+'</button>';
}
/* Bloque de celebración en la pantalla de resultado */
function celebracion(nv,L){
  if(!nv)return '';
  let h='<section class="logro-res">';
  h+='<p class="pts-gan">+'+nv.puntos.toLocaleString('es-ES')+'<small>puntos</small></p>';
  if(nv.diaHecho)h+='<p class="logro-l">'+ic('check')+'<span><b>¡Día completado!</b> Racha de '+plural(L.racha,'día','días')+'.</span></p>';
  else if(!L.hoyHecho)h+='<p class="logro-l">'+ic('calendar')+'<span>Hoy: '+esc(quePasa(L))+' para que el día cuente.</span></p>';
  nv.medallas.forEach(m=>{h+='<p class="logro-l nueva">'+ic(m.ic)+'<span><b>Nueva medalla: '+esc(m.nombre)+'</b> +'+m.pts+' puntos</span></p>'});
  return h+'<button class="link" data-a="logros">Ver mis logros '+ic('arrow')+'</button></section>';
}

/* Modal de felicitación: cada logro (un día más de racha, un récord, una medalla…) se celebra y anima a seguir */
const ANIMO=['¡Sigue así!','Cada día cuenta. ¡Mañana más!','Lo estás haciendo genial.','La constancia es tu superpoder.','¡A por la siguiente!'];
function logrosDe(nv,L){
  const out=[];
  if(nv.diaHecho)out.push({ic:'check',t:'¡Día completado!',x:L.racha>1?'Un día más de racha: llevas '+L.racha+' días seguidos.':'Hoy ya cuenta. Vuelve mañana para empezar tu racha.'});
  if(nv.record&&!nv.medallas.some(m=>m.grupo==='racha'))out.push({ic:'flame',t:'¡Nuevo récord!',x:'Tu mejor racha ahora es de '+plural(L.mejorRacha,'día','días')+'.'});
  if(nv.combo&&!nv.medallas.some(m=>m.grupo==='combo'))out.push({ic:'bolt',t:nv.combo+' aciertos seguidos',x:'Tu mejor serie sin fallar. ¡Qué concentración!'});
  nv.medallas.forEach(m=>out.push({ic:m.ic,t:'Medalla: '+m.nombre,x:hazaña(m,L)+' +'+m.pts+' puntos.',med:true}));
  return out;
}
function hazaña(m,L){
  const n=m.meta;
  return {racha:'Has repasado '+n+' días seguidos.',combo:'Has acertado '+n+' preguntas seguidas sin fallar.',tiempo:'Llevas '+m.nombre.replace(/ jugando$/,'').toLowerCase()+' repasando con rePEPAso.'}[m.grupo]||
    (m.cada?'Ya llevas '+plural(L.diasHechos,'día completado','días completados')+'.':m.id==='primera'?'Has terminado tu primera ronda.':
     m.grupo==='dias'?'Has completado '+n+' días.':'Has acertado '+n+' preguntas que antes habías fallado.');
}
function modalLogros(nv,L){
  const lista=logrosDe(nv,L);if(!lista.length)return;
  const hay=lista.some(x=>x.med);
  const top=lista.find(x=>x.med)||lista[0];
  abrirModal('<div class="felic"><div class="felic-ic">'+ic(top.ic)+'</div>'+
    '<p class="eyebrow">'+(hay?'Nueva medalla':'Nuevo logro')+'</p><h2 id="mTit">'+esc(lista.length===1?lista[0].t:'¡'+lista.length+' logros a la vez!')+'</h2>'+
    '<div class="felic-l">'+lista.map(x=>'<div>'+ic(x.ic)+'<span><b>'+esc(x.t)+'</b>'+esc(x.x)+'</span></div>').join('')+'</div>'+
    '<p class="felic-a">'+esc(pick(ANIMO))+'</p>'+
    '<p class="pts-gan">+'+nv.puntos.toLocaleString('es-ES')+'<small>puntos esta ronda · tienes '+L.saldo.toLocaleString('es-ES')+'</small></p>'+
    '<button class="btn" data-a="cerrar">¡Seguir!</button></div>');
}

/* ---------- pantalla Logros ---------- */
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function calendario(L){
  const hoy=new Date(),base=new Date(hoy.getFullYear(),hoy.getMonth()+(E.mes||0),1);
  const y=base.getFullYear(),m=base.getMonth(),dias=new Date(y,m+1,0).getDate(),hueco=(base.getDay()+6)%7;
  let celdas='';
  for(let i=0;i<hueco;i++)celdas+='<span class="cal-d vacio"></span>';
  let hechosMes=0;
  for(let d=1;d<=dias;d++){
    const k=diaClave(new Date(y,m,d)),x=L.dias[k],cls=x?(x.hecho?' hecho':' jugado'):'';
    if(x&&x.hecho)hechosMes++;
    const est=x?(x.hecho?'día completado':'jugado, no completado ('+x.n+' preguntas, '+x.ok+' aciertos)'):'';
    celdas+='<span class="cal-d'+cls+(k===L.hoy?' es-hoy':'')+'" role="img" aria-label="'+d+' de '+MESES[m]+(k===L.hoy?', hoy':'')+(est?', '+est:'')+'">'+d+'</span>';
  }
  return '<section class="sec-block"><div class="head-row cal-h"><button class="icbtn" data-a="mesAnt" aria-label="Mes anterior">'+ic('back')+'</button>'+
    '<h2 aria-live="polite">'+MESES[m]+' '+y+'</h2>'+
    '<button class="icbtn" data-a="mesSig" aria-label="Mes siguiente"'+((E.mes||0)>=0?' disabled':'')+'>'+ic('arrow')+'</button></div>'+
    '<div class="cal" role="group" aria-label="Días de '+MESES[m]+'">'+['L','M','X','J','V','S','D'].map(x=>'<span class="cal-s" aria-hidden="true">'+x+'</span>').join('')+celdas+'</div>'+
    '<p class="cal-ley"><span><i class="cal-m hecho"></i>Completado</span><span><i class="cal-m jugado"></i>Jugado</span><span>'+plural(hechosMes,'día este mes','días este mes')+'</span></p></section>';
}
function medallasHTML(L){
  const fila=x=>{
    const m=x.m,ok=x.veces>0;
    const sig=m.cada?(m.cada-(x.valor%m.cada)):Math.max(0,m.meta-x.valor);
    const det=m.cada?(ok?'×'+x.veces+' · próxima en '+plural(sig,'día','días'):'Faltan '+plural(sig,'día','días')):
      ok?'+'+m.pts+' puntos':(m.grupo==='otras'&&m.id==='primera'?m.txt:'Llevas '+Math.min(x.valor,m.meta)+' de '+m.meta);
    return '<div class="med'+(ok?' ok':'')+'">'+ic(m.ic)+'<b>'+esc(m.nombre)+'</b><small>'+esc(det)+'</small>'+(ok?'':'<span class="sr">Aún no conseguida. '+esc(m.txt)+'</span>')+'</div>';
  };
  const grupos=[['dias','Días hechos'],['racha','Días seguidos'],['combo','Aciertos seguidos'],['tiempo','Tiempo jugando'],['otras','Otras']];
  return '<section class="sec-block"><h2>Medallas</h2>'+grupos.map(([g,t])=>'<p class="res-t">'+t+'</p><div class="meds">'+L.medallas.filter(x=>x.m.grupo===g).map(fila).join('')+'</div>').join('')+'</section>';
}
function premios(){return (Datos.premios&&Datos.premios.length?Datos.premios:PREMIOS_BASE).filter(p=>p.nombre&&+p.puntos>0).slice().sort((a,b)=>a.puntos-b.puntos)}
function premiosHTML(L){
  const C=(Datos.canjes||[]).slice().sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
  const pend=C.filter(c=>c.estado==='pendiente'),hechos=C.filter(c=>c.estado==='entregado');
  let h='<section class="sec-block" id="premios"><h2>Premios</h2>'+
    '<p class="saldo"><b>'+L.saldo.toLocaleString('es-ES')+'</b> puntos para canjear</p>';
  if(pend.length)h+='<p class="res-t">Esperando a papá o mamá</p><div>'+pend.map(c=>
    '<div class="ses"><span>'+esc(c.nombre)+'<small>'+fechaHora(c.fecha)+' · '+(+c.puntos).toLocaleString('es-ES')+' puntos</small></span>'+
    '<button class="link" data-a="confirmarCanje" data-id="'+esc(c.id)+'">Confirmar</button></div>').join('')+'</div>';
  h+='<p class="res-t">Elige un premio</p><div>'+premios().map(p=>{
    const falta=p.puntos-L.saldo;
    return '<div class="ses premio"><span>'+esc(p.nombre)+'<small>'+(+p.puntos).toLocaleString('es-ES')+' puntos</small></span>'+
      (falta>0?'<span class="falta">Te faltan '+falta.toLocaleString('es-ES')+'</span>':'<button class="btn sec mini" data-a="canjear" data-id="'+esc(p.id)+'">Canjear</button>')+'</div>';
  }).join('')+'</div>';
  if(hechos.length)h+='<p class="res-t">Ya conseguidos</p><div>'+hechos.slice(0,8).map(c=>'<div class="ses"><span>'+esc(c.nombre)+'<small>'+fechaHora(c.resuelto||c.fecha)+'</small></span><span>'+ic('check')+'</span></div>').join('')+'</div>';
  return h+'</section>';
}
function renderLogros(){
  if(Datos.estado==='cargando'){app.innerHTML=splash();return}
  const L=calcularLogros();
  app.innerHTML='<p class="eyebrow">Logros</p><h1>Mis logros</h1>'+
    '<p class="sub">Un día cuenta cuando respondes '+META.preguntas+' preguntas y aciertas '+META.aciertos+'. Puedes hacerlo en varias rondas.</p>'+
    '<div class="kpis"><div class="kpi"><b>'+L.racha+'</b><small>Racha</small></div><div class="kpi"><b>'+L.mejorRacha+'</b><small>Mejor racha</small></div><div class="kpi"><b>'+L.saldo.toLocaleString('es-ES')+'</b><small>Puntos</small></div></div>'+
    '<section class="sec-block"><h2>Hoy</h2><div class="box hoy-box"><p class="hoy-q">'+ic(L.hoyHecho?'check':'calendar')+'<b>'+esc(quePasa(L))+'</b></p>'+progresoHoy(L)+
      (L.enRiesgo?'<p class="hint">Si hoy no llegas, la racha de '+plural(L.racha,'día','días')+' vuelve a empezar.</p>':'')+
      (L.hoyHecho?'':'<button class="btn" data-a="inicio" style="margin-top:16px">Repasar '+ic('arrow')+'</button>')+'</div></section>'+
    calendario(L)+medallasHTML(L)+premiosHTML(L)+
    '<details class="ver-texto"><summary>Cómo se ganan puntos</summary><ul class="reglas">'+
      '<li><b>'+PUNTOS.acierto+'</b> por cada acierto</li><li><b>+'+PUNTOS.recuperada+'</b> si aciertas una que habías fallado</li>'+
      '<li><b>'+PUNTOS.dia+'</b> por cada día completado</li><li>Cada medalla da puntos extra</li></ul></details>';
}
async function canjear(el){
  const p=premios().find(x=>String(x.id)===el.dataset.id),L=calcularLogros();
  if(!p)return;
  if(p.puntos>L.saldo){toast('Te faltan '+(p.puntos-L.saldo)+' puntos.');return}
  if(!confirm('¿Canjear «'+p.nombre+'» por '+p.puntos+' puntos? Papá o mamá lo confirmarán.'))return;
  try{
    await servidorPost({accion:'canjear',premioId:p.id,nombre:p.nombre,puntos:p.puntos});
    await Datos.cargar();renderLogros();toast('¡Pedido! Avisa a papá o mamá.');
  }catch(e){toast(/desconocida/.test(e.message)?'Falta actualizar el código del servidor (ver INSTALAR.md).':'No se ha podido canjear: '+e.message+'.')}
}
function confirmarCanje(el){
  const c=(Datos.canjes||[]).find(x=>String(x.id)===el.dataset.id);if(!c)return;
  abrirModal('<p class="eyebrow">Solo para papá o mamá</p><h2 id="mTit" style="font-size:20px;text-transform:none;letter-spacing:0">'+esc(c.nombre)+'</h2>'+
    '<p>'+(+c.puntos).toLocaleString('es-ES')+' puntos · pedido el '+fechaHora(c.fecha)+'</p>'+
    '<div class="field"><label class="lbl-f" for="pin">PIN</label><input class="in" id="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12"></div>'+
    '<div class="stack"><button class="btn" data-a="resolverCanje" data-id="'+esc(c.id)+'" data-e="entregado">'+ic('check')+'Entregado</button>'+
    '<button class="btn sec" data-a="resolverCanje" data-id="'+esc(c.id)+'" data-e="rechazado">Rechazar y devolver los puntos</button>'+
    '<button class="link" data-a="cerrar">Cancelar</button></div>');
  const i=$('#pin');if(i)i.focus();
}
async function resolverCanje(el){
  const pin=norm(($('#pin')||{}).value);
  if(!pin){toast('Escribe el PIN.');$('#pin').focus();return}
  try{
    await servidorPost({accion:'resolverCanje',id:el.dataset.id,estado:el.dataset.e,pin});
    await Datos.cargar();cerrarModal();renderLogros();toast(el.dataset.e==='entregado'?'¡Premio entregado!':'Rechazado: los puntos vuelven.');
  }catch(e){toast(/pin/i.test(e.message)?'El PIN no es correcto.':/desconocida/.test(e.message)?'Falta actualizar el código del servidor (ver INSTALAR.md).':'No se ha podido: '+e.message+'.')}
}

/* ================= PREGUNTAS (gestión) ================= */
function filaArchivo(a,tipo){
  return '<div class="arch">'+ic('file')+'<div class="n"><b>'+esc(a.nombre)+'</b><small>'+plural(a.preguntas.length,'pregunta','preguntas')+
    (a.fecha&&tipo==='s'?' · '+fechaHora(a.fecha):'')+
    (a.errores.length?' · <span class="e">'+plural(a.errores.length,'con error','con errores')+'</span>':'')+'</small>'+
    (a.errores.length?'<ul class="errs">'+a.errores.slice(0,10).map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':'')+'</div>'+
    '<div class="acts"><button class="icbtn" data-a="editarArch" data-t="'+tipo+'" data-id="'+esc(tipo==='s'?a.id:a.nombre)+'" aria-label="Editar '+esc(a.nombre)+'">'+ic('edit')+'</button>'+
    '</div></div>';
}
function renderPreguntas(){
  let h='<p class="eyebrow">Preguntas</p><h1>Banco de preguntas</h1><p class="sub">Añade preguntas nuevas cuando empieces un tema. Las que ya hay no se borran.</p>';
  h+=avisoConexion();
  if(CONFIG.servidor&&!Datos.servidorOk&&Datos.estado!=='cargando')h+=aviso('err','No hay conexión con el servidor. Puedes repasar, pero no subir preguntas hasta que vuelva.');
  if(Datos.extra.length)h+=aviso('info','Estás probando '+plural(Datos.extra.length,'pregunta','preguntas')+' que todavía no están subidas. <button class="link" data-a="quitarExtra">Dejar de probar</button>');
  h+='<div class="stack" style="margin-bottom:40px"><button class="btn" data-a="importar">'+ic('plus')+'Añadir preguntas con IA</button><button class="btn sec" data-a="editorNuevo">'+ic('edit')+'Escribir preguntas a mano</button></div>';
  h+='<section class="sec-block"><div class="head-row"><h2>Preguntas subidas</h2><button class="link" data-a="actualizar">'+ic('refresh')+'Actualizar</button></div>';
  if(Datos.estado==='cargando')h+=splash(true);
  else{
    h+='<p class="count">'+plural(Datos.base.length,'pregunta','preguntas')+' en total'+(Datos.fecha?' · comprobado el '+fechaHora(Datos.fecha):'')+'</p>';
    const subs=Datos.subidas.slice().reverse();
    h+=subs.length?'<div>'+subs.map(a=>filaArchivo(a,'s')).join('')+'</div>':'<p class="count">Todavía no se ha subido ninguna.</p>';
    if(Datos.archivos.length)h+='<p class="res-t">Preguntas de base</p><div>'+Datos.archivos.map(a=>filaArchivo(a,'r')).join('')+'</div>';
  }
  h+='</section>';
  const repes=Datos.base.length?[].concat(...gruposNombres().map(paresParecidos)).length:0;
  h+='<section class="sec-block"><h2>Más opciones</h2><div>'+
    '<button class="lbtn" data-a="nombres">'+ic('list')+'<span>Cursos, asignaturas y temas<small>'+(repes?'<span class="e">'+plural(repes,'nombre parece repetido','nombres parecen repetidos')+'</span> · ':'')+'Unir nombres escritos de dos formas</small></span></button>'+
    '<button class="lbtn" data-a="exportarTodo">'+ic('download')+'<span>Descargar todas las preguntas<small>Copia de seguridad en un archivo XML</small></span></button>'+
    '<button class="lbtn" data-a="plantilla">'+ic('download')+'<span>Descargar plantilla XML<small>Ejemplo del formato</small></span></button>'+
    '<button class="lbtn" data-a="exportarRes">'+ic('download')+'<span>Descargar resultados<small>Todas las rondas en un archivo</small></span></button>'+
    '</div></section>';
  h+='<p class="nota">rePEPAso · versión '+VERSION+'</p>';
  if(!CONFIG.servidor)h+='<p class="nota">El servidor aún no está configurado: se pueden revisar y probar preguntas, pero no subirlas. Ver «servidor-google/INSTALAR.md».</p>';
  app.innerHTML=h;
}
async function actualizar(){
  await Datos.cargar(true);
  PANT[E.pant]&&PANT[E.pant]();
  toast(Datos.estado==='offline'?'Sin conexión: se mantienen las preguntas guardadas.':'Preguntas actualizadas.');
}

/* ================= AÑADIR PREGUNTAS CON IA ================= */
/* Las indicaciones extra no se guardan nunca: solo valen para la tanda que se está creando */
function guardarImp(){const c=Object.assign({},E.imp);delete c.extra;ls.set(LS.imp,c)}
const TIPOS_IMP=[['test','Test'],['vf','Verdadero o falso'],['escrita','Respuesta escrita']];
function tiposImp(){const t=(E.imp.tipos||[]).filter(x=>TIPOS_IMP.some(y=>y[0]===x));return t.length?t:['test','vf']}
function promptTexto(){
  const i=E.imp,c=norm(i.curso)||'[CURSO]',a=norm(i.asignatura)||'[ASIGNATURA]',t=norm(i.tema)||'[TEMA]',T=tiposImp();
  const reglas=[],ejemplo=[];
  if(T.indexOf('test')>=0){
    reglas.push('- Preguntas tipo test: 4 opciones y solo UNA correcta. Las incorrectas deben ser creíbles.');
    ejemplo.push('        <pregunta>','          <enunciado>Texto de la pregunta</enunciado>','          <opcion correcta="si">Respuesta correcta</opcion>',
      '          <opcion>Respuesta incorrecta</opcion>','          <opcion>Respuesta incorrecta</opcion>','          <opcion>Respuesta incorrecta</opcion>',
      '          <explicacion>Por qué es la correcta, explicado para aprender. Por ejemplo: un ejemplo sencillo si ayuda.</explicacion>','        </pregunta>');
  }
  if(T.indexOf('vf')>=0){
    reglas.push('- Preguntas de verdadero o falso: escribe respuesta="verdadero" o respuesta="falso".');
    ejemplo.push('        <pregunta respuesta="verdadero">','          <enunciado>Una afirmación que sea verdadera o falsa</enunciado>',
      '          <explicacion>Por qué</explicacion>','        </pregunta>');
  }
  if(T.indexOf('escrita')>=0){
    reglas.push('- Preguntas de respuesta escrita: solo cuando la respuesta sea corta (una o pocas palabras, o un número) y sin dudas. En <respuesta> pon la forma correcta y, en otras <respuesta>, las demás formas válidas: la corta y la larga (por ejemplo «no verbal» y «comunicación no verbal»), o «3» y «tres». Si la pregunta trata de cómo se escribe una palabra (ortografía), añade exacta="si" a la <pregunta>.');
    ejemplo.push('        <pregunta tipo="escrita">','          <enunciado>¿Cuál es la raíz cuadrada de 9?</enunciado>','          <respuesta>3</respuesta>',
      '          <respuesta>tres</respuesta>','          <explicacion>Porque 3 × 3 = 9</explicacion>','        </pregunta>');
  }
  const solo=T.length===1?'Todas las preguntas deben ser de este tipo:':'Mezcla estos tipos de pregunta:';
  return [
'Actúa como profesor de '+a+' de '+c+'. Crea '+i.n+' preguntas para repasar el tema «'+t+'».',
'',
'Escribe el curso, la asignatura y el tema EXACTAMENTE como aparecen aquí, sin traducirlos ni cambiarlos.',
'',
'Usa la información del material que te adjunto (fotos del libro o apuntes). Si no adjunto nada, usa lo que se estudia en '+c+' en ese tema.',
'',
solo
].concat(reglas).concat(norm(i.extra)?['','Indicaciones importantes (cúmplelas siempre): '+norm(i.extra)]:[]).concat([
'',
'Reglas:',
'- Lenguaje claro y adecuado a '+c+'.',
'- Cada pregunta lleva una <explicacion> pensada para quien se ha equivocado y quiere aprender: 2 o 3 frases claras que expliquen por qué la respuesta correcta es la buena (y, si ayuda, por qué la confusión típica no lo es). Si sirve para entenderlo mejor, añade un ejemplo sencillo empezando por «Por ejemplo:».',
'- Mezcla preguntas fáciles y difíciles, sin repetir ninguna.',
'',
'Responde SOLO con el XML dentro de un único bloque de código (```xml), sin texto antes ni después, con este formato exacto:',
'',
'<?xml version="1.0" encoding="UTF-8"?>',
'<banco>',
'  <curso nombre="'+c+'">',
'    <asignatura nombre="'+a+'">',
'      <tema nombre="'+t+'">'
]).concat(ejemplo).concat([
'      </tema>',
'    </asignatura>',
'  </curso>',
'</banco>',
'',
'No uses los símbolos < ni > dentro de los textos.',
'',
'Material del tema:',
'[Adjunta aquí fotos de las páginas del libro o pega tus apuntes]'
  ]).join('\n');
}
/* ---------- Asistente de 3 pasos ----------
   1 · Datos  →  «Continuar» copia el texto y abre la IA en otra pestaña
   2 · Pegar  →  «Pegar respuesta» lee lo que se ha copiado en la IA
   3 · Revisar y guardar
   (ChatGPT, Gemini y Claude no se dejan mostrar dentro de otra web, por eso se abren aparte) */
const IAS={chatgpt:{n:'ChatGPT',url:'https://chatgpt.com/'},gemini:{n:'Gemini',url:'https://gemini.google.com/app'},claude:{n:'Claude',url:'https://claude.ai/new'}};
const iaSel=()=>IAS[E.imp.ia]||IAS.chatgpt;
function pasoImp(){return [1,2,3].indexOf(E.imp.paso)>=0?E.imp.paso:1}
function irPaso(n){E.imp.paso=n;E.imp.pasoTs=Date.now();E.imp.reanudar3=n===3;guardarImp();renderImportar();window.scrollTo(0,0)}
function cabImportar(){
  const n=pasoImp(),T=['Qué quieres repasar','Pásalo por la IA','Revisa y guarda'];
  return '<button class="link" data-a="preguntas">'+ic('back')+'Preguntas</button>'+
    '<p class="eyebrow" style="margin-top:16px">Añadir preguntas · Paso '+n+' de 3</p><h1>'+T[n-1]+'</h1>'+
    '<div class="pasos" aria-hidden="true">'+[1,2,3].map(k=>'<i class="'+(k<=n?'on':'')+'"></i>').join('')+'</div>';
}
function renderImportar(){
  const n=pasoImp();
  if(n===2)return renderPaso2();
  if(n===3)return renderPaso3();
  const i=E.imp,P=Datos.todas(),ia=iaSel();
  app.innerHTML=cabImportar()+
    '<p class="sub">Las preguntas que ya hay no se borran: las nuevas se suman.</p>'+
    (!CONFIG.servidor?aviso('info','El servidor aún no está configurado: podrás revisar y probar las preguntas, pero todavía no guardarlas.'):'')+
    '<div class="field"><label class="lbl-f" for="iCurso">Curso</label><input class="in" id="iCurso" list="dl-c" data-imp="curso" value="'+esc(i.curso)+'" placeholder="Ej.: 5º Primaria" autocomplete="off"><p class="hint hint-nombre" id="hn-curso" aria-live="polite"></p></div>'+
    '<div class="field"><label class="lbl-f" for="iAsig">Asignatura</label><input class="in" id="iAsig" list="dl-a" data-imp="asignatura" value="'+esc(i.asignatura)+'" placeholder="Ej.: Ciencias Naturales" autocomplete="off"><p class="hint hint-nombre" id="hn-asignatura" aria-live="polite"></p></div>'+
    '<div class="field"><label class="lbl-f" for="iTema">Tema</label><input class="in" id="iTema" list="dl-t" data-imp="tema" value="'+esc(i.tema)+'" placeholder="Ej.: Tema 3: Las plantas" autocomplete="off"><p class="hint hint-nombre" id="hn-tema" aria-live="polite"></p></div>'+
    '<div class="field"><span class="lbl-f" id="lblTi">Tipos de pregunta</span><div class="chips" role="group" aria-labelledby="lblTi">'+
      TIPOS_IMP.map(([k,l])=>'<button class="chip" data-imptipo="'+k+'" aria-pressed="'+(tiposImp().indexOf(k)>=0)+'">'+l+'</button>').join('')+'</div>'+
      '<p class="hint">Puedes marcar varios. La respuesta escrita va bien para preguntas fáciles: una palabra o un número.</p></div>'+
    '<div class="field"><span class="lbl-f" id="lblIn">Cuántas preguntas</span><div class="chips" role="group" aria-labelledby="lblIn">'+
      [10,15,20,30].map(k=>'<button class="chip" data-impn="'+k+'" aria-pressed="'+(i.n===k)+'">'+k+'</button>').join('')+'</div><p class="hint">Con la versión gratis de ChatGPT, mejor 10: si pides muchas, la respuesta se corta.</p></div>'+
    '<div class="field"><label class="lbl-f" for="iExtra">Indicaciones extra (opcional)</label><textarea class="in short" id="iExtra" data-imp="extra" rows="2" placeholder="Ej.: solo problemas; solo números enteros; nada de fechas">'+esc(i.extra||'')+'</textarea></div>'+
    '<div class="field"><span class="lbl-f" id="lblIa">Con qué IA</span><div class="chips" role="group" aria-labelledby="lblIa">'+
      Object.keys(IAS).map(k=>'<button class="chip" data-impia="'+k+'" aria-pressed="'+(ia===IAS[k])+'">'+IAS[k].n+'</button>').join('')+'</div></div>'+
    '<details class="ver-texto"><summary>Ver el texto que se le pedirá a la IA</summary><label class="sr" for="prompt">Texto para la IA</label><textarea class="in prompt" id="prompt" readonly>'+esc(promptTexto())+'</textarea></details>'+
    '<div class="bar-bottom"><button class="btn" data-a="continuarImp" id="btnCont">'+ic('copy')+'Copiar y abrir '+esc(ia.n)+'</button>'+
      '<button class="link" data-a="saltarPaso2" style="width:100%;justify-content:center">Ya tengo la respuesta de la IA</button></div>'+
    datalist('dl-c',P.map(q=>q.curso))+datalist('dl-a',P.map(q=>q.asignatura))+
    datalist('dl-t',P.filter(q=>!norm(i.asignatura)||q.asignatura===norm(i.asignatura)).map(q=>q.tema));
  ['curso','asignatura','tema'].forEach(sugerirNombre);
}
/* Paso 1 → 2: tiene que ser síncrono (dentro del toque) para que el navegador deje copiar y abrir otra pestaña */
function continuarImp(){
  const i=E.imp,falta=[['curso','#iCurso'],['asignatura','#iAsig'],['tema','#iTema']].filter(([k])=>!norm(i[k]));
  if(falta.length){
    falta.forEach(([,sel])=>$(sel).classList.add('falta'));
    $(falta[0][1]).focus();toast('Escribe '+falta.map(([k])=>k==='asignatura'?'la asignatura':'el '+k).join(', ')+'.');return;
  }
  const t=promptTexto(),ia=iaSel();
  E.imp.copiado=copiarTexto(t);
  try{window.open(ia.url,'_blank','noopener')}catch(e){}
  irPaso(2);
}
/* Copia al portapapeles. Devuelve true si se pudo (o probablemente se pudo). */
function copiarTexto(t){
  let ok=false;
  const ta=document.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:0;opacity:0;font-size:16px';
  document.body.appendChild(ta);ta.focus();ta.select();try{ta.setSelectionRange(0,t.length)}catch(e){}
  try{ok=document.execCommand('copy')}catch(e){}
  ta.remove();
  if(!ok&&navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(()=>{},()=>{});ok=true}
  return ok;
}
/* Paso 2: solo la caja para pegar y un botón. Con la caja vacía el botón pega; con algo pegado, continúa. */
function renderPaso2(){
  const ia=iaSel();
  app.innerHTML=cabImportar()+
    '<p class="sub">Copia la respuesta de '+esc(ia.n)+' y pégala aquí.'+(E.imp.copiado===false?' <button class="link" data-a="copiarPrompt">Copiar el texto para '+esc(ia.n)+'</button>':'')+'</p>'+
    '<label class="sr" for="iXml">Respuesta de la IA</label><textarea class="in pegar" id="iXml" data-imp="xml" placeholder="Pega aquí la respuesta" autocapitalize="off" autocorrect="off" spellcheck="false">'+esc(E.imp.xml||'')+'</textarea>'+
    '<div class="bar-bottom"><button class="btn" id="btnPaso2"></button>'+
      '<button class="link" data-a="empezarDeNuevo" style="width:100%;justify-content:center">Empezar de nuevo</button></div>';
  botonPaso2();
}
function botonPaso2(){
  const b=$('#btnPaso2');if(!b||b.getAttribute('aria-busy')==='true')return;
  const hay=!!norm(E.imp.xml);
  b.dataset.a=hay?'revisar':'pegarResp';
  b.innerHTML=hay?'Continuar '+ic('arrow'):ic('paste')+'Pegar respuesta';
}
async function pegarResp(){
  let t='';
  try{t=await navigator.clipboard.readText()}catch(e){t=null}
  if(t===null){avisoPaso2('Mantén pulsada la caja y elige «Pegar».');return}
  if(esElPrompt(t)){avisoPaso2('Todavía tienes copiado el texto para la IA. Pégalo en '+iaSel().n+' y copia lo que conteste.');return}
  if(!norm(t)){avisoPaso2('No hay nada copiado. Copia la respuesta en '+iaSel().n+'.');return}
  E.imp.xml=t;guardarImp();
  const ta=$('#iXml');if(ta)ta.value=t;
  setTimeout(botonPaso2,0);
}
/* ¿Lo pegado es el texto que le mandamos a la IA (y no su respuesta)? */
const esElPrompt=t=>/^\s*Actúa como profesor/i.test(t||'')&&/Material del tema:/i.test(t||'');
function avisoPaso2(msg){toast(msg);const ta=$('#iXml');if(ta)ta.focus()}
function empezarDeNuevo(){E.imp.xml='';E.rev=null;irPaso(1)}
function renderPaso3(){
  app.innerHTML=cabImportar()+'<div id="rev"></div>';
  if(!E.rev){irPaso(2);return}
  pintarRevision();
}
/* Mientras escribe: avisa si ya existe un nombre igual o muy parecido */
function existentesPara(tipo){
  const P=Datos.base,i=E.imp;
  if(tipo==='curso')return unicos(P.map(q=>q.curso));
  if(tipo==='asignatura')return unicos(P.map(q=>q.asignatura));
  return unicos(P.filter(q=>clave(q.curso)===clave(i.curso)&&clave(q.asignatura)===clave(i.asignatura)).map(q=>q.tema));
}
function sugerirNombre(tipo){
  const h=$('#hn-'+tipo);if(!h)return;
  const v=norm(E.imp[tipo]);if(!v){h.innerHTML='';return}
  const ex=existentesPara(tipo),igual=ex.find(x=>clave(x)===clave(v));
  if(igual){h.innerHTML=igual===v?'':'Ya existe como «'+esc(igual)+'». <button class="link" data-a="usarNombre" data-t="'+tipo+'" data-v="'+esc(igual)+'">Usar ese</button>';return}
  const p=masParecido(v,ex);
  h.innerHTML=p?'¿Querías decir «'+esc(p)+'»? <button class="link" data-a="usarNombre" data-t="'+tipo+'" data-v="'+esc(p)+'">Usar ese</button>':'';
}
function ponerPrompt(){const p=$('#prompt');if(p)p.value=promptTexto()}
function copiarPrompt(){E.imp.copiado=copiarTexto(promptTexto());guardarImp();toast(E.imp.copiado?'Texto copiado. Pégalo en '+iaSel().n+'.':'No se ha podido copiar.')}
function revisar(){
  const txt=E.imp.xml;
  if(!norm(txt)){toast('Pega primero la respuesta de la IA.');const ta=$('#iXml');if(ta)ta.focus();return}
  if(esElPrompt(txt)){toast('Eso es el texto para la IA, no su respuesta. Pégalo en '+iaSel().n+' y copia lo que conteste.');return}
  try{const a=arreglarXMLInfo(txt,{curso:norm(E.imp.curso),asignatura:norm(E.imp.asignatura),tema:norm(E.imp.tema)});
    if(a.sinCompletas&&a.malas)E.rev={error:'Ninguna pregunta se ha podido leer: vienen con etiquetas rotas.',pista:'Pídele a la IA: «El XML tiene errores. Revísalo y devuélvemelo completo».',detalle:a.detalle};
    else if(a.sinCompletas)E.rev={error:'La respuesta de la IA se cortó antes de terminar la primera pregunta.',pista:'Vuelve a pedírselo eligiendo 10 preguntas, o escríbele «continúa» y pega aquí la respuesta entera.'};
    else E.rev={res:parsearXML(a.xml,''),dec:{},cortado:a.cortado,descartada:a.descartada,inicioCortado:a.inicioCortado,malas:a.malas,conDatosPaso1:a.conDatosPaso1}}catch(err){E.rev={error:err.message,detalle:[err.detalle,'Inicio: '+norm(txt).slice(0,80)].filter(Boolean).join(' · ')}}
  irPaso(3);
}
/* Compara los nombres del XML nuevo con los que ya existen.
   Igual salvo tildes/mayúsculas/espacios → se usa el existente sin preguntar.
   Parecido (errata, otro idioma) → se pregunta, con «es la misma» por defecto. */
function nombresImport(lista,dec){
  const P=Datos.base,props=[],map={curso:{},asignatura:{},tema:{}};
  const ver=(tipo,ctx,nombre,existentes)=>{
    if(map[tipo][ctx+nombre]!==undefined)return;
    let dest=nombre;
    const exacto=existentes.find(x=>clave(x)===clave(nombre));
    if(exacto)dest=exacto;
    else{
      const p=masParecido(nombre,existentes);
      if(p){const k=tipo+'|'+ctx+'|'+nombre,usar=dec[k]!==false;props.push({k,tipo,nuevo:nombre,existente:p,usar});if(usar)dest=p}
    }
    map[tipo][ctx+nombre]=dest;
  };
  lista.forEach(q=>ver('curso','',q.curso,unicos(P.map(x=>x.curso))));
  lista.forEach(q=>ver('asignatura','',q.asignatura,unicos(P.map(x=>x.asignatura))));
  lista.forEach(q=>{
    const c=map.curso[q.curso],a=map.asignatura[q.asignatura];
    ver('tema',ctxTema(c,a),q.tema,unicos(P.filter(x=>clave(x.curso)===clave(c)&&clave(x.asignatura)===clave(a)).map(x=>x.tema)));
  });
  const mapear=q=>{
    const c=map.curso[q.curso]||q.curso,a=map.asignatura[q.asignatura]||q.asignatura,t=map.tema[ctxTema(c,a)+q.tema]||q.tema;
    const n=Object.assign({},q,{curso:c,asignatura:a,tema:t});if(q.idAuto)n.id=idDe(n);return n;
  };
  return {props,mapear};
}
function pintarRevision(){
  const r=E.rev,box=$('#rev');if(!box||!r)return;
  if(r.error){
    box.innerHTML=aviso('err','<b>No se puede leer.</b> '+esc(r.error)+'<br>'+esc(r.pista||'Pídele a la IA: «El XML tiene un error. Revísalo y devuélvemelo completo».'))+
      (r.detalle?'<details class="ver-texto"><summary>Detalle técnico</summary><p class="hint" style="overflow-wrap:anywhere">'+esc(r.detalle)+' · versión '+VERSION+'</p></details>':'')+
      '<div class="stack"><button class="btn" data-a="empezarDeNuevo">Empezar de nuevo</button><button class="link" data-a="volverPaso2" style="justify-content:center">Volver a pegar</button></div>';
    return;
  }
  const res=r.res,{props,mapear}=nombresImport(res.ok,r.dec);
  r.lista=res.ok.map(mapear);r.mapear=mapear;
  r.reabrir=Datos.alias.filter(o=>o.a===OCULTO&&r.lista.some(q=>tocaOculto(q,o)));
  const ex=new Set(Datos.base.map(q=>q.id)),nuevas=r.lista.filter(q=>!ex.has(q.id)).length,act=r.lista.length-nuevas;
  const temas={};r.lista.forEach(q=>{const t=q.curso+' · '+q.asignatura+' · '+q.tema;(temas[t]=temas[t]||[]).push(q)});
  const TIPO={curso:'Curso',asignatura:'Asignatura',tema:'Tema'};
  box.innerHTML='<section class="sec-block">'+
    (props.length?'<div class="box"><h2>Nombres parecidos a otros que ya existen</h2><p class="hint" style="margin:-8px 0 16px">Para que no salgan repetidos en los filtros.</p>'+
      props.map(p=>'<div class="nombre-p"><p><span class="eyebrow">'+TIPO[p.tipo]+'</span><br>«'+esc(p.nuevo)+'» ¿es «<b>'+esc(p.existente)+'</b>»?</p>'+
        '<div class="chips" role="group" aria-label="¿Es el mismo nombre?">'+
        '<button class="chip" data-a="decNombre" data-k="'+esc(p.k)+'" data-v="1" aria-pressed="'+p.usar+'">Sí, es el mismo</button>'+
        '<button class="chip" data-a="decNombre" data-k="'+esc(p.k)+'" data-v="0" aria-pressed="'+!p.usar+'">No, es otro</button></div></div>').join('')+'</div>':'')+
    (r.reabrir.length?aviso('info','Vas a subir preguntas de '+r.reabrir.map(o=>'«'+esc(o.original||o.de)+'»').join(', ')+', que estaba eliminado. Al subirlas volverá a aparecer.'):'')+
    (r.inicioCortado?aviso('info','<b>Lo copiado empezaba a mitad de una pregunta.</b> Se ha quitado ese trozo y se han aprovechado las preguntas completas.'):'')+
    (r.malas?aviso('info',plural(r.malas,'pregunta venía rota y se ha quitado','preguntas venían rotas y se han quitado')+'.'):'')+
    (r.conDatosPaso1?aviso('info','Algunas preguntas no traían curso, asignatura o tema: se han puesto los del paso 1.'):'')+
    (r.cortado?aviso('info','<b>La respuesta de la IA se cortó antes de terminar.</b> No pasa nada: se han aprovechado las '+plural(r.lista.length,'pregunta completa','preguntas completas')+(r.descartada?' y se ha quitado la última, que estaba a medias':'')+'. Si quieres más, pide otra tanda en la IA.'):'')+
    (r.lista.length?'<p>'+plural(r.lista.length,'pregunta lista','preguntas listas')+': <b>'+plural(nuevas,'nueva','nuevas')+'</b>'+(act?' y '+act+' que '+(act===1?'actualiza otra que ya estaba':'actualizan otras que ya estaban'):'')+'. No se borra ninguna.</p>':'')+
    (res.errores.length?aviso('err','<b>'+plural(res.errores.length,'pregunta tiene','preguntas tienen')+' errores</b> y no se guardarán.<ul class="errs">'+res.errores.slice(0,20).map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>'):'')+
    Object.keys(temas).map(t=>'<p class="res-t">'+esc(t)+'</p><div class="lista">'+temas[t].map(q=>'<div>'+esc(q.enunciado)+'<span class="resp">'+ic('check')+esc(q.tipo==='escrita'?q.respuestas.join(' / '):correctaDe(q))+(q.tipo==='escrita'?' <small>(escrita)</small>':'')+'</span></div>').join('')+'</div>').join('')+
    '</section>'+
    '<div class="bar-bottom">'+(r.lista.length?'<button class="btn" data-a="subirImp"'+(CONFIG.servidor?'':' disabled')+'>'+ic('upload')+'Guardar '+plural(r.lista.length,'pregunta','preguntas')+'</button>':'<button class="btn" data-a="empezarDeNuevo">Empezar de nuevo</button>')+
      (r.lista.length?'<button class="link" data-a="empezarDeNuevo" style="width:100%;justify-content:center">Empezar de nuevo</button>':'')+'</div>';
}
function nombreDe(lista,i){
  const q=lista[0]||{};
  return [slug(q.curso||i.curso),slug(q.asignatura||i.asignatura),slug(q.tema||i.tema)].filter(Boolean).join('_')+'.xml';
}
async function subirImp(){
  const r=E.rev;if(!r||!r.res)return;
  try{
    for(const o of r.reabrir||[])await servidorPost({accion:'quitarAlias',id:o.id});
    await subirXML(r.lista,nombreDe(r.lista,E.imp));
    const n=r.lista.length,q=r.lista[0];
    E.imp.xml='';E.imp.extra='';E.rev=null;E.imp.paso=1;guardarImp();
    if(q){E.filtro={curso:q.curso,asignatura:q.asignatura,tema:q.tema};ls.set(LS.filtro,E.filtro)}
    renderImportar();
    abrirModal('<p class="eyebrow">Hecho</p><h1 id="mTit">'+plural(n,'pregunta guardada','preguntas guardadas')+'</h1><p>Ya están en el quiz, en todos los dispositivos.</p>'+
      '<div class="stack"><button class="btn" data-a="cerrarInicio">Empezar a repasar '+ic('arrow')+'</button><button class="btn sec" data-a="cerrar">Crear más preguntas</button></div>');
  }catch(e){toast('No se ha podido guardar: '+e.message+'.')}
}


/* ================= UNIR NOMBRES ================= */
function gruposNombres(){
  const P=Datos.base,contar=(lista,f)=>{const m={};lista.forEach(q=>{const k=f(q);m[k]=(m[k]||0)+1});return m};
  const g=[{tipo:'curso',titulo:'Cursos',ctx:'',items:contar(P,q=>q.curso)},{tipo:'asignatura',titulo:'Asignaturas',ctx:'',items:contar(P,q=>q.asignatura)}];
  const ca={};P.forEach(q=>{const k=q.curso+'||'+q.asignatura;(ca[k]=ca[k]||[]).push(q)});
  Object.keys(ca).sort((x,y)=>x.localeCompare(y,'es',{numeric:true})).forEach(k=>{
    const [c,a]=k.split('||');g.push({tipo:'tema',titulo:c+' · '+a,ctx:ctxTema(c,a),items:contar(ca[k],q=>q.tema)});
  });
  return g;
}
function paresParecidos(g){
  const n=Object.keys(g.items),out=[];
  for(let i=0;i<n.length;i++)for(let j=i+1;j<n.length;j++)if(parecido(n[i],n[j])>=.72){
    const [de,a]=g.items[n[i]]>g.items[n[j]]?[n[j],n[i]]:[n[i],n[j]];out.push({g,de,a});
  }
  return out;
}
const TIPO_N={curso:'curso',asignatura:'asignatura',tema:'tema'};
function filaNombre(g,n){
  return '<button class="lbtn" data-a="verNombre" data-t="'+g.tipo+'" data-ctx="'+esc(g.ctx)+'" data-de="'+esc(n)+'"><span>'+esc(n)+'<small>'+plural(g.items[n],'pregunta','preguntas')+'</small></span><span class="chev">'+ic('arrow')+'</span></button>';
}
function renderNombres(){
  const G=gruposNombres(),pares=[].concat(...G.map(paresParecidos));
  const lista=arr=>unicos(Object.keys(arr));
  let h='<button class="link" data-a="preguntas">'+ic('back')+'Preguntas</button>'+
    '<p class="eyebrow" style="margin-top:16px">Nombres</p><h1>Cursos, asignaturas y temas</h1>'+
    '<p class="sub">Toca un nombre para cambiarlo, unirlo con otro o eliminarlo.</p>';
  if(!CONFIG.servidor)h+=aviso('info','Para hacer cambios hace falta el servidor.');
  if(pares.length)h+='<section class="sec-block"><h2>Parecen repetidos</h2><div>'+pares.map(p=>
    '<div class="ses"><span>«'+esc(p.de)+'» y «'+esc(p.a)+'»<small>'+(p.g.tipo==='tema'?'Tema de '+esc(p.g.titulo):p.g.tipo==='curso'?'Curso':'Asignatura')+'</small></span>'+
    '<button class="link" data-a="unirPar" data-t="'+p.g.tipo+'" data-ctx="'+esc(p.g.ctx)+'" data-de="'+esc(p.de)+'" data-dest="'+esc(p.a)+'">Unir</button></div>').join('')+'</div></section>';
  G.filter(g=>g.tipo!=='tema').forEach(g=>{h+='<section class="sec-block"><h2>'+g.titulo+'</h2><div>'+lista(g.items).map(n=>filaNombre(g,n)).join('')+'</div></section>'});
  h+='<section class="sec-block"><h2>Temas</h2>'+G.filter(g=>g.tipo==='tema').map(g=>'<p class="res-t">'+esc(g.titulo)+'</p><div>'+lista(g.items).map(n=>filaNombre(g,n)).join('')+'</div>').join('')+'</section>';
  if(Datos.alias.length)h+='<section class="sec-block"><h2>Historial de cambios</h2><div>'+Datos.alias.slice().reverse().map(x=>{
    const borrado=x.a===OCULTO;
    return '<div class="ses"><span>'+(borrado?'«'+esc(x.original||x.de)+'» eliminado':'«'+esc(x.original||x.de)+'» → «'+esc(x.a)+'»')+'<small>'+(TIPO_N[x.tipo]||'')+'</small></span>'+
      '<button class="link" data-a="deshacerAlias" data-id="'+esc(x.id)+'">'+(borrado?'Recuperar':'Deshacer')+'</button></div>';
  }).join('')+'</div></section>';
  app.innerHTML=h;
}
/* Eliminar un curso, asignatura o tema: sus preguntas dejan de salir, pero no se borra nada.
   Se puede recuperar desde «Historial de cambios». */
async function eliminarNombre(tipo,ctx,nombre){
  const toca=q=>tipo==='tema'?ctxTema(q.curso,q.asignatura)===ctx&&q.tema===nombre:q[tipo]===nombre;
  const n=Datos.base.filter(toca).length;
  const que=tipo==='curso'?'el curso':tipo==='asignatura'?'la asignatura':'el tema';
  if(!confirm('¿Eliminar '+que+' «'+nombre+'»? Dejarán de salir sus '+plural(n,'pregunta','preguntas')+'. Podrás recuperarlo desde el historial.'))return;
  try{
    await servidorPost({accion:'alias',tipo,de:ctx+clave(nombre),a:OCULTO,original:nombre});
    await Datos.cargar();ir('nombres');toast('«'+nombre+'» eliminado. Puedes recuperarlo desde el historial.');
  }catch(e){toast('No se ha podido eliminar: '+e.message+'.')}
}
/* ---------- ficha de un curso, asignatura o tema ---------- */
const TIPO_T={curso:'Curso',asignatura:'Asignatura',tema:'Tema'};
function grupoDe(tipo,ctx){return gruposNombres().find(g=>g.tipo===tipo&&g.ctx===ctx)}
function renderNombre(){
  const n=E.nom,g=n&&grupoDe(n.tipo,n.ctx);
  if(!g||!g.items[n.nombre]){ir('nombres');return}
  const cuantas=g.items[n.nombre],otros=unicos(Object.keys(g.items)).filter(x=>x!==n.nombre);
  const P=Datos.base,dentro=n.tipo==='curso'?unicos(P.filter(q=>q.curso===n.nombre).map(q=>q.asignatura)):
    n.tipo==='asignatura'?unicos(P.filter(q=>q.asignatura===n.nombre).map(q=>q.curso)):[];
  const contexto=n.tipo==='tema'?g.titulo:n.tipo==='curso'?(dentro.length?'Asignaturas: '+dentro.join(', '):''):(dentro.length?'Cursos: '+dentro.join(', '):'');
  const sinSrv=!CONFIG.servidor;
  app.innerHTML=
    '<button class="link" data-a="nombres">'+ic('back')+'Cursos, asignaturas y temas</button>'+
    '<p class="eyebrow" style="margin-top:16px">'+TIPO_T[n.tipo]+'</p><h1>'+esc(n.nombre)+'</h1>'+
    '<p class="sub">'+plural(cuantas,'pregunta','preguntas')+(contexto?' · '+esc(contexto):'')+'</p>'+
    (sinSrv?aviso('info','Para hacer cambios hace falta el servidor.'):'')+
    '<section class="sec-block"><h2>Cambiar nombre</h2>'+
      '<div class="field"><label class="sr" for="nNuevo">Nuevo nombre</label><input class="in" id="nNuevo" value="'+esc(n.nombre)+'" autocomplete="off"></div>'+
      '<button class="btn sec" data-a="guardarNombre"'+(sinSrv?' disabled':'')+'>'+ic('edit')+'Guardar nombre</button></section>'+
    (otros.length?'<section class="sec-block"><h2>Unir con otro</h2><p class="hint" style="margin:-8px 0 12px">Si es lo mismo escrito de otra forma. Sus preguntas pasarán al nombre que elijas.</p>'+
      '<div class="field"><label class="sr" for="nUnir">Unir con</label><select class="in" id="nUnir">'+otros.map(x=>'<option>'+esc(x)+'</option>').join('')+'</select></div>'+
      '<button class="btn sec" data-a="unirFicha"'+(sinSrv?' disabled':'')+'>Unir</button></section>':'')+
    '<div class="zona-peligro"><h2>Eliminar</h2><p class="hint" style="margin:-8px 0 12px">Dejarán de salir sus '+plural(cuantas,'pregunta','preguntas')+'. Podrás recuperarlo desde el historial.</p>'+
      '<button class="btn sec peligro" data-a="eliminarFicha"'+(sinSrv?' disabled':'')+'>'+ic('trash')+'Eliminar «'+esc(n.nombre)+'»</button></div>';
}
async function cambiarNombre(){
  const n=E.nom,nuevo=norm($('#nNuevo').value);
  if(!nuevo){toast('Escribe un nombre.');return}
  if(nuevo===n.nombre){toast('Es el mismo nombre.');return}
  const g=grupoDe(n.tipo,n.ctx),existe=g&&Object.keys(g.items).find(x=>x!==n.nombre&&clave(x)===clave(nuevo));
  if(existe&&!confirm('Ya existe «'+existe+'». ¿Unir «'+n.nombre+'» con él?'))return;
  try{
    await servidorPost({accion:'alias',tipo:n.tipo,de:n.ctx+clave(n.nombre),a:nuevo,original:n.nombre});
    /* si ya existía escrito de otra forma (p. ej. sin tilde), se queda la forma nueva para los dos */
    if(existe&&existe!==nuevo)await servidorPost({accion:'alias',tipo:n.tipo,de:n.ctx+clave(existe),a:nuevo,original:existe});
    await Datos.cargar();ir('nombres');toast('Nombre cambiado a «'+nuevo+'».');
  }catch(e){toast(/desconocida/.test(e.message)?'Falta actualizar el código del servidor (ver INSTALAR.md).':'No se ha podido cambiar: '+e.message+'.')}
}
async function hacerUnion(tipo,ctx,de,a){
  if(clave(de)===clave(a))return;
  try{
    await servidorPost({accion:'alias',tipo,de:ctx+clave(de),a,original:de});
    await Datos.cargar();cerrarModal();ir('nombres');toast('Unido: ahora todo está en «'+a+'».');
  }catch(e){toast(/desconocida/.test(e.message)?'Falta actualizar el código del servidor (ver INSTALAR.md).':'No se ha podido unir: '+e.message+'.')}
}

/* ---------- modal ---------- */
function abrirModal(html){const m=$('#modal');m.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="mTit">'+html+'</div>';m.hidden=false;const b=m.querySelector('button,a');if(b)b.focus()}
function cerrarModal(){const m=$('#modal');m.hidden=true;m.innerHTML=''}
function leerArchivo(f,cb){const rd=new FileReader();rd.onload=()=>cb(String(rd.result));rd.readAsText(f,'UTF-8')}
$('#fileXml').onchange=e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  leerArchivo(f,txt=>{E.imp.xml=txt;guardarImp();const ta=$('#iXml');if(ta)ta.value=txt;revisar()});
};

/* ================= EDITOR ================= */
function preguntaVacia(ed,base){return {id:nuevoId(),curso:ed?ed.curso:'',asignatura:ed?ed.asignatura:'',tema:base?base.tema:'',enunciado:'',tipo:'opciones',opciones:['','','',''],correcta:-1,explicacion:''}}
function edNuevo(){const ed={nombre:'',curso:'',asignatura:'',mixto:false,subidaId:'',preguntas:[]};ed.preguntas.push(preguntaVacia(ed));return ed}
function edDesde(todas,nombre,subidaId){
  const qs=todas.map(q=>{
    if(q.tipo==='escrita')return {id:q.id,curso:q.curso,asignatura:q.asignatura,tema:q.tema,enunciado:q.enunciado,tipo:'escrita',opciones:[],correcta:-1,respuestas:(q.respuestas&&q.respuestas.length?q.respuestas:['']).slice(),exacta:!!q.exacta,explicacion:q.explicacion||''};
    const vf=esVF(q),ops=q.opciones.slice();
    while(!vf&&ops.length<2)ops.push('');
    return {id:q.id,curso:q.curso,asignatura:q.asignatura,tema:q.tema,enunciado:q.enunciado,tipo:vf?'vf':'opciones',opciones:ops,correcta:q.correcta,explicacion:q.explicacion||''};
  });
  const cs=unicos(qs.map(q=>q.curso)),as=unicos(qs.map(q=>q.asignatura));
  const ed={nombre:nombre||'',curso:cs.length===1?cs[0]:'',asignatura:as.length===1?as[0]:'',mixto:cs.length>1||as.length>1,subidaId:subidaId||'',preguntas:qs};
  if(!qs.length)qs.push(preguntaVacia(ed));
  return ed;
}
const esVacia=q=>!norm(q.enunciado)&&!norm(q.explicacion)&&(q.tipo==='vf'||(q.tipo==='escrita'?!(q.respuestas||[]).some(r=>norm(r)):!q.opciones.some(o=>norm(o))));
const tieneContenido=()=>E.ed&&E.ed.preguntas.some(q=>!esVacia(q));
function nombreArchivo(){const ed=E.ed,p=[slug(ed.curso),slug(ed.asignatura)].filter(Boolean).join('_');return (p||'preguntas-nuevas')+'.xml'}
function guardarBorrador(){ls.set(LS.borrador,E.ed)}
function contar(){return E.ed.preguntas.filter(q=>!esVacia(q)).length}
function refrescarPie(){
  const b=$('#edGo');if(b)b.innerHTML=ic(CONFIG.servidor?'upload':'download')+(CONFIG.servidor?(E.ed.subidaId?'Guardar cambios':'Subir')+' · ':'Descargar XML · ')+plural(contar(),'pregunta','preguntas');
  const n=$('#edNombre');if(n)n.placeholder=nombreArchivo();
}
function qHTML(q,i){
  const k0=(a,extra)=>' data-ed="'+a+'" data-q="'+i+'"'+(extra||'');
  let resp;
  if(q.tipo==='escrita'){
    const rs=q.respuestas&&q.respuestas.length?q.respuestas:[''];
    resp=rs.map((r,k)=>'<div class="oprow"><input class="in" data-q="'+i+'" data-r="'+k+'" value="'+esc(r)+'" placeholder="'+(k?'Otra forma válida (opcional)':'Respuesta correcta')+'" aria-label="Pregunta '+(i+1)+', respuesta válida '+(k+1)+'" autocapitalize="off" autocorrect="off" spellcheck="false">'+
      (rs.length>1?'<button class="del"'+k0('delr',' data-o="'+k+'"')+' aria-label="Quitar respuesta válida '+(k+1)+'">'+ic('x')+'</button>':'')+'</div>').join('')+
      '<p class="hint">Se aceptan mayúsculas o minúsculas, sin artículo y con pequeñas faltas (avisando). Si vale de varias formas, añádelas (por ejemplo «3» y «tres»).</p>'+
      '<div class="chips" style="margin:8px 0"><button class="chip"'+k0('exacta')+' aria-pressed="'+!!q.exacta+'">Ortografía exacta (no perdonar faltas)</button></div>'+
      (rs.length<6?'<button class="link"'+k0('addr')+'>'+ic('plus')+'Añadir otra forma válida</button>':'');
  }else if(q.tipo==='vf'){
    resp='<div class="chips" role="group" aria-label="Respuesta correcta de la pregunta '+(i+1)+'">'+['Verdadero','Falso'].map((t,k)=>'<button class="chip"'+k0('vf',' data-o="'+k+'"')+' aria-pressed="'+(q.correcta===k)+'">'+t+'</button>').join('')+'</div><p class="hint">Marca cuál es la correcta.</p>';
  }else{
    resp=q.opciones.map((o,k)=>'<div class="oprow">'+
      '<button class="mark"'+k0('ok',' data-o="'+k+'"')+' aria-pressed="'+(q.correcta===k)+'" aria-label="Respuesta '+(k+1)+' es la correcta">'+ic('check')+'</button>'+
      '<input class="in" data-q="'+i+'" data-o="'+k+'" value="'+esc(o)+'" placeholder="Respuesta '+(k+1)+'" aria-label="Pregunta '+(i+1)+', respuesta '+(k+1)+'">'+
      (q.opciones.length>2?'<button class="del"'+k0('delo',' data-o="'+k+'"')+' aria-label="Quitar respuesta '+(k+1)+'">'+ic('x')+'</button>':'')+
      '</div>').join('')+
      '<p class="hint">Pulsa el cuadrado de la respuesta correcta.</p>'+
      (q.opciones.length<6?'<button class="link"'+k0('addo')+'>'+ic('plus')+'Añadir respuesta</button>':'');
  }
  return '<section class="qbox" data-qbox="'+i+'">'+
    '<div class="qbox-h"><h2>Pregunta '+(i+1)+'</h2><button class="icbtn"'+k0('delq')+' aria-label="Borrar pregunta '+(i+1)+'">'+ic('trash')+'</button></div>'+
    '<div class="field"><label class="lbl-f" for="t'+i+'">Tema</label><input class="in" id="t'+i+'" list="dl-t" data-q="'+i+'" data-f="tema" value="'+esc(q.tema)+'" placeholder="Ej.: Tema 3: Las plantas"></div>'+
    '<div class="field"><label class="lbl-f" for="e'+i+'">Pregunta</label><textarea class="in" id="e'+i+'" data-q="'+i+'" data-f="enunciado" rows="2">'+esc(q.enunciado)+'</textarea></div>'+
    '<div class="field"><span class="lbl-f">Tipo</span><div class="chips" role="group" aria-label="Tipo de pregunta '+(i+1)+'">'+
      '<button class="chip"'+k0('tipo',' data-v="opciones"')+' aria-pressed="'+(q.tipo==='opciones')+'">Test</button>'+
      '<button class="chip"'+k0('tipo',' data-v="vf"')+' aria-pressed="'+(q.tipo==='vf')+'">Verdadero o falso</button>'+
      '<button class="chip"'+k0('tipo',' data-v="escrita"')+' aria-pressed="'+(q.tipo==='escrita')+'">Escrita</button></div></div>'+
    '<div class="field"><span class="lbl-f">Respuestas</span>'+resp+'</div>'+
    '<div class="field"><label class="lbl-f" for="x'+i+'">Explicación (opcional)</label><textarea class="in short" id="x'+i+'" data-q="'+i+'" data-f="explicacion" rows="2" placeholder="Se muestra después de responder">'+esc(q.explicacion)+'</textarea></div>'+
  '</section>';
}
function renderEditor(){
  if(!E.ed)E.ed=ls.get(LS.borrador,null)||edNuevo();
  const ed=E.ed,P=Datos.todas();
  const editando=ed.subidaId?Datos.subidas.find(s=>s.id===ed.subidaId):null;
  app.innerHTML=
    '<button class="link" data-a="preguntas">'+ic('back')+'Preguntas</button>'+
    '<p class="eyebrow" style="margin-top:16px">Editor</p><h1>'+(editando?'Editar preguntas':'Escribir preguntas')+'</h1>'+
    '<p class="sub">'+(editando?'Estás cambiando «'+esc(editando.nombre)+'». Al guardar, sustituye a la versión anterior.':'Escribe las preguntas y súbelas. Lo que escribes se guarda en este dispositivo mientras tanto.')+'</p>'+
    '<div class="tool"><button class="btn sec" data-ed="nuevo">'+ic('plus')+'Nuevo</button><button class="btn sec" data-ed="abrir">'+ic('file')+'Abrir XML</button></div>'+
    '<div id="edErr"></div>'+
    '<section class="box">'+
      '<div class="field"><label class="lbl-f" for="edCurso">Curso</label><input class="in" id="edCurso" list="dl-c" data-f="curso" value="'+esc(ed.curso)+'" placeholder="'+(ed.mixto?'Varios':'Ej.: 5º Primaria')+'"></div>'+
      '<div class="field"><label class="lbl-f" for="edAsig">Asignatura</label><input class="in" id="edAsig" list="dl-a" data-f="asignatura" value="'+esc(ed.asignatura)+'" placeholder="'+(ed.mixto?'Varias':'Ej.: Ciencias Naturales')+'"></div>'+
      '<div class="field"><label class="lbl-f" for="edNombre">Nombre</label><input class="in" id="edNombre" data-f="nombre" value="'+esc(ed.nombre)+'" placeholder="'+esc(nombreArchivo())+'" autocapitalize="off" autocorrect="off" spellcheck="false"></div>'+
    '</section>'+
    (ed.mixto?aviso('info','Este grupo tiene varios cursos o asignaturas. Si escribes un curso o una asignatura arriba, se cambiará en todas las preguntas.'):'')+
    ed.preguntas.map(qHTML).join('')+
    '<button class="btn sec" data-ed="addq">'+ic('plus')+'Añadir pregunta</button>'+
    '<button class="link" data-ed="descargar" style="margin-top:8px">'+ic('download')+'Descargar como XML</button>'+
    (editando?'<div class="zona-peligro"><p class="hint">¿Ya no quieres estas preguntas en el quiz?</p><button class="btn sec peligro" data-a="retirarEd">'+ic('trash')+'Quitar estas preguntas del quiz</button></div>':'')+
    '<div class="bar-bottom"><button class="btn" id="edGo" data-ed="guardar"></button></div>'+
    datalist('dl-c',P.map(q=>q.curso).concat(ed.curso))+
    datalist('dl-a',P.map(q=>q.asignatura).concat(ed.asignatura))+
    datalist('dl-t',P.filter(q=>!ed.asignatura||q.asignatura===ed.asignatura).map(q=>q.tema).concat(ed.preguntas.map(q=>q.tema)));
  refrescarPie();
}
function validarEditor(){
  const ed=E.ed,errores=[],lista=[];
  ed.preguntas.forEach((q,i)=>{
    if(esVacia(q))return;
    const full=Object.assign({},q,{curso:q.curso||ed.curso,asignatura:q.asignatura||ed.asignatura});
    const e=errorDe(full);if(e)errores.push({i,msg:'Pregunta '+(i+1)+': '+e+'.'});else lista.push(limpiar(full));
  });
  document.querySelectorAll('.qbox').forEach(b=>b.classList.toggle('err',errores.some(x=>x.i===+b.dataset.qbox)));
  if(!lista.length&&!errores.length){toast('Escribe al menos una pregunta.');return null}
  if(errores.length){
    $('#edErr').innerHTML=aviso('err','<b>Corrige esto antes de guardar:</b><ul class="errs">'+errores.map(x=>'<li>'+esc(x.msg)+'</li>').join('')+'</ul>');
    irA('#edErr');return null;
  }
  $('#edErr').innerHTML='';
  return lista;
}
function nombreFinal(){let n=norm(E.ed.nombre)||nombreArchivo();if(!/\.xml$/i.test(n))n+='.xml';return n}
async function guardarEditor(btn){
  const lista=validarEditor();if(!lista)return;
  if(!CONFIG.servidor){descargar(aXML(lista),nombreFinal(),'application/xml');toast('Archivo descargado.');return}
  try{
    const j=await conBoton(btn,'Guardando…',()=>subirXML(lista,nombreFinal(),E.ed.subidaId));
    E.ed.subidaId=j.id||E.ed.subidaId;guardarBorrador();renderEditor();
    toast(plural(lista.length,'pregunta guardada','preguntas guardadas')+'. Ya están en el quiz.');
  }catch(e){toast('No se ha podido guardar: '+e.message+'.')}
}
function accionEditor(b){
  const ed=E.ed,a=b.dataset.ed,i=+b.dataset.q,k=+b.dataset.o,q=ed.preguntas[i];
  let foco=null;
  switch(a){
    case 'nuevo':
      if(tieneContenido()&&!confirm('¿Empezar de cero? Se quitará del editor lo que hay ahora (lo que ya está subido no se borra).'))return;
      E.ed=edNuevo();guardarBorrador();renderEditor();window.scrollTo(0,0);return;
    case 'abrir':$('#fileEd').click();return;
    case 'guardar':guardarEditor(b);return;
    case 'descargar':{const l=validarEditor();if(l){descargar(aXML(l),nombreFinal(),'application/xml');toast('Archivo descargado.')}return}
    case 'addq':{const n=preguntaVacia(ed,ed.preguntas[ed.preguntas.length-1]);ed.preguntas.push(n);foco='#e'+(ed.preguntas.length-1);break}
    case 'delq':
      if(!esVacia(q)&&!confirm('¿Quitar la pregunta '+(i+1)+'?'))return;
      ed.preguntas.splice(i,1);if(!ed.preguntas.length)ed.preguntas.push(preguntaVacia(ed));break;
    case 'addo':q.opciones.push('');foco='input[data-q="'+i+'"][data-o="'+(q.opciones.length-1)+'"]';break;
    case 'delo':q.opciones.splice(k,1);if(q.correcta===k)q.correcta=-1;else if(q.correcta>k)q.correcta--;break;
    case 'ok':case 'vf':q.correcta=k;break;
    case 'tipo':
      if(b.dataset.v===q.tipo)return;
      if(q.tipo==='opciones'){q._ops=q.opciones;q._c=q.correcta}
      if(b.dataset.v==='vf'){q.opciones=['Verdadero','Falso'];q.correcta=-1}
      else if(b.dataset.v==='escrita'){q.opciones=[];q.correcta=-1;if(!q.respuestas||!q.respuestas.length)q.respuestas=['']}
      else{q.opciones=q._ops||['','','',''];q.correcta=q._c!=null?q._c:-1}
      q.tipo=b.dataset.v;break;
    case 'addr':q.respuestas.push('');foco='input[data-q="'+i+'"][data-r="'+(q.respuestas.length-1)+'"]';break;
    case 'delr':q.respuestas.splice(k,1);break;
    case 'exacta':q.exacta=!q.exacta;break;
  }
  guardarBorrador();
  const sel='[data-ed="'+a+'"][data-q="'+i+'"]'+(b.dataset.o!=null?'[data-o="'+k+'"]':'')+(b.dataset.v?'[data-v="'+b.dataset.v+'"]':'');
  renderEditor();
  const f=(foco&&$(foco))||$(sel)||$('[data-qbox="'+Math.min(i,ed.preguntas.length-1)+'"] textarea');
  if(f){try{f.focus({preventScroll:!foco})}catch(e){f.focus()}if(foco)f.scrollIntoView({behavior:'smooth',block:'center'})}
}
$('#fileEd').onchange=e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  leerArchivo(f,txt=>{
    let res;try{res=parsearXML(arreglarXML(txt),f.name)}catch(err){toast(err.message);return}
    if(tieneContenido()&&!confirm('¿Abrir «'+f.name+'»? Se sustituirá lo que hay ahora en el editor.'))return;
    E.ed=edDesde(res.todas,f.name);guardarBorrador();renderEditor();window.scrollTo(0,0);
    toast(res.errores.length?'Abierto. Hay '+plural(res.errores.length,'pregunta','preguntas')+' por corregir.':'Abierto: '+f.name);
  });
};

/* ---------- plantilla ---------- */
const PLANTILLA=[
'<?xml version="1.0" encoding="UTF-8"?>',
'<!--',
'  PLANTILLA DE PREGUNTAS',
'  · Cada pregunta lleva un enunciado, 2 o más opciones y UNA con correcta="si".',
'  · La explicacion es opcional: se muestra después de responder.',
'  · Verdadero o falso: escribe respuesta="verdadero" o respuesta="falso" y no pongas opciones.',
'  · Lo más fácil es no escribirlo a mano: usa «Añadir preguntas con IA» en la app.',
'-->',
'<banco>',
'  <curso nombre="5º Primaria">',
'    <asignatura nombre="Ciencias Naturales">',
'      <tema nombre="Tema 3: Las plantas">',
'        <pregunta>',
'          <enunciado>¿Qué parte de la planta absorbe el agua del suelo?</enunciado>',
'          <opcion correcta="si">La raíz</opcion>',
'          <opcion>Las hojas</opcion>',
'          <opcion>La flor</opcion>',
'          <opcion>El fruto</opcion>',
'          <explicacion>La raíz absorbe el agua y las sales minerales del suelo.</explicacion>',
'        </pregunta>',
'        <pregunta respuesta="verdadero">',
'          <enunciado>Las plantas necesitan luz para hacer la fotosíntesis.</enunciado>',
'        </pregunta>',
'      </tema>',
'    </asignatura>',
'  </curso>',
'</banco>',''].join('\n');

/* ---------- acciones ---------- */
function abrirArchivo(el){
  const id=el.dataset.id,a=el.dataset.t==='s'?Datos.subidas.find(s=>s.id===id):Datos.archivos.find(x=>x.nombre===id);
  if(!a)return;
  if(tieneContenido()&&!confirm('¿Abrir «'+a.nombre+'» en el editor? Se quitará del editor lo que hay ahora (lo subido no se borra).'))return;
  E.ed=edDesde(a.todas&&a.todas.length?a.todas:a.preguntas,a.nombre,el.dataset.t==='s'?a.id:'');
  guardarBorrador();ir('editor');
}
async function retirar(id){
  const a=Datos.subidas.find(s=>s.id===id);if(!a)return;
  if(!confirm('¿Quitar «'+a.nombre+'» del quiz? Sus '+plural(a.preguntas.length,'pregunta dejará','preguntas dejarán')+' de salir.'))return;
  try{await servidorPost({accion:'retirar',id:a.id});await Datos.cargar();E.ed=edNuevo();guardarBorrador();ir('preguntas');toast('Quitado del quiz.')}
  catch(e){toast('No se ha podido quitar: '+e.message+'.')}
}
const A={
  inicio:()=>ir('inicio'),progreso:()=>ir('progreso'),logros:()=>{cerrarModal();E.mes=0;ir('logros')},
  mesAnt:()=>{E.mes--;renderLogros();const b=$('[data-a=mesAnt]');if(b)b.focus()},
  mesSig:()=>{if(E.mes<0)E.mes++;renderLogros();const b=$('[data-a='+(E.mes<0?'mesSig':'mesAnt')+']');if(b)b.focus()},
  canjear,confirmarCanje,resolverCanje,preguntas:()=>ir('preguntas'),importar:()=>ir('importar'),
  editor:()=>ir('editor'),
  editorNuevo:()=>{if(!E.ed||!tieneContenido()||E.ed.subidaId)E.ed=edNuevo();ir('editor')},
  salir:()=>{if(confirm('¿Salir de la ronda? Se perderá lo que llevas.'))ir('inicio')},
  actualizar,
  copiarPrompt,revisar,
  continuarImp,pegarResp,
  saltarPaso2:()=>{E.imp.copiado=true;irPaso(2)},
  empezarDeNuevo,
  volverPaso1:()=>irPaso(1),
  volverPaso2:()=>{E.rev=null;irPaso(2)},
  elegirXml:()=>$('#fileXml').click(),
  subirImp:()=>subirImp(),
  impEditor:()=>{
    const r=E.rev;if(!r||!r.res)return;
    if(tieneContenido()&&!confirm('¿Pasar estas preguntas al editor? Se quitará del editor lo que hay ahora.'))return;
    E.ed=edDesde(r.res.todas.map(r.mapear),nombreDe(r.lista,E.imp));guardarBorrador();ir('editor');
  },
  impProbar:()=>{
    const r=E.rev;if(!r||!r.res)return;
    Datos.extra=r.lista.map(q=>Object.assign({},q,{archivo:'prueba'}));
    const q=r.lista[0];if(q){E.filtro={curso:q.curso,asignatura:q.asignatura,tema:q.tema};ls.set(LS.filtro,E.filtro)}
    ir('inicio');toast('Probando '+plural(Datos.extra.length,'pregunta','preguntas')+' sin subirlas.');
  },
  usarNombre:el=>{const t=el.dataset.t;E.imp[t]=el.dataset.v;guardarImp();const inp=$('[data-imp="'+t+'"]');if(inp)inp.value=el.dataset.v;ponerPrompt();sugerirNombre(t);if(t!=='tema')sugerirNombre('tema')},
  soloFallos:()=>{E.soloFallos=!E.soloFallos;ls.set('repaso.soloFallos.v1',E.soloFallos);renderInicio();const b=$('[data-a=soloFallos]');if(b)b.focus()},
  nombres:()=>ir('nombres'),
  verNombre:el=>{E.nom={tipo:el.dataset.t,ctx:el.dataset.ctx,nombre:el.dataset.de};ir('nombre')},
  guardarNombre:()=>cambiarNombre(),
  unirFicha:()=>{const n=E.nom,v=$('#nUnir').value;if(!v)return;if(confirm('¿Unir «'+n.nombre+'» con «'+v+'»?'))return hacerUnion(n.tipo,n.ctx,n.nombre,v)},
  eliminarFicha:()=>{const n=E.nom;return eliminarNombre(n.tipo,n.ctx,n.nombre)},
  unirPar:el=>{if(confirm('¿Unir «'+el.dataset.de+'» con «'+el.dataset.dest+'»? Sus preguntas pasarán a «'+el.dataset.dest+'».'))return hacerUnion(el.dataset.t,el.dataset.ctx,el.dataset.de,el.dataset.dest)},
  deshacerAlias:async el=>{
    const rec=/recuperar/i.test(el.textContent);
    try{await servidorPost({accion:'quitarAlias',id:el.dataset.id});await Datos.cargar();renderNombres();toast(rec?'Recuperado.':'Cambio deshecho.')}
    catch(e){toast('No se ha podido deshacer: '+e.message+'.')}
  },
  decNombre:el=>{const r=E.rev;if(!r)return;r.dec[el.dataset.k]=el.dataset.v==='1';pintarRevision();const b=$('[data-a=decNombre][data-k="'+CSS.escape(el.dataset.k)+'"][data-v="'+el.dataset.v+'"]');if(b)b.focus({preventScroll:true})},
  quitarExtra:()=>{Datos.extra=[];PANT[E.pant]&&PANT[E.pant]();toast('Prueba terminada.')},
  editarArch:el=>abrirArchivo(el),
  retirarEd:()=>{if(E.ed&&E.ed.subidaId)return retirar(E.ed.subidaId)},
  exportarTodo:()=>descargar(aXML(Datos.base),'todas-las-preguntas.xml','application/xml'),
  plantilla:()=>descargar(PLANTILLA,'plantilla-preguntas.xml','application/xml'),
  exportarRes:()=>descargar(JSON.stringify(Datos.resultados(),null,2),'resultados-repaso.json','application/json'),
  cerrar:cerrarModal,
  cerrarInicio:()=>{cerrarModal();ir('inicio')}
};
document.addEventListener('click',e=>{
  const ed=e.target.closest('[data-ed]');
  if(ed&&E.pant==='editor'){if(ed.getAttribute('aria-busy')!=='true')accionEditor(ed);return}
  const ia=e.target.closest('[data-impia]');
  if(ia&&E.pant==='importar'){E.imp.ia=ia.dataset.impia;guardarImp();app.querySelectorAll('[data-impia]').forEach(b=>b.setAttribute('aria-pressed',String(b===ia)));
    const bc=$('#btnCont');if(bc)bc.innerHTML=ic('copy')+'Copiar y abrir '+esc(iaSel().n);return}
  const tp=e.target.closest('[data-imptipo]');
  if(tp&&E.pant==='importar'){
    let T=tiposImp().slice();const k=tp.dataset.imptipo,x=T.indexOf(k);
    if(x>=0){if(T.length===1){toast('Elige al menos un tipo.');return}T.splice(x,1)}else T.push(k);
    E.imp.tipos=TIPOS_IMP.map(y=>y[0]).filter(y=>T.indexOf(y)>=0);guardarImp();
    app.querySelectorAll('[data-imptipo]').forEach(b=>b.setAttribute('aria-pressed',String(E.imp.tipos.indexOf(b.dataset.imptipo)>=0)));
    ponerPrompt();return;
  }
  const n=e.target.closest('[data-impn]');
  if(n&&E.pant==='importar'){
    E.imp.n=+n.dataset.impn;guardarImp();
    app.querySelectorAll('[data-impn]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.impn===E.imp.n)));
    ponerPrompt();return;
  }
  const el=e.target.closest('[data-a]');
  if(el){
    const a=el.dataset.a,s=E.sesion;
    if(E.pant==='pregunta'&&s&&s.resp.length>0&&['inicio','progreso','preguntas','logros'].indexOf(a)>=0&&!confirm('¿Salir de la ronda? Se perderá lo que llevas.'))return;
    if(el.getAttribute('aria-busy')==='true')return;
    if(A[a]){const r=A[a](el);if(r&&typeof r.then==='function')ocupado(el,r,etiquetaOcupado(a,el))}
    return;
  }
  if(e.target.id==='modal')cerrarModal();
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(E.pant==='importar'&&t.dataset.imp){
    E.imp[t.dataset.imp]=t.value;guardarImp();t.classList.remove('falta');
    if(t.dataset.imp==='xml'){E.rev=null;botonPaso2()}
    else{ponerPrompt();if(t.dataset.imp!=='extra'){sugerirNombre(t.dataset.imp);if(t.dataset.imp!=='tema')sugerirNombre('tema')}}
    return;
  }
  if(E.pant!=='editor'||!E.ed)return;
  const ed=E.ed;
  if(t.dataset.q!=null&&t.dataset.r!=null)ed.preguntas[+t.dataset.q].respuestas[+t.dataset.r]=t.value;
  else if(t.dataset.q!=null&&t.dataset.o!=null)ed.preguntas[+t.dataset.q].opciones[+t.dataset.o]=t.value;
  else if(t.dataset.q!=null&&t.dataset.f)ed.preguntas[+t.dataset.q][t.dataset.f]=t.value;
  else if(t.dataset.f){
    ed[t.dataset.f]=t.value;
    if(t.dataset.f==='curso'||t.dataset.f==='asignatura')ed.preguntas.forEach(q=>{q[t.dataset.f]=t.value});
  }else return;
  if(t.closest('.qbox'))t.closest('.qbox').classList.remove('err');
  guardarBorrador();refrescarPie();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal').hidden)cerrarModal()});

/* ---------- arranque ---------- */
/* Si estaba creando preguntas y el móvil recargó la página al volver de la IA, se sigue donde lo dejó */
const reanudar=(E.imp.paso===2||E.imp.paso===3)&&Date.now()-(E.imp.pasoTs||0)<3*3600e3;
if(reanudar&&E.imp.paso===3)E.imp.paso=2;
Datos.cargar().then(()=>{
  if(reanudar&&E.pant==='importar'&&E.imp.paso===2&&norm(E.imp.xml)&&!E.rev&&E.imp.reanudar3){E.imp.reanudar3=false;revisar();return}
  if(E.pant!=='pregunta'&&E.pant!=='resultado'&&E.pant!=='editor'&&E.pant!=='importar'&&E.pant!=='nombre')PANT[E.pant]();
});
ir(reanudar?'importar':'inicio');
})();
