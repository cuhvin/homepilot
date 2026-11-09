// HomePilot mark: the same pixel-art house as the street view, on a sky tile.
// 16x16 grid; each character is one pixel (see PALETTE).
const PIXELS = [
  '................',
  '..........CC....',
  '.......RR.CC....',
  '......RRRRCC....',
  '.....RRRRRRR....',
  '....RRRRRRRRR...',
  '...RRRRRRRRRRR..',
  '..rrrrrrrrrrrrr.',
  '...WWWWWWWWWWW..',
  '...WYYWWWWWDDW..',
  '...WYYWWWWWDDW..',
  '...WWWWWWWWDDW..',
  '...WWWWWWWWDkW..',
  '...wwwwwwwwDDw..',
  '.GGGGGGGGGGGGGG.',
  '................',
];

const PALETTE: Record<string, string> = {
  R: '#d0653f', r: '#9a4835', C: '#8a4a38', W: '#f3e9da', w: '#d6c6b2',
  Y: '#ffd27a', D: '#3f6e8c', k: '#e7c15a', G: '#6dbb5e',
};

const RECTS = PIXELS.flatMap((row, y) =>
  [...row].flatMap((ch, x) => (PALETTE[ch] ? [{ x, y, c: PALETTE[ch] }] : [])),
);

export function Logo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-1 -0.5 18 18" aria-hidden="true" className="logo" shapeRendering="crispEdges">
      <rect x="-1" y="-0.5" width="18" height="18" rx="3.6" fill="#8fc7ef" />
      <rect x="-1" y="11.5" width="18" height="6" fill="#7fbde8" />
      {RECTS.map((p) => <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width="1.02" height="1.02" fill={p.c} />)}
    </svg>
  );
}
