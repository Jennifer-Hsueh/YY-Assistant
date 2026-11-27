// 書背圖(public/bookshelf/spine/01–12、year):每個月固定一款,年鑑另一款
// 圖上留了「年度」「月份」的空白,程式把年份、月份寫上去
import { spineSrc, isYearKey } from '../../lib/book';

// 文字位置(書背高度的比例,依原圖 177×2480／354×2480 量的)
const MONTH_POS = { year: 0.298, month: 0.403 };
const YEAR_POS = 0.362;
const ink = { position: 'absolute', left: 0, right: 0, textAlign: 'center', transform: 'translateY(-50%)', lineHeight: 1,
  color: '#4A2418', fontFamily: '"Noto Serif TC", "Noto Serif JP", serif', fontWeight: 700, fontVariantNumeric: 'lining-nums', whiteSpace: 'nowrap' };

// w、h:顯示大小(px);small:書櫃上用小圖;minText:書背太窄時不寫字
export default function Spine({ ym, w, h, small = false, minText = 12 }) {
  const year = isYearKey(ym);
  const showText = w >= minText;
  return (
    <>
      <img src={spineSrc(ym, small)} alt="" draggable={false} crossOrigin="anonymous"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />
      {showText && (year ? (
        <div style={{ ...ink, top: h * YEAR_POS, fontSize: w * 0.2 }}>{ym}</div>
      ) : (
        <>
          <div style={{ ...ink, top: h * MONTH_POS.year, fontSize: w * 0.25 }}>{ym.slice(0, 4)}</div>
          <div style={{ ...ink, top: h * MONTH_POS.month, fontSize: w * 0.34 }}>{Number(ym.slice(5, 7))}</div>
        </>
      ))}
    </>
  );
}
