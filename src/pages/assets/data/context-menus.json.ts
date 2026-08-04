import reference from '../../../data/generated/context-menus.json';

export const prerender = true;

export function GET() {
  return new Response(JSON.stringify(reference), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
