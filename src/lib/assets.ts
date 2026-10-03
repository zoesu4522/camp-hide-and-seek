/**
 * 正式圖片素材路徑。
 *
 * 目前素材尚未提供，所以 `ready: false`，畫面會使用 CSS / SVG placeholder。
 * 把對應 WebP 放進 /public/camp/ 之後，把 `ready` 改成 true 即可切換為 next/image。
 */
export interface CampAsset {
  src: string;
  width: number;
  height: number;
  ready: boolean;
}

export const CAMP_ASSETS = {
  background: { src: "/camp/background-night.webp", width: 1080, height: 2340, ready: false },
  treeLeft: { src: "/camp/tree-left.webp", width: 360, height: 1200, ready: false },
  treeRight: { src: "/camp/tree-right.webp", width: 360, height: 1200, ready: false },
  tent: { src: "/camp/tent.webp", width: 640, height: 480, ready: false },
  campfire: { src: "/camp/campfire.webp", width: 400, height: 400, ready: false },
  logo: { src: "/camp/logo.webp", width: 960, height: 360, ready: false },
  woodBoard: { src: "/camp/wood-board.webp", width: 960, height: 200, ready: false },
  personHidden: { src: "/camp/person-hidden.webp", width: 320, height: 400, ready: false },
  personFound: { src: "/camp/person-found.webp", width: 320, height: 400, ready: false },
} satisfies Record<string, CampAsset>;
