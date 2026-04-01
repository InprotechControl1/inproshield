// functions/analizar/index.js
export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await context.request.json();
  const { ubicacion, area, habitaciones, banos, estacionamientos } = body;

  // ========= DATOS DE PRUEBA =========
  // Reemplaza esta sección con scraping real más adelante
  const ofertas = [
    { direccion: "Av. Principal, Barquisimeto", precio: 150000, area: 120, habitaciones: 3, banos: 2, estacionamientos: 2, portal: "tuinmueble" },
    { direccion: "Calle 2, Barquisimeto", precio: 165000, area: 130, habitaciones: 3, banos: 2, estacionamientos: 2, portal: "conallalve" },
    { direccion: "Av. Libertador, Barquisimeto", precio: 140000, area: 110, habitaciones: 2, banos: 2, estacionamientos: 1, portal: "remax" },
    { direccion: "Urb. Las Trinitarias", precio: 185000, area: 140, habitaciones: 3, banos: 3, estacionamientos: 2, portal: "century21" }
  ];
  // =================================

  // Filtrar comparables según características objetivo
  let comparables = ofertas.filter(o =>
    Math.abs(o.area - area) / area <= 0.2 &&
    Math.abs(o.habitaciones - habitaciones) <= 1 &&
    Math.abs(o.banos - banos) <= 1 &&
    Math.abs(o.estacionamientos - estacionamientos) <= 1
  );

  if (comparables.length < 3) {
    return new Response(JSON.stringify({ error: "No hay suficientes ofertas comparables" }), { status: 404 });
  }

  const resultado = analizarACM(comparables, area);
  return new Response(JSON.stringify(resultado), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Analiza las ofertas según la metodología ACM.
 * @param {Array} ofertas - Lista de objetos con precio, area, etc.
 * @param {number} targetArea - Área del inmueble objetivo.
 * @returns {Object} Resultados estadísticos y valor sugerido.
 */
function analizarACM(ofertas, targetArea) {
  // 1. Calcular valor unitario (USD/m²)
  const valores = ofertas.map(o => o.precio / o.area);

  // 2. Depuración por rango del 15% (media ± 15%)
  const media = valores.reduce((a,b) => a+b, 0) / valores.length;
  const inferior = media * 0.85;
  const superior = media * 1.15;
  const depurados = valores.filter(v => v >= inferior && v <= superior);

  // 3. Estadísticos de la muestra depurada
  const mediaDepurada = depurados.reduce((a,b) => a+b, 0) / depurados.length;
  const ordenados = [...depurados].sort((a,b) => a-b);
  const mediana = ordenados[Math.floor(ordenados.length/2)];
  const moda = calcularModa(depurados);
  const desviacion = Math.sqrt(depurados.map(v => Math.pow(v - mediaDepurada, 2)).reduce((a,b)=>a+b,0) / depurados.length);
  const cv = (desviacion / mediaDepurada) * 100;

  // 4. Valor sugerido y rango de negociación (±5% sobre total)
  const sugeridoUnitario = mediaDepurada;
  const sugeridoTotal = sugeridoUnitario * targetArea;
  const rangoInferior = sugeridoTotal * 0.95;
  const rangoSuperior = sugeridoTotal * 1.05;

  // 5. Retornar objeto con todos los resultados
  return {
    estadisticos: {
      media: mediaDepurada,
      mediana,
      moda,
      desviacion_std: desviacion,
      coeficiente_variacion: cv,
      minimo: Math.min(...depurados),
      maximo: Math.max(...depurados),
      rango: Math.max(...depurados) - Math.min(...depurados),
      n_muestras: depurados.length
    },
    sugerido_unitario: sugeridoUnitario,
    sugerido_total: sugeridoTotal,
    rango_negociacion: [rangoInferior, rangoSuperior],
    // Muestras depurada y original (para referencia)
    muestra_depurada: ofertas.filter((_, i) => valores[i] >= inferior && valores[i] <= superior),
    muestra_original: ofertas
  };
}

/**
 * Calcula la moda de un arreglo de números.
 * @param {number[]} arr - Arreglo de números.
 * @returns {number|null} Valor modal o null si no hay moda.
 */
function calcularModa(arr) {
  const freq = {};
  arr.forEach(v => freq[v] = (freq[v] || 0) + 1);
  let maxFreq = 0, moda = null;
  for (let val in freq) {
    if (freq[val] > maxFreq) {
      maxFreq = freq[val];
      moda = parseFloat(val);
    }
  }
  // Si todos tienen frecuencia 1, no hay moda real (retornamos null)
  return maxFreq > 1 ? moda : null;
}