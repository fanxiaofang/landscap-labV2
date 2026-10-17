export type Season = 'autumn' | 'winter' | 'spring' | 'summer';
export interface EnvironmentState {
  season: Season;
  sky: { top: string; horizon: string };
  cloudSea: { enabled: false; elevation: number; thickness: number };
}
// V0.1 has no cloud geometry or seasonal switching. This is an integration contract only.
export const AUTUMN: EnvironmentState = {
  season:'autumn', sky:{top:'#bc8492',horizon:'#ffd391'},
  cloudSea:{enabled:false,elevation:-290,thickness:80},
};
export const PALETTE = {
  meadow:'#8a9b40', meadowLight:'#a1ac4c', meadowShade:'#6b833c',
  shoulder:'#89904e', valley:'#a29b89', farValley:'#c9a5a0',
  field:['#c7a34c','#d3b257','#be9745','#d5b761'],
  ridgeLight:'#a9a476',ridgeShadow:'#52675b',ridgeRock:'#96918a',
  atmosphere:'#b8a4ad',
};
