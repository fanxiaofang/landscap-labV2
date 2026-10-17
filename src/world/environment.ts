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
  meadow:'#879c43', meadowLight:'#a2b454', meadowShade:'#6b873f',
  shoulder:'#87965b', valley:'#b7b09c', farValley:'#cdb4ae',
  field:['#b8a458','#c3ae65','#aeb071','#d9b55e'],
  ridgeLight:'#9ba083',ridgeShadow:'#5f776b',ridgeRock:'#a49a91',
  atmosphere:'#c7b4ba',
};
