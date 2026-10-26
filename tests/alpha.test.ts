import { expect, test } from 'bun:test';
import { alphaFromRgba, alphaFromImageBitmap } from '../src/index';
test('RGBA alpha extraction owns its output and preserves exact alpha independently of color',()=>{
  for (const ArrayType of [Uint8Array,Uint8ClampedArray]) {
    const rgba=new ArrayType([255,0,0,255,1,2,3,0,255,255,255,64,0,0,0,128]);
    const before=rgba.slice(),alpha=alphaFromRgba(rgba,2,2);
    expect(alpha).toEqual(new Uint8Array([255,0,64,128]));
    alpha.fill(0);expect(rgba).toEqual(before);
  }
});
test('alpha extraction rejects malformed and oversized sources before allocating',()=>{
  expect(()=>alphaFromRgba(new Uint8Array(3),1,1)).toThrow();
  expect(()=>alphaFromRgba(new Uint8Array(4),NaN,1)).toThrow();
  expect(()=>alphaFromRgba(new Uint8Array(4),8192,8192)).toThrow();
  expect(()=>alphaFromImageBitmap({width:1,height:1} as ImageBitmap)).toThrow();
});
