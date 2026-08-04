import reference from '../../../data/generated/document-types.json';

export const prerender = true;

export function GET() {
  return new Response(JSON.stringify(reference), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
