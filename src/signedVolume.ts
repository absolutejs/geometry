export function signedVolume(p: Float64Array, i: Uint32Array) {
  const o = i[0]! * 3, ox = p[o]!, oy = p[o+1]!, oz = p[o+2]!;
  let sum = 0, error = 0;
  for (let t = 0; t < i.length; t += 3) {
    const a = i[t]! * 3, b = i[t+1]! * 3, c = i[t+2]! * 3;
    const ax = p[a]! - ox, ay = p[a+1]! - oy, az = p[a+2]! - oz;
    const bx = p[b]! - ox, by = p[b+1]! - oy, bz = p[b+2]! - oz;
    const cx = p[c]! - ox, cy = p[c+1]! - oy, cz = p[c+2]! - oz;
    const term = (ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6;
    const increment = term - error, next = sum + increment;
    error = next - sum - increment; sum = next;
  }
  return sum;
}
