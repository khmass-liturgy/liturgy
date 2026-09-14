// 교하성당 홈페이지(https://sd.uca.or.kr/kyoha/)에서 공지사항/주보안내를 가져와
// data/kyoha-updates.json 으로 저장한다. GitHub Actions에서 주기적으로 실행된다.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'data', 'kyoha-updates.json');

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; KyohaLiturgyBot/1.0)' };

async function fetchText(url) {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

function parseNotices(html) {
  const notices = [];
  const re = /<a href="(board_view\.aspx\?mnucd=20001877&board_seq=\d+)">\s*<p>([^<]*)<\/p><span>([^<]*)<\/span>/g;
  let m;
  while ((m = re.exec(html))) {
    notices.push({
      title: m[2].trim(),
      date: m[3].trim(),
      url: 'https://sd.uca.or.kr/kyoha/' + m[1],
    });
  }
  return notices.slice(0, 5);
}

function parseBulletins(html) {
  const bulletins = [];
  const re = /top\.location\.href='([^']+)';return false;[\s\S]{0,300}?<p class="title">([^<]*)<\/p>\s*<p class="data">([^<]*)<\/p>/g;
  let m;
  while ((m = re.exec(html))) {
    let url = m[1];
    if (url.startsWith('/')) url = 'https://sd.uca.or.kr' + url;
    bulletins.push({ title: m[2].trim(), date: m[3].trim(), url });
  }
  return bulletins.slice(0, 5);
}

async function main() {
  const home = await fetchText('https://sd.uca.or.kr/kyoha/');
  const notices = parseNotices(home);

  let bulletins = [];
  try {
    const jubo = await fetchText('https://sd.uca.or.kr/kyoha/jubo?mnucd=20001570');
    bulletins = parseBulletins(jubo);
  } catch (e) {
    console.warn('주보안내 페이지 조회 실패:', e.message);
  }

  if (notices.length === 0 && bulletins.length === 0) {
    throw new Error('공지사항/주보안내를 하나도 가져오지 못했습니다 — 홈페이지 구조가 변경되었을 수 있습니다.');
  }

  const data = {
    notices,
    bulletins,
    updatedAt: new Date().toISOString(),
    source: 'https://sd.uca.or.kr/kyoha/',
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`저장 완료: ${OUT_PATH}`);
  console.log(`공지사항 ${notices.length}건, 주보안내 ${bulletins.length}건`);
}

main().catch(err => {
  console.error('업데이트 실패:', err);
  process.exit(1);
});
