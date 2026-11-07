// Browser test (playwright-core + chromium). Light and dark mode, desktop and phone.
// usage: node tests/e2e.mjs http://127.0.0.1:8123/linux/ [screenshot-dir]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8123/linux/';
const SHOTS = process.argv[3];
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failures++; };

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });

async function session(scheme, viewport) {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url()));
  return { ctx, page, problems };
}
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); } };

// ---------------- desktop, light ----------------
{
  const { ctx, page, problems } = await session('light', { width: 1100, height: 900 });
  await page.goto(BASE);
  await page.waitForSelector('.node');
  ok((await page.locator('.node').count()) === 49, 'learning path shows all 49 modules');
  ok((await page.locator('.node.soon').count()) === 46, '46 modules are "coming soon"');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(bg === 'rgb(247, 247, 245)', 'light mode background ' + bg);
  await shot(page, 'home-light');

  // module 1 -> lesson
  await page.click('a.node:has-text("The shell")');
  await page.waitForSelector('h1:has-text("1. The shell")');
  ok(await page.locator('.badge.lv-beginner').first().isVisible(), 'module page shows level badge');
  await page.click('h3 a:has-text("How bash reads, expands and runs a command")');
  await page.waitForSelector('.goal');
  ok((await page.textContent('.goal')).includes('Goal'), 'lesson starts with Goal');
  ok(await page.locator('.trybox').isVisible(), '"Try it on your machine" box present');
  ok(await page.locator('button:has-text("Back")').isDisabled(), 'Back disabled on first page');
  await shot(page, 'lesson-goal-light');

  // step 1 + terminal
  await page.click('button:has-text("Next")');
  await page.waitForSelector('.term');
  await page.click('.term .run');
  await page.waitForFunction(() => document.querySelector('.term-body').textContent.includes('one two three'));
  ok(true, 'terminal Run shows recorded output');
  await page.click('.term button[aria-label^="Copy command"]');
  ok((await page.evaluate(() => navigator.clipboard.readText())) === 'echo one    two     three', 'copy button copies the command');

  // walk all steps; code step shows full source
  await page.click('button:has-text("Next")');
  ok((await page.textContent('.code')).includes('int main(int argc, char *argv[])'), 'demo program source is shown in full');
  ok(await page.locator('.under').count() === 1, '"Underneath" box shows');
  await shot(page, 'lesson-step-light');
  for (let i = 0; i < 10; i++) await page.click('button:has-text("Next")');
  await page.waitForSelector('h2:has-text("Quiz")');
  ok(true, 'reached quiz after all steps');

  // quiz: wrong then right
  const q1 = page.locator('.q').nth(0);
  await q1.locator('.opt').nth(0).click();
  ok((await q1.locator('.why').textContent()).includes('Not quite'), 'wrong answer explained');
  ok(await q1.locator('.opt.right').count() === 1 && await q1.locator('.opt.wrong').count() === 1, 'right/wrong marked');
  const answers = [1, 1, 1, 3, 1];
  for (let i = 1; i < 5; i++) await page.locator('.q').nth(i).locator('.opt').nth(answers[i]).click();
  ok((await page.textContent('.score')).includes('Score: 4/5'), 'quiz score shown: ' + (await page.textContent('.score')));
  await shot(page, 'quiz-light');

  await page.click('button:has-text("Next")');
  await page.waitForSelector('.check');
  ok(await page.locator('.answer').isHidden(), 'check-yourself answer hidden at first');
  await page.click('button:has-text("Show answer")');
  ok(await page.locator('.answer').isVisible(), 'Show answer reveals it');
  await page.click('button:has-text("Finish lesson")');
  await page.waitForSelector('h1:has-text("1. The shell")');
  ok((await page.textContent('main')).includes('✓'), 'lesson marked done');
  ok((await page.textContent('main')).includes('Quiz: 4/5'), 'quiz score saved');

  // persistence
  await page.reload();
  await page.waitForSelector('h1:has-text("1. The shell")');
  ok((await page.textContent('main')).includes('Quiz: 4/5'), 'progress survives reload');
  ok((await page.textContent('#foot-progress')).startsWith('1/'), 'footer progress: ' + (await page.textContent('#foot-progress')));

  // search
  await page.fill('#q', 'argv');
  await page.waitForSelector('.hit');
  ok((await page.locator('.hit').count()) > 0 && page.url().includes('#/search/argv'), 'search finds results for "argv"');
  await page.fill('#q', 'lsof +L1');
  await page.waitForFunction(() => document.querySelector('.hit .kind')?.textContent.includes('Lab') || document.querySelectorAll('.hit').length);
  ok((await page.locator('.hit').count()) > 0, 'search finds lsof in lab/commands');
  await page.fill('#q', 'zzzznothing');
  await page.waitForSelector('text=0 results');
  ok(true, 'search handles no results');

  // glossary, cheat, interview, labs
  await page.goto(BASE + '#/glossary');
  await page.waitForSelector('dl.gl dt');
  ok((await page.locator('dl.gl dt').count()) >= 8, 'glossary lists terms');
  await page.click('dd a >> nth=0');
  await page.waitForSelector('.goal');
  ok(page.url().includes('#/lesson/1/how-bash-runs-a-command'), 'glossary term links to its lesson');

  await page.goto(BASE + '#/cheat');
  await page.waitForSelector('.cmdrow');
  await page.fill('#app input[type=search]', 'only stderr');
  ok((await page.locator('.cmdrow').count()) === 1, 'cheat sheet filter');
  await page.locator('.cmdrow button').click();
  ok((await page.evaluate(() => navigator.clipboard.readText())) === 'cmd 2> err.txt', 'cheat sheet copy button');

  await page.goto(BASE + '#/interview');
  await page.waitForSelector('details.qa');
  const all = await page.locator('details.qa').count();
  await page.selectOption('select[aria-label=Level]', 'beginner');
  await page.waitForFunction((n) => document.querySelectorAll('details.qa').length < n, all);
  ok((await page.locator('details.qa').count()) === 3, 'interview filter by level: ' + (await page.locator('details.qa').count()) + ' beginner of ' + all);
  await page.click('details.qa summary >> nth=0');
  ok(await page.locator('details.qa[open]').count() === 1, 'interview answer opens');

  await page.goto(BASE + '#/labs');
  await page.click('text=Disk full, but du finds only half of it');
  await page.waitForSelector('.choices button');
  await page.click('.choices button:has-text("sudo reboot")');
  await page.waitForSelector('.verdict.poor');
  ok((await page.textContent('.term-dim >> nth=0')).includes('explanation only'), 'lab: destructive choice marked explanation only');
  await page.click('.choices button:has-text("df -h /mnt/labdisk")');
  await page.waitForSelector('text=Step 2');
  await page.click('.choices button:has-text("du -sh")');
  await page.click('.choices button:has-text("lsof")');
  await page.waitForSelector('text=Step 4');
  await page.click('.choices button:has-text("xargs kill")');
  await page.click('.choices button:has-text("df -h /mnt/labdisk")');
  await page.waitForSelector('h3:has-text("Resolved")');
  ok(true, 'lab can be solved and shows the conclusion');
  await shot(page, 'lab-light');

  await page.goto(BASE + '#/exam');
  await page.click('button:has-text("Start exam")');
  await page.waitForSelector('.q');
  const nq = await page.locator('.q').count();
  for (let i = 0; i < nq; i++) await page.locator('.q').nth(i).locator('.opt').nth(0).click();
  await page.click('button:has-text("Submit")');
  await page.waitForSelector('.score');
  ok((await page.textContent('.score')).startsWith('Score:'), 'exam gives a score: ' + (await page.textContent('.score')));

  // reset
  page.once('dialog', (d) => d.accept());
  await page.click('#reset');
  await page.goto(BASE + '#/module/1');
  await page.waitForSelector('h1:has-text("1. The shell")');
  ok(!(await page.textContent('main')).includes('Quiz: 4/5'), 'reset progress clears everything');

  await page.goto(BASE + '#/module/8');
  ok((await page.textContent('main')).includes('not written yet'), 'coming-soon module page');
  await page.goto(BASE + '#/nonsense');
  ok((await page.textContent('main')).includes('Not found'), '404 route');
  ok(problems.length === 0, 'no console errors / CSP violations (desktop light)' + (problems.length ? ': ' + problems.join(' | ') : ''));
  await ctx.close();
}

// ---------------- dark mode and phone ----------------
{
  const { ctx, page, problems } = await session('dark', { width: 390, height: 800 });
  await page.goto(BASE);
  await page.waitForSelector('.node');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(bg === 'rgb(22, 22, 21)', 'dark mode background ' + bg);
  for (const h of ['', '#/path', '#/lesson/1/how-bash-runs-a-command/3', '#/cheat', '#/glossary', '#/interview', '#/labs']) {
    await page.goto(BASE + h);
    await page.waitForTimeout(200);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over <= 0, `no horizontal scroll on phone at "${h || '/'}" (${over}px over)`);
  }
  await page.goto(BASE + '#/lesson/1/how-bash-runs-a-command/2');
  await page.waitForSelector('.term');
  await shot(page, 'lesson-phone-dark');
  await page.goto(BASE);
  await page.waitForSelector('.node');
  await shot(page, 'home-phone-dark');
  ok(problems.length === 0, 'no console errors (phone dark)' + (problems.length ? ': ' + problems.join(' | ') : ''));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
