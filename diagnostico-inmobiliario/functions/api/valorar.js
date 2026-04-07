// functions/api/valorar.js

export async function onRequestPost(context) {
  try {
    // 1. Recibir datos del formulario del frontend
    const inputData = await context.request.json();

    // 2. Llamada al nuevo Nodo de Bypass (Tu Worker recién creado)
    // Esto salta el bloqueo geográfico gracias al Smart Placement
    const bypassResponse = await fetch('https://inproshield-api-proxy.rainiercasanova.workers.dev/api/valorar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(inputData)
    });

    const result = await bypassResponse.json();

    // 3. Devolver la respuesta limpia al frontend
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      integrity_score: 0, 
      error: "Error de conexión con el nodo de bypass" 
    }), { status: 500 });
  }
}
