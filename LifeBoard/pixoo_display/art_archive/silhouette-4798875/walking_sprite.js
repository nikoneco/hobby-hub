// Archived from 4798875; shared rendering helpers are required.
const NIGHT_CAT_COLOR = [188, 198, 210];

function drawWalkingCat(frame, x, y, phase, goingRight) {
  const pattern = [
    '.........................##.',
    '..........................#.',
    '..........................#.',
    '.........................##.',
    '..#...#.................##..',
    '..##.##...............###...',
    '.######....########..###....',
    '########.##############.....',
    '.#######################....',
    '..######################....',
    '....###################.....',
    '......###...........###.....'
  ];
  drawNightCatPattern(frame, pattern, x, y, goingRight);
  const stride = Number(phase || 0) % 2;
  const legs = stride ? [
    [[7, 11], [8, 14], [9, 15]], [[9, 11], [6, 14], [5, 15]],
    [[20, 11], [19, 14], [18, 15]], [[22, 11], [23, 14], [24, 15]]
  ] : [
    [[7, 11], [5, 14], [4, 15]], [[9, 11], [9, 14], [10, 15]],
    [[20, 11], [22, 14], [23, 15]], [[22, 11], [20, 14], [19, 15]]
  ];
  legs.forEach((points) => points.slice(1).forEach(([x2, y2], index) => {
    const [x1, y1] = points[index];
    const mirrorX = (sx) => goingRight ? 27 - sx : sx;
    drawLine(frame, x + mirrorX(x1), y + y1, x + mirrorX(x2), y + y2, NIGHT_CAT_COLOR);
  }));
}
