const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { url } = JSON.parse(event.body);
    if (!url) {
      return { statusCode: 400, body: JSON.stringify({ error: 'URL requerida' }) };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `
Analiza la siguiente URL de un portal inmobiliario y extrae la información estructurada de la propiedad.

URL: ${url}

Instrucciones:
1. Accede al contenido de la URL (usa búsqueda web si es necesario).
2. Extrae los siguientes campos exactamente con estos nombres:
   - titulo: el título completo del anuncio
   - precio: solo el valor numérico (entero o decimal, sin símbolos)
   - moneda: "USD", "VES", "EUR" según corresponda
   - habitaciones: número entero (null si no aplica)
   - banos: número entero (null si no aplica)
   - superficie: número en metros cuadrados (null si no disponible)
   - ubicacion: texto con dirección, barrio y ciudad
   - descripcion: texto completo de la descripción
   - caracteristicas: array de strings con características destacadas (piscina, estacionamiento, etc.)
   - imagenes: array de URLs de las imágenes principales (máximo 5)
   - url_original: la URL proporcionada
   - portal: nombre del portal (ej. "Tucasa", "Zillow", "Clasificación")

3. Si un campo no está disponible, usa null.
4. Para propiedades en bolívares (VES), intenta estimar el valor en USD usando el tipo de cambio del día (puedes hacer una búsqueda web rápida). Incluye ambos en un campo opcional "precio_usd_estimado".

Devuelve ÚNICAMENTE el objeto JSON.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{.*\}/s);
    if (!jsonMatch) {
      throw new Error('No se pudo extraer JSON de la respuesta');
    }
    const propertyData = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(propertyData)
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al procesar la URL' })
    };
  }
};
