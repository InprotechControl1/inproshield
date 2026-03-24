const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { property_data, agent_name, agent_phone } = JSON.parse(event.body);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

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

  const result = await model.generateContent(prompt);
  const message = result.response.text();

  return {
    statusCode: 200,
    body: JSON.stringify({ message })
  };
};
