# Actualización: segundos visibles

Cambios incluidos:

- Se agregó el cálculo y formato de segundos.
- El diseño ahora usa cuatro columnas: DÍAS, HORAS, MINUTOS y SEGUNDOS.
- El GIF ahora contiene 60 fotogramas.
- Cada fotograma representa un segundo posterior.
- Cada frame dura 1000 ms.
- El GIF se configura sin repetición para quedarse en el último frame.
- Se cambió Montserrat de WOFF2 a WOFF para compatibilidad con Satori.
- Se corrigió la importación CommonJS de `gifenc`.
- Se redujo la resolución interna a 900 x 302 px para mejorar el peso, manteniendo buena calidad a 600 px en correo.
- Se mantuvieron los encabezados anti-caché.
- El script local ahora genera una prueba PNG y una prueba GIF.

## Cómo publicar

1. Descomprime esta carpeta.
2. Reemplaza los archivos del repositorio actual con estos archivos.
3. Haz commit y push a la rama `main`.
4. Espera a que Netlify marque el despliegue como `Published`.
5. Prueba la URL con un parámetro nuevo, por ejemplo `&v=segundos-1`.
