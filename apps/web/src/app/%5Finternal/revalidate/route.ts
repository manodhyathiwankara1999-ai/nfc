import { revalidatePath, revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

const RevalidateSchema = z.object({
  slugs: z
    .array(z.string().regex(/^[A-Za-z0-9_-]{3,100}$/))
    .min(1)
    .max(100),
});

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATION_SECRET;
  const authorization = request.headers.get('authorization') ?? '';
  const provided = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = RevalidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid revalidation request' }, { status: 400 });
  }

  for (const slug of new Set(parsed.data.slugs)) {
    revalidatePath(`/u/${slug}`);
    revalidateTag(`profile:${slug}`);
  }
  return NextResponse.json({ revalidated: true });
}
