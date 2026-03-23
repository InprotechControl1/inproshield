const fetch = require('node-fetch');

// ── WHITELIST ────────────────────────────────────────────────────────
const WHITELIST_EXACT = new Set([
  'urlscan.io','virustotal.com','phishtank.com','eicar.org','malshare.com',
  'hybrid-analysis.com','any.run','joesandbox.com','otx.alienvault.com',
  'talosintelligence.com','opendns.com','sucuri.net','wordfence.com',
  'malwarebazaar.abuse.ch','google.com','microsoft.com','apple.com',
  'amazon.com','cloudflare.com','github.com','gitlab.com','stackoverflow.com',
  'wikipedia.org','medium.com','dev.to','github.io','youtube.com',
  'twitter.com','linkedin.com','facebook.com','instagram.com','netflix.com',
  'spotify.com','dropbox.com','notion.so','slack.com','zoom.us',
  'figma.com','canva.com','netlify.app','netlify.com','vercel.app',
  'vercel.com','anthropic.com','openai.com','claude.ai','urlvoid.com',
  'bit.ly','tinyurl.com','goo.gl','ow.ly','t.co','lnkd.in',
  'linktr.ee','rebrandly.com','short.io','usa.gov','mit.edu',
  'stanford.edu','harvard.edu'
]);
const WHITELIST_SUFFIXES = ['.gov','.gob.mx','.gob.es','.gov.uk','.edu','.edu.mx','.edu.es','.mil'];

// ── SHORTENERS ───────────────────────────────────────────────────────
const SHORTENERS = {
  low:    ['t.co','lnkd.in','linktr.ee','rebrandly.com','goo.gl','short.io'],
  medium: ['bit.ly','tinyurl.com','cutt.ly','ow.ly','buff.ly','is.gd','v.gd','shorturl.at','tiny.cc','short.link'],
  high:   ['shorte.st','adf.ly','bc.vc','za.gl','clk.sh']
};

// ── PATTERNS ─────────────────────────────────────────────────────────
const PATTERNS_HIGH = [
  /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
  /(login|verify|account|secure|update|confirm).*redirect/i,
  /(paypa1|paypall|arnazon|amaz0n|g00gle|micros0ft|app1e|faceb00k|netfl1x)/i,
  /\.(exe|scr|bat|ps1|vbs|cmd)$/i
];
const PATTERNS_MED = [
  /(free.*prize|winner.*claim|urgent.*limited|act-now)/i,
  /(password|bank.*login|credit.*card)/i,
  /[a-z0-9\-]{40,}/
];
const RISKY_TLDS = /\.(tk|ml|ga|cf|gq|top|work|click|download|xyz|zip|mov)$/i;

// ── HELPERS ──────────────────────────────────────────────────────────
function normalizeUrl(raw) {
  let url = raw.trim().toLowerCase();
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
  return url.replace(/\/+$/, '');
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch(e) { return ''; }
}

function isWhitelisted(domain) {
  if (WHITELIST_EXACT.has(domain)) return true;
  for (const sfx of WHITELIST_SUFFIXES) { if (domain.endsWith(sfx)) return true; }
  return false;
}

function checkShortener(domain) {
  if (SHORTENERS.high.includes(domain))   return { is: true, risk: 'high',   score: 30 };
  if (SHORTENERS.medium.includes(domain)) return { is: true, risk: 'medium', score: 15 };
  if (SHORTENERS.low.includes(domain))    return { is: true, risk: 'low',    score: 5  };
  return { is: false, risk: 'none', score: 0 };
}

function localScore(url, domain) {
  let score = 0;
  const flags = [];
  if (!url.startsWith('https://')) { flags.push('Sin HTTPS — conexión no cifrada'); score += 25; }
  const short = checkShortener(domain);
  if (short.is) {
    const lbl = short.risk === 'high' ? 'alto' : short.risk === 'medium' ? 'medio' : 'bajo';
    flags.push(`Acortador de URL detectado — riesgo ${lbl}`);
    score += short.score;
  }
  if (RISKY_TLDS.test(domain)) { flags.push('Extensión de dominio de alto riesgo'); score += 30; }
  PATTERNS_HIGH.forEach(r => { if (r.test(url)) score += 20; });
  PATTERNS_MED.forEach(r => { if (r.test(url)) score += 10; });
  if (flags.length === 0) flags.push('No se detectaron señales locales críticas');
  return { score: Math.min(score, 98), flags, shortener: short.is ? short : null };
}

