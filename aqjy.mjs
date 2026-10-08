#!/usr/bin/env node
// ============================================================================
// 山东科技大学 · 实验室安全教育系统（aqjy.sdust.edu.cn）一体化脚本
// ============================================================================
//
// 用法:
//   node aqjy.mjs <账号> <密码>              全自动：登录 → 完成学习中心全部课程 → 复核
//   node aqjy.mjs plan  <账号> <密码>        只读：列出课程 / 资源 / 已看进度 / 待学清单
//   node aqjy.mjs verify <账号> <密码>       只读：复核完成状态（全完成时退出码 0）
//   node aqjy.mjs qbank  <账号> <密码>       导出练习中心题库到 aqjy_题库速查.md
//   node aqjy.mjs status <账号> <密码> <路径>  抓任意路径，打印可见文本与相关链接
//
// 凭据也可用环境变量（不落盘，推荐）:
//   $env:AQJY_USER='<账号>'; $env:AQJY_PWD='<密码>'
//   也支持 --user <账号> --pwd <密码>
//   脚本内不含任何默认密码；取不到凭据即报错退出。
//
// 环境变量:
//   LIMIT=50   仅 qbank：每题库限制抓取题数（调试用）
//   CONC=5     仅 qbank：并发数
//
// ---------------------------------------------------------------------------
// 登录机制（两个坑，都必需）
//   1. 必须先 GET 登录页再 POST。服务端据此下发 token.value / i / s 令牌；
//      缺少这一步会返回「密码错误，可能是页面已经过期」，容易被误判为密码错。
//   2. 请求不要带 X-Requested-With: XMLHttpRequest。带上后会话被判定无效，
//      登录看似成功但后续接口全部返回「会话超时」。
//   密码为 RSA-2048 / PKCS#1 v1.5，明文与固定随机串逐字符交错后加密再 base64。
//
// 学习机制（来自站点前端 learnDetails.js / resource/view.js）
//   视频资源: ① POST viewingTime「打开视频」→ 否则 record 报
//                「请先打开视频后再记录学习时长!」
//             ② POST record {viewingTime,totalTime} 反复上报直到等于视频真实时长。
//                服务端校验增量：一次最多 +11 秒，超出报「视频学习时长异常!」，
//                故按 10 秒步进推进；失败则步进减半退让。
//             ③ 真实时长只能从视频文件本身读：Range 请求取头/尾，解析 mp4 的
//                mvhd 原子（timescale + duration）。猜数一律被拒。
//             ④ 走满后 POST updateDetail + learned，资源即从 unlearned[] 消失。
//   非视频资源: 直接 POST learned 即视为已学。
//   整门课程: unlearned[] 为空后 POST updateStatus {status:1} → 「已学完」。
//
// 结构: 培训(trainingId) → traineeId（每账号不同，必须动态取）
//        → 课程(trainingContentId) → 资源(resourceId)
//       trainingContentId / resourceId 全站共享，traineeId 每个账号不同。
// ============================================================================
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = 'http://aqjy.sdust.edu.cn';
const N_HEX = '83a1bbb97c661d1222cc253d3fafed3032cb7ace4b6e5fb01d2379542cee99dffc9015c4c1bd54418c17790c40b5b5cb86bb5fb190f2faa59cdff4a2fce8e19cee6643b24e5871c2e29fa86f91a6c0864d70165c8224f20d670f6540f4b049f049ce700fc6ee2abe1b0928034584ce5f1ce4c2afb6020ec64ee5a93de81fe4e5b2e1937e05ad50e99815f82fa951254f8fe9eb50b20e6a62e9b72f984037740738062702f1e35ee3873ed9ef25c85d57cb2dbc30bc83a44961daff03a6d8e7a0a91afd853e53784f79ebc8b4ed55e0b9eb2e4c260d0e8be6548957b671519d747bb3e993c93ddf2155e8fe1bcf4bbf4a64d651a7084643a435092d445a5805e1';
const RANDOM = '.wP7YpW.SaNhy08rltwFIKEa_qMx_66cSlZeSHBeT0UuVXf50s';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const STEP_MAX = 10;   // 服务端允许 11，留 1 秒余量
const MAX_ROUNDS = 6;  // 单门课程最多重扫轮数

