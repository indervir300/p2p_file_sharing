import { NextResponse } from 'next/server';

function getMeta(html, ...properties) {
  for (const prop of properties) {
    const m =
      html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
      html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'));
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });

    const html     = await res.text();
    const hostname = new URL(url).hostname.replace(/^www\./, '');

    const title       = getMeta(html, 'og:title', 'twitter:title') ||
                        html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || null;
    const description = getMeta(html, 'og:description', 'twitter:description', 'description');
    const image       = getMeta(html, 'og:image', 'twitter:image');
    const siteName    = getMeta(html, 'og:site_name') || hostname;
    const favicon     = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;

    return NextResponse.json({ url, title, description, image, siteName, hostname, favicon });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch preview' }, { status: 500 });
  }
}
