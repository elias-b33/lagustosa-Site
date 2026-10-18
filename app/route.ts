import restaurantPage from '../public/index.html?raw';

export function GET() {
  return new Response(restaurantPage, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
