/* ======================= CONFIGURACIÓN de rePEPAso =======================
   servidor: dirección de la aplicación web de Google Apps Script (termina en /exec).
             Ahí se guardan las preguntas que se suben y los resultados de todos los dispositivos.
             Vacía = solo se usan los XML de la carpeta «preguntas» y los resultados quedan en cada dispositivo.
   repo:     'usuario/repositorio' de GitHub. Vacío = se detecta solo al publicarlo en GitHub Pages.
   rama / carpeta: dónde están los XML de base dentro del repositorio (opcional).
*/
window.REPEPASO_CONFIG={
  servidor:'https://script.google.com/macros/s/AKfycbzVn_nuqFTSrf9BCARR8vo1tjtHUVckPJq8TGkoD0taA2Yy4Q-RzUUXfy82EJ7EtMQc/exec',
  repo:'',
  rama:'main',
  carpeta:'preguntas'
};
