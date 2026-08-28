/**
 * Cloudflare Pages Function - 从 KV 加载费曼学习卡数据
 * POST /api/feynman/load
 * Body: { passkey: string }
 */

interface Env {
  FEYNMAN_DATA: KVNamespace;
}

interface LoadRequest {
  passkey: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: LoadRequest = await request.json();
    
    if (!body.passkey) {
      return new Response(
        JSON.stringify({ error: 'Missing passkey' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 使用 passkey 的 hash 作为 KV key
    const encoder = new TextEncoder();
    const data = encoder.encode(body.passkey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const kvKey = `user:${hashHex}`;
    
    // 从 KV 读取数据
    const storedData = await env.FEYNMAN_DATA.get(kvKey);
    
    if (!storedData) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: null,
          message: 'No data found for this passkey' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsedData = JSON.parse(storedData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsedData,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Load error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to load data', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