async function resolveRedirects(url) {
  try {
    const resp = await fetch(url, {
      method: 'HEAD', redirect: 'follow',
      timeout: 5000,
      headers: { 'User-Agent': 'LinkShield/1.0 (security scanner)' }
    });
    return resp.url !== url ? resp.url : null;
  } catch(e) { return null; }
}

async function analyzeWithClaude(url, localFlags, apiKey) {
  const prompt = `Analiza esta URL en busca de amenazas de seguridad cibernética: ${url}

Señales detectadas localmente: ${localFlags.join(', ')}

REGLAS IMPORTANTES:
- Si el dominio pertenece a servicios legítimos conocidos (Google, Microsoft, GitHub, Wikipedia, Netflix, Spotify, Amazon, Apple, etc.) responde SIEMPRE con riesgo "bajo" y tipo "legítimo"
- Analiza si la URL tiene patrones de phishing, malware, scam o spam
- Sé específico en las señales y contramedidas

Responde SOLO con JSON válido sin backticks ni texto adicional:
{"riesgo":"alto"|"medio"|"bajo","tipo":"phishing"|"malware"|"scam"|"spam"|"legítimo"|"desconocido","resumen":"Una oración concisa sobre qué es este sitio o por qué es sospechoso","señales":["señal específica 1","señal específica 2","señal específica 3"],"contramedidas":["acción concreta 1","acción concreta 2","acción concreta 3"],"recomendacion":"Una frase clara de qué debe hacer el usuario"}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!resp.ok) throw new Error(`Claude API error: ${resp.status}`);
  const data = await resp.json();
  const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const m = txt.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON in Claude response');
  return JSON.parse(m[0]);
}

// ── HANDLER ──────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { url: rawUrl } = JSON.parse(event.body || '{}');
    if (!rawUrl) return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL requerida' }) };

    const url = normalizeUrl(rawUrl);
    const domain = extractDomain(url);
    const parsed = { host: domain, https: url.startsWith('https:'), hasSub: domain.split('.').length > 2 };

    // 1. Whitelist check
    if (isWhitelisted(domain)) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          url, domain, parsed,
          whitelisted: true,
          riesgo: 'bajo', score: 0,
          tipo: 'legítimo',
          resumen: 'Dominio verificado en lista blanca de confianza.',
          señales: ['Dominio en lista blanca de confianza'],
          contramedidas: ['Puedes acceder con confianza', 'Verifica que la URL sea exacta', 'No compartas contraseñas innecesariamente'],
          recomendacion: 'Este dominio es de confianza. Puedes acceder con seguridad.',
          shortener: null,
          finalUrl: null
        })
      };
    }

    // 2. Local analysis
    const local = localScore(url, domain);

    // 3. Resolve redirects if shortener
    let finalUrl = null;
    if (local.shortener && local.shortener.is) {
      finalUrl = await resolveRedirects(url);
    }

    // 4. Claude AI analysis
    const apiKey = process.env.ANTHROPIC_API_KEY;
    let aiResult = null;
    if (apiKey) {
      try {
        aiResult = await analyzeWithClaude(finalUrl || url, local.flags, apiKey);
      } catch(e) {
        console.error('Claude error:', e.message);
      }
    }

    // 5. Final score
    let riesgo, score;
    if (aiResult) {
      riesgo = aiResult.riesgo;
      score = riesgo === 'alto' ? Math.max(local.score, 75) : riesgo === 'medio' ? Math.max(local.score, 40) : Math.min(local.score, 25);
    } else {
      score = local.score;
      riesgo = score > 50 ? 'alto' : score > 20 ? 'medio' : 'bajo';
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        url, domain, parsed,
        whitelisted: false,
        riesgo, score: Math.round(score),
        tipo: aiResult?.tipo || 'desconocido',
        resumen: aiResult?.resumen || 'Análisis basado en patrones locales.',
        señales: aiResult?.señales || local.flags,
        contramedidas: aiResult?.contramedidas || ['No hagas clic en este enlace', 'No ingreses datos personales', 'Reporta si lo recibiste por mensaje'],
        recomendacion: aiResult?.recomendacion || (riesgo === 'bajo' ? 'El link parece seguro.' : 'Evita acceder a este link.'),
        shortener: local.shortener,
        finalUrl,
        analyzedBy: aiResult ? 'Claude AI + web search' : 'análisis local'
      })
    };

  } catch(e) {
    console.error('Handler error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno del servidor' }) };
  }
};