// ---------------------------------------------------------------- 终端输出
const NAME_W = 30;
function width(s) {   // 粗略显示宽度：CJK 记 2
  let w = 0;
  for (const ch of s) w += ch.codePointAt(0) > 0x2e7f ? 2 : 1;
  return w;
}
function trunc(s, max = NAME_W) {
  if (width(s) <= max) return s;
  let out = '', w = 0;
  for (const ch of s) {
    const cw = ch.codePointAt(0) > 0x2e7f ? 2 : 1;
    if (w + cw > max - 1) break;
    out += ch; w += cw;
  }
  return out + '…';
}
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - width(s)));
const bar = (done, total, w = 18) => {
  const f = total ? Math.round((done / total) * w) : w;
  return '█'.repeat(f) + '░'.repeat(w - f);
};
const secs = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const rule = (c = '─') => console.log(c.repeat(74));

// ---------------------------------------------------------------- HTTP 会话
const jar = new Map();
function storeCookies(res) {
  for (const line of (res.headers.getSetCookie?.() ?? [])) {
    const pair = line.split(';')[0];
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
async function req(url, opts = {}) {
  // 不要加 X-Requested-With，否则会话会被判定无效。
  const headers = { 'User-Agent': UA, ...(opts.headers || {}) };
  if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30000), ...opts, headers });
  storeCookies(res);
  return res;
}
async function follow(url, opts = {}, max = 8) {
  let res = await req(url, opts);
  for (let n = 0; n < max && [301, 302, 303, 307, 308].includes(res.status); n++) {
    const loc = new URL(res.headers.get('location'), url).toString();
    res = await req(loc); url = loc;
  }
  return { res, url };
}
function encryptPassword(text) {
  const inter = [];
  for (let i = 0; i < text.length; i++) { inter.push(RANDOM[i]); inter.push(text[i]); }
  const key = crypto.createPublicKey({
    key: { kty: 'RSA', n: Buffer.from(N_HEX, 'hex').toString('base64url'), e: 'AQAB' },
    format: 'jwk',
  });
  return crypto.publicEncrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(inter.join(''), 'latin1')).toString('base64');
}
const getText = async (path) => (await follow(`${BASE}${path}`)).res.text();
const getJson = async (path) => {
  const t = await getText(path);
  try { return JSON.parse(t); } catch { return { statusCode: 'HTML' }; }
};
async function postJson(path, params) {
  const { res } = await follow(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Referer: `${BASE}/ept/manage/learn/` },
    body: new URLSearchParams(params).toString(),
  });
  const t = await res.text();
  try { return JSON.parse(t); } catch { return { statusCode: 'HTML', raw: t.slice(0, 200) }; }
}
const dec = (s) => s.replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const strip = (h) => dec(h
  .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

let ACCOUNT = '';
async function login(user, pwd) {
  ACCOUNT = user;
  await follow(`${BASE}/`);
  await follow(`${BASE}/ept/login/`);   // 必需：下发 token.value / i / s
  const { res } = await follow(`${BASE}/ept/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${BASE}/ept/login/` },
    body: new URLSearchParams({ username: user, password: encryptPassword(pwd) }).toString(),
  });
  const html = await res.text();
  if (/name="username"/.test(html)) {
    const err = (html.match(/<div class="error">([\s\S]*?)<\/div>/) || [, ''])[1].trim();
    console.error(`✗ 登录 ${user} 失败${err ? `：${err}` : ''}`);
    process.exit(1);
  }
  console.log(`账号 ${user}　登录成功 ✓`);
}

