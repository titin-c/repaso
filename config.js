/* ======================= CONFIGURACIÓN de rePEPAso =======================
   servidor: dirección de la aplicación web de Google Apps Script (termina en /exec).
             Ahí se guardan las preguntas que se suben y los resultados de todos los dispositivos.
             Vacía = solo se usan los XML de la carpeta «preguntas» y los resultados quedan en cada dispositivo.
   repo:     'usuario/repositorio' de GitHub. Vacío = se detecta solo al publicarlo en GitHub Pages.
   rama / carpeta: dónde están los XML de base dentro del repositorio (opcional).
   puntosNuevosDesde: día desde el que cuentan los puntos «por aprender» (menos puntos por repetir lo que ya se sabe,
             máximo diario…). Lo anterior se queda como estaba. Vacío ('') = se aplica a todo, también a lo ya hecho.
   meta:     lo que hace falta para que un día cuente (preguntas respondidas y aciertos).
   practicas (opcional): «Reto del día» de cosas que no son un tema. Una pregunta cuenta para una práctica
             si su tema o su asignatura contiene alguna de sus palabras. Por defecto:
             Ortografía (temas con «ortograf», «acentuación» o «tilde», y las preguntas de escritura exacta)
             y Problemas (temas con «problema»).
*/
window.REPEPASO_CONFIG={
  servidor:'https://script.google.com/macros/s/AKfycbzVn_nuqFTSrf9BCARR8vo1tjtHUVckPJq8TGkoD0taA2Yy4Q-RzUUXfy82EJ7EtMQc/exec',
  repo:'',
  rama:'main',
  carpeta:'preguntas',
  puntosNuevosDesde:'2026-10-10',
  meta:{preguntas:15,aciertos:11}
};
