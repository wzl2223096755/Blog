/**
 * Cloudflare Pages Function - 保存费曼学习卡数据到 KV
 * POST /api/feynman/save
 * Body: { passkey: string, data: object }
 */

interface Env {
  FEYNMAN_DATA: KVNamespace;
}

interface SaveRequest {
  passkey: string;
  data: {
    cards: any[];
    habits: any[];
    subjects: string[];
    settings: any;
  };
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
    const body: SaveRequest = await request.json();
    
    if (!body.passkey || !body.data) {
      return new Response(
        JSON.stringify({ error: 'Missing passkey or data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 使用 passkey 的 hash 作为 KV key（简单的用户隔离）
    const encoder = new TextEncoder();
    const data = encoder.encode(body.passkey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const kvKey = `user:${hashHex}`;
    
    // 保存数据到 KV，添加时间戳
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
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Save error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to save data', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
