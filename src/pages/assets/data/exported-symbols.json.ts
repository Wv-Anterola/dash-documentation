import reference from '../../../data/generated/exported-symbols.json';

export const prerender = true;

export function GET(): Response {
  return new Response(JSON.stringify(reference), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
