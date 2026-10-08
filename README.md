# Repaso

Quiz para repasar los temas del cole. Se usa desde el navegador en cualquier dispositivo, sin cuentas ni contraseñas.

**Para añadir preguntas no hace falta entrar aquí:** en la app, entra en **Preguntas → Añadir preguntas con IA** y sigue los tres pasos.

---

### Para quien mantiene el quiz

- **Publicación:** GitHub Pages (Settings → Pages → Deploy from a branch → `main` / `root`).
- **Servidor de preguntas y resultados:** Google Apps Script + Google Sheets, gratuito. Instrucciones en [`servidor-google/INSTALAR.md`](servidor-google/INSTALAR.md). Después hay que pegar su URL en `CONFIG.servidor` dentro de `index.html`.
- **Preguntas de base (opcional):** los `.xml` de la carpeta `preguntas/` también se cargan. Los de ahora son ejemplos y se pueden borrar.
- **Cómo se combinan:** primero las de `preguntas/` y después las subidas, de la más antigua a la más reciente. Si dos preguntas tienen el mismo `id`, gana la más reciente. Nunca se borra nada.
