import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const formData = await request.formData();
  const lang = formData.get('lang');
  const next = request.headers.get('referer') ?? '/sign-in';

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set('lang', lang === 'en' ? 'en' : 'zh', {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
  });

  return response;
}
