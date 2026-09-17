import { NextResponse } from 'next/server';
import { resolveLang } from '@/lib/i18n/translations';

export async function POST(request: Request) {
  const formData = await request.formData();
  const lang = resolveLang(formData.get('lang')?.toString());
  const next = request.headers.get('referer') ?? '/sign-in';

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set('lang', lang, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
  });

  return response;
}
