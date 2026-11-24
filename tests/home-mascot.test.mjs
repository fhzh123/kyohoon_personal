import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {setImmediate as flushEvents} from 'node:timers/promises';
import {JSDOM} from 'jsdom';
import {homePage} from '../views/pages.mjs';

const script = await readFile(new URL('../public/home.js', import.meta.url), 'utf8');

test('home swaps one mascot after decoding and ignores superseded hover requests', async () => {
  const {window} = new JSDOM(homePage(), {runScripts: 'outside-only'});
  const pending = new Map();
  window.Image = class {
    decode() {
      return new Promise((resolve, reject) => pending.set(this.src, {resolve, reject}));
    }
  };
  window.requestIdleCallback = () => {};
  const stage = window.document.querySelector('[data-home-stage]');
  const mascot = stage.querySelector('[data-default-pose]');
  const original = mascot.getAttribute('src');
  const nav = window.document.querySelector('.home-spaces');
  const links = nav.querySelectorAll('[data-pose]');
  const [resume, work, paper] = links;
  const hover = link => link.dispatchEvent(new window.Event('pointerenter'));
  const shown = () => [...stage.querySelectorAll('img')].map(img => img.getAttribute('src'));
  const settle = async (link, method = 'resolve') => {
    pending.get(link.dataset.pose)[method]();
    await flushEvents();
  };

  try {
    window.eval(script);
    assert.deepEqual(shown(), [original]);
    hover(resume);
    hover(work);
    assert.deepEqual(shown(), [original]);
    await settle(resume);
    assert.deepEqual(shown(), [original]);
    await settle(work);
    assert.deepEqual(shown(), [work.dataset.pose]);

    hover(paper);
    await settle(paper, 'reject');
    assert.deepEqual(shown(), [work.dataset.pose]);

    resume.focus();
    await flushEvents();
    assert.deepEqual(shown(), [resume.dataset.pose]);
    resume.blur();
    assert.deepEqual(shown(), [original]);
    assert.equal(mascot.classList.contains('is-space-pose'), false);

    hover(paper);
    nav.dispatchEvent(new window.Event('pointerleave'));
    await settle(paper);
    assert.deepEqual(shown(), [original]);
  } finally {
    window.close();
  }
});
