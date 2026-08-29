/**
 * Cloudflare Pages Function - 保存费曼学习卡数据到 KV
 * POST /api/feynman/save
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!env.FEYNMAN_DATA) {
      return new Response(
        JSON.stringify({ error: 'KV namespace not configured. Please bind FEYNMAN_DATA in Cloudflare Pages settings.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();

    if (!body.passkey || !body.data) {
      return new Response(
        JSON.stringify({ error: 'Missing passkey or data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 用 passkey 的 SHA-256 hash 作为 KV key
    const encoder = new TextEncoder();
    const data = encoder.encode(body.passkey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const kvKey = `user:${hashHex}`;

    const dataWithMeta = {
      ...body.data,
      lastSyncAt: new Date().toISOString(),
    };

    await env.FEYNMAN_DATA.put(kvKey, JSON.stringify(dataWithMeta));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data saved successfully',
        lastSyncAt: dataWithMeta.lastSyncAt,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to save data', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
