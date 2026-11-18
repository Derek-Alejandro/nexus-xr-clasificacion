# NEXUS XR 3.2 — Interacción virtual

**Laboratorio Inmersivo de Clasificación Geométrica con Física**

El laboratorio tiene cuatro mesas, veinte figuras dinámicas y cuatro recipientes abiertos. En escritorio puedes inspeccionar el escenario, observar caídas y generar otra distribución. En VR, apunta con cualquiera de las manos, junta pulgar e índice para agarrar, desplaza la mano y abre la pinza para soltar. Los botones **Reiniciar** y **Salir de VR** se activan con el mismo rayo y gesto.

## Ejecutar en Google Chrome con Live Server

1. Abre la carpeta `nexus-xr-clasificacion-32` en Visual Studio Code.
2. Abre `index.html` con **Open with Live Server** y visita en Google Chrome la dirección local que muestra la extensión.
3. Espera el indicador **Three.js y cannon-es cargados · Simulación física activa**. Se requiere acceso a jsDelivr para Three.js 0.183.0, cannon-es 0.20.0 y Bootstrap 5.3.8.
4. Arrastra para orbitar y usa la rueda o un gesto de dos dedos para acercarte. **Pantalla completa** amplía la vista.
5. Usa **Probar caída** para colocar una figura sobre cada boca y observar cómo cae y descansa por efecto de la simulación. **Redistribuir** devuelve las veinte figuras a las cubiertas en una disposición nueva.

Los módulos son nativos del navegador y se publican como archivos estáticos, sin instalación de dependencias ni compilación. Para WebXR en Quest 3, sirve la carpeta independiente por HTTPS, por ejemplo mediante GitHub Pages. La dirección HTTP de la computadora en la red local sirve para inspección de escritorio. WebXR requiere un contexto seguro.

## Implementación física

- Un mundo cannon-es aplica gravedad de −9,81 m/s², fricción, restitución y reposo. Avanza a 1/60 s con hasta cuatro subpasos por cuadro. Se descartan saltos prolongados de tiempo y se reinicia el acumulador en interrupciones.
- El piso, las mesas y los recipientes son estáticos. Cada recipiente tiene cinco colisionadores, una base y cuatro paredes. El volumen útil es un conjunto de coordenadas para la etapa 5.
- Hay cinco esferas cian, cinco cubos ámbar, cinco pirámides magenta y cinco prismas hexagonales violetas. Cada figura conserva su ID. Las esferas y los cubos usan primitivas. La pirámide y el prisma usan poliedros convexos definidos por los mismos vértices que su malla.
- Cada mesa recibe una figura de cada categoría y una adicional. El generador por semilla baraja la categoría extra, los IDs, las posiciones y las orientaciones, verificando las huellas antes de colocar los cuerpos. El reinicio reutiliza los cuerpos y las mallas.
- La pinza conserva el punto de contacto en coordenadas locales de la figura y la distancia inicial del rayo. Un ancla cinemática se acerca al objetivo a un máximo de 1,15 m/s y tira de la pieza mediante una restricción punto a punto con impulso limitado. El cuerpo permanece dinámico y conserva sus contactos. Al soltar, se conserva hasta 1,2 m/s de velocidad lineal. Ante pérdida de seguimiento se retira la restricción y se anulan las velocidades antes de que actúe la gravedad.
- Si una figura libre sale de los límites del escenario o se estabiliza en el suelo, vuelve a una posición libre de su mesa de origen. Si la mesa está temporalmente ocupada, espera a que haya espacio. Las figuras depositadas en recipientes se mantienen allí mediante colisión.

Consulta [PRUEBAS.md](./PRUEBAS.md) para la suite, la lista de aceptación y las instrucciones del emulador y Quest 3. La clasificación, las estadísticas y los cronómetros corresponden a la etapa 5.

## Créditos

Derek Alejandro Vargas Meneses · ITIC · No. de Control 22200792 · TecNM Campus Pachuca.
