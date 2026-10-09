# rePEPAso

Quiz para que Pepa repase los temas del cole. Se usa desde el navegador en cualquier dispositivo, sin cuentas ni contraseñas.

**Para añadir preguntas no hace falta entrar aquí:** en la app, entra en **Preguntas → Añadir preguntas con IA** y sigue los tres pasos.

---

### Para quien mantiene el quiz

- **Publicación:** GitHub Pages (Settings → Pages → Deploy from a branch → `main` / `root`).
- **Servidor de preguntas y resultados:** Google Apps Script + Google Sheets, gratuito. Instrucciones en [`servidor-google/INSTALAR.md`](servidor-google/INSTALAR.md). Después hay que pegar su URL en `config.js`.
- **Preguntas de base (opcional):** si pones archivos `.xml` en una carpeta `preguntas/` del repositorio, también se cargan.
- **Archivos:** `index.html` (estructura), `estilos.css`, `app.js` y `config.js` (solo la dirección del servidor). Al cambiar `estilos.css` o `app.js`, sube el número de `?v=` en `index.html` para que los móviles carguen la versión nueva.
- **Cómo se combinan:** primero las de `preguntas/` y después las subidas, de la más antigua a la más reciente. Si dos preguntas tienen el mismo `id`, gana la más reciente. Nunca se borra nada.
