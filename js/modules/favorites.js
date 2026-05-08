var STORAGE_KEY = 'kc_ozd_favorites_v1';

/**
 * @returns {string[]}
 */
function readIds() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(function (x) {
      return typeof x === 'string' && x.length < 200;
    });
  } catch (e) {
    return [];
  }
}

/**
 * @param {string[]} ids
 */
function writeIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (e) {
    /* quota or private mode */
  }
}

/**
 * @param {Document} doc
 */
export function initFavorites(doc) {
  var buttons = doc.querySelectorAll('[data-favorite-toggle]');
  if (!buttons.length) {
    return;
  }

  function syncUi() {
    var set = new Set(readIds());
    buttons.forEach(function (btn) {
      var id = btn.getAttribute('data-favorite-toggle');
      if (!id) {
        return;
      }
      var on = set.has(id);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  syncUi();

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-favorite-toggle');
      if (!id) {
        return;
      }
      var list = readIds();
      var idx = list.indexOf(id);
      if (idx === -1) {
        list.push(id);
      } else {
        list.splice(idx, 1);
      }
      writeIds(list);
      syncUi();
    });
  });
}
