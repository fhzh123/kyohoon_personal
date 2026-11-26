import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {homePage} from '../views/pages.mjs';

test('home exposes the mascot controls and polite feedback to assistive technology', () => {
  const {window} = new JSDOM(homePage());
  try {
    const {document} = window;
    const root = document.querySelector('[data-mascot-play]');
    assert.ok(root, 'home contains the interactive mascot');
    assert.equal(root.closest('[aria-hidden="true"]'), null);
    for (const selector of ['[data-mascot-button]', '[data-mascot-snack]', '[data-mascot-pet]']) {
      const button = root.querySelector(selector);
      assert.equal(button?.tagName, 'BUTTON', selector);
      assert.equal(button.type, 'button');
      assert.equal(button.disabled, false);
      assert.equal(button.closest('[aria-hidden="true"]'), null);
      assert.ok((button.getAttribute('aria-label') || button.textContent).trim(), 'control has a name');
    }
    const button = root.querySelector('[data-mascot-button]');
    assert.ok(button.querySelector('img[data-mascot-image]'));
    const help = document.getElementById(button.getAttribute('aria-describedby'));
    assert.ok(help?.textContent.trim(), 'instructions are linked to the mascot button');
    const status = root.querySelector('[data-mascot-status]');
    assert.equal(status.getAttribute('role'), 'status');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(status.getAttribute('aria-atomic'), 'true');
    assert.ok(status.textContent.trim());
  } finally {
    window.close();
  }
});

test('home preserves all four destinations and loads the new classic deferred mascot script', () => {
  for (const authenticated of [false, true]) {
    const {window} = new JSDOM(homePage({authenticated}), {url: 'https://fixture.invalid/'});
    try {
      const {document} = window;
      const links = [...document.querySelectorAll('.home-spaces a')];
      assert.deepEqual(links.map(link => link.getAttribute('href')), ['/resume', '/work', '/paper', '/personal']);
      for (const link of links) {
        assert.ok(document.getElementById(link.getAttribute('aria-labelledby'))?.textContent.trim());
        assert.equal(link.closest('[data-mascot-play]'), null, 'navigation stays outside interaction target');
      }
      const scripts = [...document.scripts];
      const play = scripts.filter(script => new URL(script.src || '/', window.location).pathname === '/mascot-play.js');
      assert.equal(play.length, 1);
      assert.equal(play[0].defer, true);
      assert.notEqual(play[0].type, 'module');
      assert.equal(scripts.some(script => new URL(script.src || '/', window.location).pathname === '/home.js'), false);
    } finally {
      window.close();
    }
  }
});