// ---------------------------------------------------------------- 结构解析
async function listTrainings() {
  const html = await getText('/ept/manage/learn/data');
  return [...html.matchAll(/<div class="list-group-item" rel="(\d+)"[\s\S]*?course-title">([\s\S]*?)<\/h4>/g)]
    .map((m) => ({ trainingId: m[1], name: strip(m[2]) }));
}
async function traineeIdOf(trainingId) {
  const j = await getJson(`/ept/manage/learn/check?trainingId=${trainingId}&forwardIndex=false`);
  const m = j.forwardUrl && j.forwardUrl.match(/traineeId=(\d+)/);
  return m ? m[1] : null;
}
async function contentsOf(traineeId) {
  const html = await getText(`/ept/manage/learn/content?traineeId=${traineeId}`);
  return [...html.matchAll(/<div class="div-course" rel="(\d+)"\s*time="([^"]*)"[\s\S]*?div-cousre-title">([\s\S]*?)<\/div>/g)]
    .map((m) => ({ contentId: m[1], minTime: m[2], name: strip(m[3]) }));
}
async function resourcesOf(contentId, traineeId) {
  const html = await getText(`/ept/manage/learn/contentDetail?trainingContentId=${contentId}&traineeId=${traineeId}`);
  const out = [];
  for (const m of html.matchAll(/<tr rel="(\d+)"([^>]*)>([\s\S]*?)<\/tr>/g)) {
    const body = m[3];
    out.push({
      resourceId: m[1],
      type: (body.match(/name="type"\s+value="(\d+)"/) || [])[1] || '',
      path: (body.match(/name="path"\s+value="([^"]*)"/) || [])[1] || '',
      name: strip((body.match(/<td class="tl">([\s\S]*?)<\/td>/) || [])[1] || ''),
      rate: Number((body.match(/video-rate">\s*([\d.]+)/) || [])[1] ?? NaN),
    });
  }
  return out;
}
const isVideo = (r) => r.type === '4' && /\.mp4$/i.test(r.path);
/** 查询课程的待学资源；resourceId 传 0，纯查询不产生副作用 */
async function unlearnedOf(contentId, traineeId) {
  const j = await postJson('/ept/manage/learn/learned', { trainingContentId: contentId, traineeId, resourceId: 0 });
  const d = j.data || {};
  return Array.isArray(d.unlearned) ? d.unlearned.map(Number) : [];
}
/** 课程是否已“已学完”（服务端 form-bar 渲染结果） */
async function courseBarDone(contentId, traineeId) {
  const html = await getText(`/ept/manage/learn/contentDetail?trainingContentId=${contentId}&traineeId=${traineeId}`);
  const bar = strip((html.match(/form-bar[\s\S]{0,300}/) || [''])[0]);
  return /已学完/.test(bar) && !/确认已学完/.test(bar);
}

// ---------------------------------------------------------------- mp4 真实时长
function parseMvhd(buf) {
  const i = buf.indexOf('mvhd');
  if (i < 0) return null;
  const p = i + 4, version = buf[p];
  let timescale, duration;
  if (version === 1) {
    timescale = buf.readUInt32BE(p + 4 + 8 + 8);
    duration = Number(buf.readBigUInt64BE(p + 4 + 8 + 8 + 4));
  } else {
    timescale = buf.readUInt32BE(p + 4 + 4 + 4);
    duration = buf.readUInt32BE(p + 4 + 4 + 4 + 4);
  }
  return timescale ? duration / timescale : null;
}
const durCache = new Map();
async function mp4Duration(path) {
  if (durCache.has(path)) return durCache.get(path);
  const url = `${BASE}/file/resource${path}`;
  let len = 0;
  try {
    const head = await req(url, { method: 'HEAD' });
    len = Number(head.headers.get('content-length') || 0);
  } catch { /* 忽略 */ }
  if (!len) { durCache.set(path, null); return null; }
  const readRange = async (s, e) => Buffer.from(await (await req(url, { headers: { Range: `bytes=${s}-${e}` } })).arrayBuffer());
  let sec = parseMvhd(await readRange(0, Math.min(262143, len - 1)));
  if (sec == null) {   // moov 在尾部
    const tail = Math.min(4 * 1024 * 1024, len);
    sec = parseMvhd(await readRange(len - tail, len - 1));
  }
  const val = sec == null ? null : Math.floor(sec);
  durCache.set(path, val);
  return val;
}

// ---------------------------------------------------------------- 学习
async function openVideo(contentId, traineeId, resourceId) {
  return postJson('/ept/manage/learn/viewingTime', { trainingContentId: contentId, traineeId, resourceId });
}

/** 把单个视频的已学时长按步进推到真实时长 */
async function walkVideo(contentId, traineeId, res) {
  const dur = await mp4Duration(res.path);
  if (!dur) return { ok: false, reason: '无法取得时长' };
  await openVideo(contentId, traineeId, res.resourceId);

  let pos = 0, step = STEP_MAX, fails = 0, calls = 0, reopened = false;
  while (pos < dur) {
    const target = Math.min(pos + step, dur);
    const j = await postJson('/ept/manage/learn/record', {
      trainingContentId: contentId, traineeId, resourceId: res.resourceId,
      viewingTime: target, totalTime: dur,
    });
    calls++;
    if (j.statusCode === 200) { pos = target; fails = 0; continue; }
    fails++;
    // 播放记录可能失效，重新“打开视频”一次
    if (!reopened && /请先打开视频/.test(j.message || '')) {
      reopened = true; fails = 0;
      await openVideo(contentId, traineeId, res.resourceId);
      continue;
    }
    if (step > 1) step = Math.max(1, Math.floor(step / 2));   // 退让
    if (fails > 6) return { ok: false, reason: `${j.message}（卡在 ${pos}/${dur}s）`, dur, calls };
  }
  await postJson('/ept/manage/learn/updateDetail', { traineeId, trainingContentId: contentId, resourceId: res.resourceId });
  await postJson('/ept/manage/learn/learned', { trainingContentId: contentId, traineeId, resourceId: res.resourceId });
  return { ok: true, dur, calls };
}

/** 完成一门课程 */
async function learnContent(contentId, traineeId, name, prog) {
  console.log(`\n[课程 ${contentId}] ${name}`);
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const resources = await resourcesOf(contentId, traineeId);
    const unlearned = await unlearnedOf(contentId, traineeId);
    if (unlearned.length === 0) break;
    if (round > 1) console.log(`  ↻ 第 ${round} 轮重扫：仍有 ${unlearned.length} 个待学`);

    let progressed = 0;
    for (const rid of unlearned) {
      const res = resources.find((r) => Number(r.resourceId) === rid);
      if (!res) { console.log(`  ! 资源 ${rid} 不在明细表内，跳过`); continue; }
      if (isVideo(res)) {
        const r = await walkVideo(contentId, traineeId, res);
        prog.done++;
        if (r.ok) {
          progressed++;
          console.log(`  ${bar(prog.done, prog.total)} ${String(Math.round((prog.done / prog.total) * 100)).padStart(3)}%` +
            ` [${String(prog.done).padStart(2)}/${prog.total}] ✓ ${pad(trunc(res.name), NAME_W)} ${String(r.dur).padStart(4)}s ${r.calls} 次`);
        } else {
          console.log(`  ${bar(prog.done, prog.total)} [${String(prog.done).padStart(2)}/${prog.total}] ✗ ${trunc(res.name)} — ${r.reason}`);
        }
      } else {
        const j = await postJson('/ept/manage/learn/learned', { trainingContentId: contentId, traineeId, resourceId: res.resourceId });
        progressed++;
        console.log(`  · 非视频资源直接标记 ${trunc(res.name)} → ${j.statusCode}`);
      }
    }
    if (progressed === 0 && round > 1) { console.log('  ! 本轮无进展，停止重试'); break; }
  }

  const left = await unlearnedOf(contentId, traineeId);
  if (left.length === 0) {
    const j = await postJson('/ept/manage/learn/updateStatus', { trainingContentId: contentId, traineeId, status: 1 });
    const ok = j.statusCode === 200;
    console.log(`  ${ok ? '✓' : '✗'} 提交「已学完」 → ${j.statusCode} ${j.message || ''}`);
    return ok;
  }
  console.log(`  ✗ 仍有 ${left.length} 个资源未完成：${left.join(',')}`);
  return false;
}

/** 全流程 */
async function run() {
  const t0 = Date.now();
  rule('═');
  console.log('学习中心 · 自动完成');
  rule('═');

  // 1) 扫描
  console.log('\n▸ 扫描培训与课程…');
  const trainings = await listTrainings();
  if (!trainings.length) { console.log('  未发现任何培训'); return 1; }

  const jobs = [];   // {trainingName, traineeId, contentId, contentName}
  for (const t of trainings) {
    const traineeId = await traineeIdOf(t.trainingId);
    console.log(`\n  培训 ${t.trainingId}  ${t.name}   traineeId=${traineeId ?? '(无)'}`);
    if (!traineeId) continue;
    for (const c of await contentsOf(traineeId)) {
      const resources = await resourcesOf(c.contentId, traineeId);
      const unlearned = await unlearnedOf(c.contentId, traineeId);
      const done = unlearned.length === 0 && await courseBarDone(c.contentId, traineeId);
      console.log(`    [${c.contentId}] ${pad(trunc(c.name, 26), 28)} 资源 ${String(resources.length).padStart(2)}` +
        `  待学 ${String(unlearned.length).padStart(2)}  ${done ? '已学完' : ''}`);
      jobs.push({ trainingId: t.trainingId, traineeId, contentId: c.contentId, contentName: c.name, unlearned, resources, done });
    }
  }

  // 2) 统计工作量
  const todoVideos = jobs.reduce((n, j) => n + j.unlearned.filter((rid) => {
    const r = j.resources.find((x) => Number(x.resourceId) === rid);
    return r && isVideo(r);
  }).length, 0);

  rule();
  if (todoVideos === 0 && jobs.every((j) => j.unlearned.length === 0)) {
    console.log('全部课程此前已完成，无需学习；执行复核…\n');
  } else {
    console.log(`待学视频合计 ${todoVideos} 段，开始学习（每段按 10 秒步进上报，约 150ms/次）\n`);
  }
  rule();

  // 3) 逐门学习
  const prog = { done: 0, total: Math.max(todoVideos, 1) };
  const results = [];
  for (const j of jobs) {
    if (j.done) {
      console.log(`\n[课程 ${j.contentId}] ${j.contentName}\n  ✓ 此前已学完，跳过`);
      results.push({ ...j, ok: true });
      continue;
    }
    const ok = await learnContent(j.contentId, j.traineeId, j.contentName, prog);
    results.push({ ...j, ok });
  }

  // 4) 复核
  rule('═');
  console.log('复核');
  rule('═');
  let allOk = true;
  for (const r of results) {
    const resources = await resourcesOf(r.contentId, r.traineeId);
    const unlearned = await unlearnedOf(r.contentId, r.traineeId);
    const rates = resources.filter(isVideo).map((x) => x.rate);
    const bad = rates.filter((x) => !(x >= 100)).length;
    const done = unlearned.length === 0 && bad === 0 && await courseBarDone(r.contentId, r.traineeId);
    if (!done) allOk = false;
    console.log(`  ${done ? '✓' : '✗'} [${r.trainingId}/${r.contentId}] ${pad(trunc(r.contentName, 26), 28)}` +
      ` 视频 ${rates.length} 段，100% ${rates.length - bad}，未学 ${unlearned.length}`);
  }

  rule('═');
  const el = Math.round((Date.now() - t0) / 1000);
  console.log(`账号 ${ACCOUNT}　结果：${allOk ? '全部课程已完成 ✓' : '仍有未完成项 ✗'}　` +
    `本次学习 ${todoVideos} 段视频　耗时 ${secs(el)}`);
  rule('═');
  return allOk ? 0 : 1;
}

// ---------------------------------------------------------------- plan
async function plan() {
  const trainings = await listTrainings();
  for (const t of trainings) {
    const traineeId = await traineeIdOf(t.trainingId);
    rule('═');
    console.log(`培训 ${t.trainingId}  ${t.name}   traineeId=${traineeId ?? '(无)'}`);
    if (!traineeId) continue;
    for (const c of await contentsOf(traineeId)) {
      const resources = await resourcesOf(c.contentId, traineeId);
      const unlearned = await unlearnedOf(c.contentId, traineeId);
      const done = unlearned.length === 0 && await courseBarDone(c.contentId, traineeId);
      console.log(`\n  [课程 ${c.contentId}] ${c.name}  资源 ${resources.length}  ` +
        `待学 ${unlearned.length}  ${done ? '已学完 ✓' : ''}`);
      for (const r of resources) {
        const flag = unlearned.includes(Number(r.resourceId)) ? '待学' : '已学';
        const rate = Number.isFinite(r.rate) ? `${r.rate}%` : '-';
        console.log(`     ${flag}  id=${String(r.resourceId).padStart(5)}  type=${r.type}  已看=${rate.padStart(6)}  ${trunc(r.name, 46)}`);
      }
    }
  }
}

// ---------------------------------------------------------------- verify
async function verify() {
  let allOk = true;
  const trainings = await listTrainings();
  for (const t of trainings) {
    const traineeId = await traineeIdOf(t.trainingId);
    rule('═');
    console.log(`培训 ${t.trainingId}  ${t.name}   traineeId=${traineeId ?? '(无)'}`);
    if (!traineeId) { allOk = false; continue; }
    for (const c of await contentsOf(traineeId)) {
      const resources = await resourcesOf(c.contentId, traineeId);
      const unlearned = await unlearnedOf(c.contentId, traineeId);
      const rates = resources.filter(isVideo).map((x) => x.rate);
      const barDone = await courseBarDone(c.contentId, traineeId);
      const done = unlearned.length === 0 && barDone;
      if (!done) allOk = false;
      console.log(`\n  [${c.contentId}] ${c.name}`);
      console.log(`     资源 ${resources.length} 条 | 视频 ${rates.length} 段，完成度 ${[...new Set(rates)].sort((a, b) => a - b).join('/')}%` +
        ` | 未学 ${unlearned.length}`);
      console.log(`     form-bar: ${barDone ? '已学完 ✓' : '未完成 ✗'}`);
      if (unlearned.length) console.log(`     待学 resourceId: ${unlearned.join(',')}`);
    }
  }
  rule('═');
  console.log(`账号 ${ACCOUNT}　总体：${allOk ? '全部课程已完成 ✓' : '仍有未完成项 ✗'}`);
  return allOk ? 0 : 1;
}

// ---------------------------------------------------------------- qbank
const TYPE_CN = {
  SingleSelection: '单选', MultipleSelection: '多选', Judgement: '判断',
  TrueOrFalse: '判断', FillInTheBlank: '填空', ShortAnswer: '简答',
};
function parseQuestion(html) {
  const type = (html.match(/<div class="media div-item"[^>]*type="([^"]+)"/) ?? [, '?'])[1];
  const score = (html.match(/class="praxis-score" value="([^"]*)"/) ?? [, ''])[1];
  const head = html.match(/<div class="media-heading item-title">([\s\S]*?)<\/div>/);
  const title = head ? strip(head[1].replace(/<span class="item-(score|type)">[\s\S]*?<\/span>/g, '')) : '';
  const options = [...html.matchAll(
    /<span class="media-left item-option"[^>]*>([\s\S]*?)<\/span>\s*<div class="media-body">([\s\S]*?)<\/div>/g,
  )].map((m) => [strip(m[1]), strip(m[2])]);
  const ansBlock = html.match(/<div class="div-item-answer">([\s\S]*?)<\/div>/);
  const answer = ansBlock ? [...ansBlock[1].matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => strip(m[1])).filter(Boolean) : [];
  return { type, score, title, options, answer };
}
async function qbank() {
  const LIMIT = Number(process.env.LIMIT || 0);
  const CONC = Number(process.env.CONC || 5);
  const SUBJECTS = [{ id: 91, name: '济南校区' }, { id: 61, name: '济南校区-通识类' }];
  const all = [];
  for (const sub of SUBJECTS) {
    const content = await getText(`/ept/manage/practice/content?subjectId=${sub.id}&type=0`);
    const m = content.match(/"praxisIds":\[([0-9,]+)\]/);
    let ids = m ? m[1].split(',').map(Number) : [];
    if (LIMIT) ids = ids.slice(0, LIMIT);
    console.log(`\n[${sub.name}] subjectId=${sub.id}  题目 ${ids.length} 道`);
    let done = 0, cursor = 0;
    const out = new Array(ids.length);
    const t0 = Date.now();
    await Promise.all(Array.from({ length: CONC }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= ids.length) return;
        try {
          out[i] = parseQuestion(await getText(`/ept/manage/practice/praxis?praxisId=${ids[i]}`));
        } catch (e) {
          out[i] = { type: 'ERR', score: '', title: `抓取失败: ${e.message}`, options: [], answer: [] };
        }
        done++;
        if (done % 50 === 0 || done === ids.length) {
          const el = (Date.now() - t0) / 1000;
          console.log(`  ${bar(done, ids.length)} ${String(Math.round((done / ids.length) * 100)).padStart(3)}% ` +
            `${done}/${ids.length}　${el.toFixed(0)}s`);
        }
      }
    }));
    all.push({ sub, items: out.filter(Boolean) });
  }
  // 不写入账号：导出物可能被分享/提交，避免把学号带出去
  const lines = ['# 实验室安全教育 · 练习题库（含答案速查）', '',
    `> 导出时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}`, '',
    '> 用途：考试前复习。本文件由练习中心题库导出，仅含题面/选项/正确答案。', ''];
  for (const { sub, items } of all) {
    lines.push(`\n## ${sub.name}（${items.length} 题）\n`);
    items.forEach((q, i) => {
      const t = TYPE_CN[q.type] ?? q.type;
      lines.push(`**${i + 1}. [${t}] ${q.title}**${q.score ? ` *(${q.score}分)*` : ''}`);
      for (const [k, v] of q.options) lines.push(`- ${k}. ${v}`);
      lines.push(`- ✅ **答案：${q.answer.join(' ') || '(未提供)'}**`);
      lines.push('');
    });
  }
  // LIMIT 调试时写到单独文件，绝不覆盖正式交付物
  const outName = LIMIT ? `aqjy_题库速查.limit${LIMIT}.md` : 'aqjy_题库速查.md';
  const outFile = new URL(outName, import.meta.url);
  await fs.writeFile(outFile, lines.join('\n'), 'utf8');
  const missing = all.flatMap((a) => a.items).filter((q) => !q.answer.length).length;
  console.log(`\n已写出 ${fileURLToPath(outFile)}　共 ${all.reduce((n, a) => n + a.items.length, 0)} 题，答案缺失 ${missing}`);
}

