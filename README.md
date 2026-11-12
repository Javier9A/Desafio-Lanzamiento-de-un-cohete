# Euler en el Espacio 🚀
Estudiante: Javier Averanga Quelka

Simulación web del lanzamiento de un cohete experimental (Métodos Numéricos).

Modelo: `m·dv/dt = T − m·g − k·v`, `dy/dt = v` → `v' = 5,19 − 0,1·v`, `y' = v`.

## Qué incluye
- Parámetros editables (m, T, g, k, v₀, y₀, t₀, t_f, h).
- Métodos de Euler, Heun y Runge-Kutta 4 + solución analítica.
- Tablas de iteraciones con error absoluto y relativo.
- Gráficas de v(t), y(t) y de los errores (canvas, sin dependencias).
- Análisis del tamaño de paso y respuestas a las preguntas de reflexión.

## Ejecutar
Abrir `index.html` en el navegador

## Resultados de verificación (h = 2 s, t = 20 s)
| Método | v (m/s) | y (m) |
|---|---|---|
| Exacta | 44,8761 | 589,2390 |
| Euler | 46,3273 | 574,7272 |
| Heun | 44,7664 | 590,3355 |
| RK4 | 44,8759 | 589,2412 |
