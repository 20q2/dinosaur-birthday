export function hueToColor(hue, saturation = 70, lightness = 50) {
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