// ---------------------------------------------------------------- status
async function status(path) {
  const html = await getText(path);
  console.log(`### ${BASE}${path}\n`);
  console.log(strip(html).slice(0, 3000));
  const links = [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1])
    .filter((u) => !/\.(css|png|jpg|gif|ico|js)/i.test(u));
  if (links.length) {
    console.log('\n--- 相关链接 ---');
    for (const l of [...new Set(links)].slice(0, 25)) console.log('  ' + l);
  }
}

// ---------------------------------------------------------------- 入口
const COMMANDS = ['run', 'plan', 'verify', 'qbank', 'status'];
const argv = process.argv.slice(2);
let cmd = COMMANDS.includes(argv[0]) ? argv.shift() : 'run';

let user = process.env.AQJY_USER || '';
let pwd = process.env.AQJY_PWD || '';
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--user') user = argv[++i] || '';
  else if (argv[i] === '--pwd') pwd = argv[++i] || '';
  else if (argv[i] === '-h' || argv[i] === '--help') cmd = 'help';
  else pos.push(argv[i]);
}
// 位置参数顺序：<账号> <密码> [status 的路径]
if (!user && pos.length) user = pos.shift();
if (!pwd && pos.length) pwd = pos.shift();
let statusPath = '';
if (cmd === 'status') statusPath = pos.shift() || '';

