// functions/analyze.js
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { url } = await request.json();
  if (!url) {
    return new Response(JSON.stringify({ error: 'URL requerida' }), { status: 400 });
  }

  const GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'API key no configurada' }), { status: 500 });
  }

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
   - caracteristicas: array de strings con características destacadas
   - imagenes: array de URLs de las imágenes principales (máximo 5)
   - url_original: la URL proporcionada
   - portal: nombre del portal

3. Si un campo no está disponible, usa null.
4. Para propiedades en bolívares (VES), intenta estimar el valor en USD usando el tipo de cambio del día (puedes hacer una búsqueda web rápida). Incluye ambos en un campo opcional "precio_usd_estimado".

Devuelve ÚNICAMENTE el objeto JSON.
`;

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`Gemini API error: ${geminiResponse.status} ${errorText}`);
    }

    const data = await geminiResponse.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('No se recibió respuesta válida de Gemini');

    const jsonMatch = rawText.match(/\{.*\}/s);
    if (!jsonMatch) throw new Error('No se pudo extraer JSON de la respuesta');

    const propertyData = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(propertyData), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}