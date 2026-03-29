// functions/whatsapp.js
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { property_data, agent_name, agent_phone } = await request.json();
  if (!property_data || !agent_name || !agent_phone) {
    return new Response(JSON.stringify({ error: 'Datos incompletos' }), { status: 400 });
  }

  const GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'API key no configurada' }), { status: 500 });
  }

  const prompt = `
Genera un mensaje corto y persuasivo para WhatsApp basado en los siguientes datos de una propiedad inmobiliaria. El agente se llama ${agent_name} y su teléfono es ${agent_phone}.

Datos de la propiedad:
- Título: ${property_data.titulo}
- Precio: ${property_data.precio} ${property_data.moneda}
- Habitaciones: ${property_data.habitaciones}
- Baños: ${property_data.banos}
- Superficie: ${property_data.superficie} m²
- Ubicación: ${property_data.ubicacion}
- Características destacadas: ${property_data.caracteristicas ? property_data.caracteristicas.join(', ') : 'N/A'}
- Descripción: ${property_data.descripcion}

Reglas:
1. Máximo 400 caracteres.
2. Incluir emojis relevantes (🏠, 🔑, 📍, 💰).
3. Destacar el precio y las características más atractivas.
4. Terminar con un llamado a la acción y los datos de contacto del agente.
5. Tono: entusiasta, profesional, cercano.

Devuelve ÚNICAMENTE el texto del mensaje.
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
    const message = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!message) throw new Error('No se recibió mensaje de Gemini');

    return new Response(JSON.stringify({ message }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}