if (cmd === 'help' || !user || !pwd) {
  if (!user || !pwd) console.error('缺少账号或密码。\n');
  console.log(`山东科技大学 · 实验室安全教育系统一体化脚本

用法:
  node aqjy.mjs <账号> <密码>              全自动：完成学习中心全部课程并复核
  node aqjy.mjs plan   <账号> <密码>       只读：列出课程 / 资源 / 进度 / 待学清单
  node aqjy.mjs verify <账号> <密码>       只读：复核完成状态（全完成时退出码 0）
  node aqjy.mjs qbank  <账号> <密码>       导出练习中心题库到 aqjy_题库速查.md
  node aqjy.mjs status <账号> <密码> <路径>  抓任意路径，打印可见文本与相关链接

凭据也可用环境变量（推荐，不落盘）:
  $env:AQJY_USER='<账号>'; $env:AQJY_PWD='<密码>'
  或 --user <账号> --pwd <密码>

环境变量:
  LIMIT=50   仅 qbank：每题库限制题数（调试）    CONC=5   仅 qbank：并发数

示例:
  node aqjy.mjs <账号> 'Skd_xxxxxx'
  node aqjy.mjs plan <账号> 'Skd_xxxxxx'`);
  process.exit(cmd === 'help' ? 0 : 2);
}

await login(user, pwd);
let code = 0;
if (cmd === 'run') code = await run();
else if (cmd === 'plan') await plan();
else if (cmd === 'verify') code = await verify();
else if (cmd === 'qbank') await qbank();
else if (cmd === 'status') {
  if (!statusPath) { console.error('status 需要一个路径参数，例: /ept/manage/learn/data'); process.exit(2); }
  await status(statusPath);
}
process.exit(code);
