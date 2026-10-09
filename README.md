# rePEPAso

Quiz para que Pepa repase los temas del cole. Se usa desde el navegador en cualquier dispositivo, sin cuentas ni contraseñas.

**Para añadir preguntas no hace falta entrar aquí:** en la app, entra en **Preguntas → Añadir preguntas con IA** y sigue los tres pasos.

---

### Logros

Un día cuenta cuando se responden 15 preguntas y se aciertan 11 (en una o varias rondas). En **Logros** se ve el calendario, la racha, las medallas (días seguidos, cada semana / quincena / mes de días hechos, aciertos seguidos, tiempo jugando…) y los puntos, que se canjean por premios que confirman papá o mamá con un PIN. Cada logro nuevo sale en una ventana de felicitación al acabar la ronda. Para cambiar el 15 y el 11: `meta:{preguntas:15,aciertos:11}` en `config.js`.

### Para quien mantiene el quiz

- **Publicación:** GitHub Pages (Settings → Pages → Deploy from a branch → `main` / `root`).
- **Servidor de preguntas y resultados:** Google Apps Script + Google Sheets, gratuito. Instrucciones en [`servidor-google/INSTALAR.md`](servidor-google/INSTALAR.md). Después hay que pegar su URL en `config.js`.
- **Preguntas de base (opcional):** si pones archivos `.xml` en una carpeta `preguntas/` del repositorio, también se cargan.
- **Archivos:** `index.html` (estructura), `estilos.css`, `app.js` y `config.js` (solo la dirección del servidor). Al cambiar `estilos.css` o `app.js`, sube el número de `?v=` en `index.html` para que los móviles carguen la versión nueva.
- **Cómo se combinan:** primero las de `preguntas/` y después las subidas, de la más antigua a la más reciente. Si dos preguntas tienen el mismo `id`, gana la más reciente. Nunca se borra nada.
