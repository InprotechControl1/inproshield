export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }

  try {
    const body = await request.json();
    const response = await fetch('https://valorapp-555636979224.us-central1.run.app/valorar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.VALORAPP_API_KEY
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
