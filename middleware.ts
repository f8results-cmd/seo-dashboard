import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Protect /agency routes — only sebastian@figure8results.com
  if (pathname.startsWith('/agency')) {
    if (!user) {
      return NextResponse.redirect(new URL('/auth/agency', request.url));
    }
    if (user.email !== 'sebastian@figure8results.com') {
      return NextResponse.redirect(new URL('/auth/agency?error=unauthorized', request.url));
    }
  }

  // Protect /portal routes — any authenticated user
  if (pathname.startsWith('/portal')) {
    if (!user) {
      return NextResponse.redirect(new URL('/auth/portal', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/agency/:path*', '/portal/:path*'],
};
