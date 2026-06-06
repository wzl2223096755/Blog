export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const path = url.searchParams.get('path') || '/';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const key = `pageview:${path}`;

  if (request.method === 'POST') {
    const count = await (env.COUNTER_KV ? env.COUNTER_KV.get(key) : null) || '0';
    const newCount = parseInt(count) + 1;
    if (env.COUNTER_KV) await env.COUNTER_KV.put(key, String(newCount));
    return new Response(JSON.stringify({ path, count: newCount }), { headers: corsHeaders });
  }

  const count = await (env.COUNTER_KV ? env.COUNTER_KV.get(key) : null) || '0';
  return new Response(JSON.stringify({ path, count: parseInt(count) }), { headers: corsHeaders });
}
