// This script is injected into iframes to handle element selection and editing
export const IFRAME_INJECT_SCRIPT = `
(function() {
  var selectedEl = null;
  var overlay = null;
  var isEditing = false;

  // Drag state
  var isDragging = false;
  var mouseDownOnEl = false;
  var mouseDownX = 0, mouseDownY = 0;
  var dragStartX = 0, dragStartY = 0;
  var dragStartLeft = 0, dragStartTop = 0;
  var dragPlaceholder = null;
  var dragOriginalParent = null;
  var wasStaticBeforeDrag = false;

  // Resize state
  var isResizing = false;
  var resizeType = '';
  var resizeStartX = 0, resizeStartY = 0;
  var resizeStartLeft = 0, resizeStartTop = 0;
  var resizeStartWidth = 0, resizeStartHeight = 0;

  // Rotation state
  var isRotating = false;
  var rotateCenterX = 0, rotateCenterY = 0;

  // Multi-select state
  var multiSelectedEls = [];
  var multiBBoxOverlay = null;

  // Group mode: when user has double-clicked into a group
  var activeGroup = null;

  // Clipboard (internal)
  var clipboardEls = []; // array of outerHTML strings
  var clipboardOffset = 0;

  // Context menu
  var contextMenuEl = null;

  // Snap guides
  var snapGuideContainer = null;
  var SNAP_THRESHOLD = 5;

  // ---- Overlay creation ----
  function getRotationDegrees(el) {
    if (!el) return 0;
    var transform = window.getComputedStyle(el).transform || '';
    if (!transform || transform === 'none') return 0;
    var rotateMatch = transform.match(/rotate\\((-?\\d+(?:\\.\\d+)?)deg\\)/);
    if (rotateMatch) return parseFloat(rotateMatch[1]) || 0;
    var matrixMatch = transform.match(/matrix\\(([^)]+)\\)/);
    if (matrixMatch) {
      var values = matrixMatch[1].split(',').map(function(v) { return parseFloat(v.trim()); });
      if (values.length >= 2) return Math.atan2(values[1], values[0]) * 180 / Math.PI;
    }
    return 0;
  }

  function createOverlay() {
    var div = document.createElement('div');
    div.id = '__sf_overlay__';
    div.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'border:2px solid #007AFF',
      'z-index:99999',
      'display:none',
      'box-shadow:0 0 0 1px rgba(0,122,255,0.24)',
      'box-sizing:border-box',
      'transition:all 0.15s ease-out',
    ].join(';');

    // 8 resize handles: nw, n, ne, e, se, s, sw, w
    var handleDefs = [
      { pos: 'nw', css: 'top:-5px;left:-5px;cursor:nw-resize' },
      { pos: 'n',  css: 'top:-5px;left:calc(50% - 4px);cursor:n-resize' },
      { pos: 'ne', css: 'top:-5px;right:-5px;cursor:ne-resize' },
      { pos: 'e',  css: 'top:calc(50% - 4px);right:-5px;cursor:e-resize' },
      { pos: 'se', css: 'bottom:-5px;right:-5px;cursor:se-resize' },
      { pos: 's',  css: 'bottom:-5px;left:calc(50% - 4px);cursor:s-resize' },
      { pos: 'sw', css: 'bottom:-5px;left:-5px;cursor:sw-resize' },
      { pos: 'w',  css: 'top:calc(50% - 4px);left:-5px;cursor:w-resize' },
    ];

    handleDefs.forEach(function(h) {
      var hDiv = document.createElement('div');
      hDiv.setAttribute('data-sf-handle', h.pos);
      hDiv.style.cssText = [
        'position:absolute',
        'width:8px',
        'height:8px',
        'background:#007AFF',
        'border:1px solid white',
        'pointer-events:auto',
        'border-radius:2px',
        'box-sizing:border-box',
        h.css,
      ].join(';');

      hDiv.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedEl) return;

        isResizing = true;
        resizeType = h.pos;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;

        var cs = window.getComputedStyle(selectedEl);
        var left, top;
        if (cs.position === 'static' || cs.position === 'relative') {
          var rect = selectedEl.getBoundingClientRect();
          var parent = selectedEl.offsetParent || document.documentElement;
          var parentRect = parent.getBoundingClientRect();
          left = rect.left - parentRect.left;
          top = rect.top - parentRect.top;
          selectedEl.style.position = 'absolute';
          selectedEl.style.left = left + 'px';
          selectedEl.style.top = top + 'px';
        } else {
          left = parseFloat(cs.left) || 0;
          top = parseFloat(cs.top) || 0;
        }
        resizeStartLeft = left;
        resizeStartTop = top;
        resizeStartWidth = selectedEl.offsetWidth;
        resizeStartHeight = selectedEl.offsetHeight;
      });

      div.appendChild(hDiv);
    });

    var rotateLine = document.createElement('div');
    rotateLine.setAttribute('data-sf-rotate-line', '1');
    rotateLine.style.cssText = [
      'position:absolute',
      'left:calc(50% - 0.5px)',
      'top:-20px',
      'width:1px',
      'height:20px',
      'background:rgba(0,122,255,0.75)',
      'pointer-events:none',
    ].join(';');
    div.appendChild(rotateLine);

    var rotateHandle = document.createElement('button');
    rotateHandle.type = 'button';
    rotateHandle.setAttribute('data-sf-rotate-handle', '1');
    rotateHandle.style.cssText = [
      'position:absolute',
      'left:calc(50% - 8px)',
      'top:-36px',
      'width:16px',
      'height:16px',
      'border-radius:999px',
      'border:1px solid rgba(255,255,255,0.96)',
      'background:#007AFF',
      'color:white',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-size:10px',
      'font-family:-apple-system,sans-serif',
      'box-shadow:0 4px 12px rgba(0,122,255,0.28)',
      'pointer-events:auto',
      'cursor:grab',
      'padding:0',
    ].join(';');
    rotateHandle.innerHTML = '&#8635;';
    rotateHandle.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (!selectedEl) return;
      var rect = selectedEl.getBoundingClientRect();
      rotateCenterX = rect.left + rect.width / 2;
      rotateCenterY = rect.top + rect.height / 2;
      isRotating = true;
    });
    div.appendChild(rotateHandle);

    document.body.appendChild(div);
    return div;
  }

  function createMultiBBoxOverlay() {
    var div = document.createElement('div');
    div.id = '__sf_multi_bbox__';
    div.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'border:2px dashed #007AFF',
      'z-index:99998',
      'display:none',
      'box-sizing:border-box',
      'background:rgba(0,122,255,0.05)',
      'border-radius:2px',
    ].join(';');
    document.body.appendChild(div);
    return div;
  }

  function updateMultiBBoxOverlay() {
    if (!multiBBoxOverlay) multiBBoxOverlay = createMultiBBoxOverlay();
    if (multiSelectedEls.length < 2) {
      multiBBoxOverlay.style.display = 'none';
      return;
    }
    var minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
    multiSelectedEls.forEach(function(el) {
      var r = el.getBoundingClientRect();
      if (r.left < minLeft) minLeft = r.left;
      if (r.top < minTop) minTop = r.top;
      if (r.right > maxRight) maxRight = r.right;
      if (r.bottom > maxBottom) maxBottom = r.bottom;
    });
    multiBBoxOverlay.style.display = 'block';
    multiBBoxOverlay.style.left = (minLeft - 4) + 'px';
    multiBBoxOverlay.style.top = (minTop - 4) + 'px';
    multiBBoxOverlay.style.width = (maxRight - minLeft + 8) + 'px';
    multiBBoxOverlay.style.height = (maxBottom - minTop + 8) + 'px';
  }

  // ---- Snap guides ----
  function getSnapGuideContainer() {
    if (!snapGuideContainer) {
      snapGuideContainer = document.createElement('div');
      snapGuideContainer.id = '__sf_snap_guides__';
      snapGuideContainer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99997;overflow:hidden;';
      document.body.appendChild(snapGuideContainer);
    }
    return snapGuideContainer;
  }

  function drawSnapGuides(guides) {
    var container = getSnapGuideContainer();
    container.innerHTML = '';
    guides.forEach(function(g) {
      var line = document.createElement('div');
      if (g.x !== undefined) {
        line.style.cssText = 'position:fixed;left:' + g.x + 'px;top:0;width:1px;height:100%;background:rgba(255,50,50,0.85);pointer-events:none;';
      } else {
        line.style.cssText = 'position:fixed;top:' + g.y + 'px;left:0;width:100%;height:1px;background:rgba(255,50,50,0.85);pointer-events:none;';
      }
      container.appendChild(line);
    });
  }

  function clearSnapGuides() {
    if (snapGuideContainer) snapGuideContainer.innerHTML = '';
  }

  function applySnap(newLeft, newTop, elWidth, elHeight) {
    var snapped = { left: newLeft, top: newTop };
    var guides = [];
    var SLIDE_W = 1280, SLIDE_H = 720;

    var elL = newLeft, elR = newLeft + elWidth, elCX = newLeft + elWidth / 2;
    var elT = newTop, elB = newTop + elHeight, elCY = newTop + elHeight / 2;

    // Reference X values
    var refXs = [0, SLIDE_W / 2, SLIDE_W];
    // Reference Y values
    var refYs = [0, SLIDE_H / 2, SLIDE_H];

    // Collect from other elements
    var allEls = document.body.querySelectorAll('*');
    allEls.forEach(function(el) {
      if (el === selectedEl) return;
      if (el.getAttribute && el.getAttribute('data-sf-placeholder')) return;
      var id = el.id || '';
      if (id === '__sf_overlay__' || id === '__sf_multi_bbox__' || id === '__sf_snap_guides__') return;
      if (el.getAttribute && (el.getAttribute('data-sf-handle') || el.getAttribute('data-sf-rotate-handle') || el.getAttribute('data-sf-rotate-line'))) return;
      // Only consider direct children of slide or positioned elements
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none') return;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      refXs.push(r.left, r.right, r.left + r.width / 2);
      refYs.push(r.top, r.bottom, r.top + r.height / 2);
    });

    // Snap X: check element's left, center, right against reference Xs
    var bestXDist = SNAP_THRESHOLD + 1;
    var snapXGuide = null;

    [[elL, 0], [elCX, -elWidth/2], [elR, -elWidth]].forEach(function(pair) {
      var edge = pair[0], offset = pair[1];
      refXs.forEach(function(refX) {
        var dist = Math.abs(edge - refX);
        if (dist < bestXDist) {
          bestXDist = dist;
          snapped.left = refX + offset;
          snapXGuide = refX;
        }
      });
    });
    if (bestXDist <= SNAP_THRESHOLD && snapXGuide !== null) {
      guides.push({ x: snapXGuide });
    }

    // Snap Y
    var bestYDist = SNAP_THRESHOLD + 1;
    var snapYGuide = null;
    [[elT, 0], [elCY, -elHeight/2], [elB, -elHeight]].forEach(function(pair) {
      var edge = pair[0], offset = pair[1];
      refYs.forEach(function(refY) {
        var dist = Math.abs(edge - refY);
        if (dist < bestYDist) {
          bestYDist = dist;
          snapped.top = refY + offset;
          snapYGuide = refY;
        }
      });
    });
    if (bestYDist <= SNAP_THRESHOLD && snapYGuide !== null) {
      guides.push({ y: snapYGuide });
    }

    return { snapped: snapped, guides: guides };
  }

  // ---- XPath helpers ----
  function getXPath(el) {
    if (el.id) return '//*[@id="' + el.id + '"]';
    var parts = [];
    var current = el;
    while (current && current.nodeType === 1) {
      var idx = 1;
      var sib = current.previousSibling;
      while (sib) {
        if (sib.nodeType === 1 && sib.tagName === current.tagName) idx++;
        sib = sib.previousSibling;
      }
      parts.unshift(current.tagName.toLowerCase() + (idx > 1 ? '[' + idx + ']' : ''));
      current = current.parentElement;
    }
    return '/' + parts.join('/');
  }

  function getElementByXPath(xpath) {
    try {
      var result = document.evaluate(
        xpath, document, null,
        XPathResult.FIRST_ORDERED_NODE_TYPE, null
      );
      return result.singleNodeValue;
    } catch(e) {
      return null;
    }
  }

  // ---- Overlay positioning ----
  function updateOverlay(el) {
    if (!overlay) overlay = createOverlay();
    if (!el) { overlay.style.display = 'none'; return; }
    var rect = el.getBoundingClientRect();
    var rotation = getRotationDegrees(el);
    overlay.style.display = 'block';
    overlay.style.left   = rect.left   + 'px';
    overlay.style.top    = rect.top    + 'px';
    overlay.style.width  = rect.width  + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.transform = 'rotate(' + rotation + 'deg)';
    overlay.style.transformOrigin = 'center center';
    // Show lock indicator if locked
    var existingLock = overlay.querySelector('.__sf_lock_icon__');
    if (existingLock) existingLock.remove();
    if (el.getAttribute && el.getAttribute('data-sf-locked')) {
      var lockIcon = document.createElement('div');
      lockIcon.className = '__sf_lock_icon__';
      lockIcon.style.cssText = 'position:absolute;top:2px;right:2px;width:16px;height:16px;background:rgba(255,59,48,0.9);border-radius:3px;display:flex;align-items:center;justify-content:center;pointer-events:none;font-size:10px;';
      lockIcon.innerHTML = '&#128274;';
      overlay.appendChild(lockIcon);
    }
  }

  // ---- Computed styles ----
  function getComputedStylesObj(el) {
    var cs = window.getComputedStyle(el);
    var props = [
      'color', 'backgroundColor', 'fontSize', 'fontFamily', 'fontWeight',
      'lineHeight', 'letterSpacing', 'textAlign',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
      'borderRadius', 'borderWidth', 'borderColor', 'borderStyle',
      'opacity', 'display', 'width', 'height',
      'left', 'top', 'position', 'overflow', 'whiteSpace',
      'objectFit', 'zIndex', 'transform',
    ];
    var styles = {};
    props.forEach(function(p) { styles[p] = cs[p]; });
    return styles;
  }

  // ---- DOM serialization (strips placeholders + overlays) ----
  function getSlideOuterHtml() {
    var slideEl = document.querySelector('.slide') || document.body.firstElementChild;
    if (!slideEl) return document.body.innerHTML;
    var clone = slideEl.cloneNode(true);
    clone.querySelectorAll('[data-sf-placeholder]').forEach(function(ph) {
      if (ph.parentNode) ph.parentNode.removeChild(ph);
    });
    return clone.outerHTML;
  }

  function serializeDOM() {
    window.parent.postMessage({
      type: 'dom-updated',
      outerHtml: getSlideOuterHtml(),
    }, '*');
  }

  // ---- Parent notifications ----
  function notifyParentSelected() {
    if (!selectedEl) return;
    var computedStyles = getComputedStylesObj(selectedEl);
    var rect = selectedEl.getBoundingClientRect();
    var isGroup = selectedEl.classList && selectedEl.classList.contains('sf-group');
    var isLocked = !!(selectedEl.getAttribute && selectedEl.getAttribute('data-sf-locked'));
    window.parent.postMessage({
      type: 'element-selected',
      xpath: getXPath(selectedEl),
      tagName: selectedEl.tagName,
      textContent: selectedEl.textContent || '',
      computedStyles: computedStyles,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      inlineStyle: selectedEl.getAttribute('style') || '',
      isGroup: isGroup,
      groupChildCount: isGroup ? selectedEl.children.length : 0,
      isLocked: isLocked,
    }, '*');
  }

  function notifyParentMultiSelect() {
    var xpaths = multiSelectedEls.map(function(el) { return getXPath(el); });
    window.parent.postMessage({ type: 'multi-select', xpaths: xpaths }, '*');
  }

  // ---- Group ancestor lookup ----
  function findGroupAncestor(el) {
    var current = el ? el.parentElement : null;
    while (current && current !== document.body) {
      if (current.classList && current.classList.contains('sf-group')) return current;
      current = current.parentElement;
    }
    return null;
  }

  // ---- Group / Ungroup ----
  function groupSelection() {
    var els = multiSelectedEls.slice();
    if (els.length < 2) return;

    var group = document.createElement('div');
    group.className = 'sf-group';
    group.style.cssText = 'position:relative;display:inline-block;';

    var firstEl = els[0];
    if (firstEl.parentNode) {
      firstEl.parentNode.insertBefore(group, firstEl);
    }
    els.forEach(function(el) {
      group.appendChild(el);
    });

    multiSelectedEls = [];
    updateMultiBBoxOverlay();
    selectedEl = group;
    updateOverlay(group);
    notifyParentSelected();
    serializeDOM();
  }

  function ungroupSelection() {
    if (!selectedEl || !selectedEl.classList || !selectedEl.classList.contains('sf-group')) return;
    var parent = selectedEl.parentNode;
    if (!parent) return;
    var children = Array.from(selectedEl.children);
    children.forEach(function(child) {
      parent.insertBefore(child, selectedEl);
    });
    parent.removeChild(selectedEl);
    selectedEl = null;
    activeGroup = null;
    if (overlay) overlay.style.display = 'none';
    serializeDOM();
    window.parent.postMessage({ type: 'selection-cleared' }, '*');
  }

  // ---- Duplicate element ----
  function duplicateElement(el) {
    if (!el) return;
    var clone = el.cloneNode(true);
    // Remove any id to avoid duplicates
    clone.removeAttribute('id');
    // Offset position
    var cs = window.getComputedStyle(el);
    var left = parseFloat(cs.left) || 0;
    var top = parseFloat(cs.top) || 0;
    clone.style.position = 'absolute';
    clone.style.left = (left + 20) + 'px';
    clone.style.top = (top + 20) + 'px';
    if (el.parentNode) {
      el.parentNode.insertBefore(clone, el.nextSibling);
    }
    selectedEl = clone;
    updateOverlay(clone);
    notifyParentSelected();
    serializeDOM();
  }

  // ---- Delete element(s) ----
  function deleteSelected() {
    if (multiSelectedEls.length > 0) {
      multiSelectedEls.forEach(function(el) {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      multiSelectedEls = [];
      updateMultiBBoxOverlay();
    } else if (selectedEl) {
      if (selectedEl.parentNode) selectedEl.parentNode.removeChild(selectedEl);
      selectedEl = null;
      if (overlay) overlay.style.display = 'none';
    }
    window.parent.postMessage({ type: 'selection-cleared' }, '*');
    serializeDOM();
  }

  // ---- Copy / Cut / Paste ----
  function copySelected() {
    clipboardEls = [];
    if (multiSelectedEls.length > 0) {
      multiSelectedEls.forEach(function(el) {
        clipboardEls.push(el.outerHTML);
      });
    } else if (selectedEl) {
      clipboardEls.push(selectedEl.outerHTML);
    }
    clipboardOffset = 0;
    // Notify parent to store clipboard
    window.parent.postMessage({ type: 'clipboard-updated', htmls: clipboardEls }, '*');
  }

  function cutSelected() {
    copySelected();
    deleteSelected();
  }

  function pasteClipboard(htmls) {
    var list = htmls || clipboardEls;
    if (!list || list.length === 0) return;
    clipboardOffset += 20;
    var slideEl = document.querySelector('.slide') || document.body.firstElementChild;
    if (!slideEl) return;

    var pasted = [];
    list.forEach(function(html) {
      var tmp = document.createElement('div');
      tmp.innerHTML = html;
      var el = tmp.firstElementChild;
      if (!el) return;
      el.removeAttribute('id');
      var cs = window.getComputedStyle ? null : null;
      var left = parseFloat(el.style.left || '0') || 50;
      var top = parseFloat(el.style.top || '0') || 50;
      el.style.position = 'absolute';
      el.style.left = (left + clipboardOffset) + 'px';
      el.style.top = (top + clipboardOffset) + 'px';
      slideEl.appendChild(el);
      pasted.push(el);
    });

    if (pasted.length === 1) {
      selectedEl = pasted[0];
      multiSelectedEls = [];
      updateMultiBBoxOverlay();
      updateOverlay(pasted[0]);
      notifyParentSelected();
    } else if (pasted.length > 1) {
      selectedEl = null;
      multiSelectedEls = pasted;
      updateOverlay(null);
      updateMultiBBoxOverlay();
      notifyParentMultiSelect();
    }
    serializeDOM();
  }

  // ---- Context menu ----
  function closeContextMenu() {
    if (contextMenuEl && contextMenuEl.parentNode) {
      contextMenuEl.parentNode.removeChild(contextMenuEl);
    }
    contextMenuEl = null;
  }

  function showContextMenu(x, y, targetEl) {
    closeContextMenu();

    var menu = document.createElement('div');
    menu.id = '__sf_context_menu__';
    menu.style.cssText = [
      'position:fixed',
      'left:' + x + 'px',
      'top:' + y + 'px',
      'z-index:999999',
      'background:rgba(255,255,255,0.98)',
      'border:1px solid rgba(0,0,0,0.06)',
      'border-radius:10px',
      'padding:4px',
      'min-width:160px',
      'box-shadow:0 18px 44px rgba(15,23,42,0.16)',
      'backdrop-filter:blur(16px)',
      'font-family:-apple-system,sans-serif',
      'font-size:12px',
    ].join(';');

    var isLocked = targetEl && targetEl.getAttribute && targetEl.getAttribute('data-sf-locked');
    var isGrp = targetEl && targetEl.classList && targetEl.classList.contains('sf-group');
    var hasMulti = multiSelectedEls.length > 1;
    var hasClip = clipboardEls.length > 0;

    var items = [
      { label: 'コピー', key: 'copy', enabled: !!targetEl },
      { label: 'カット', key: 'cut', enabled: !!targetEl && !isLocked },
      { label: 'ペースト', key: 'paste', enabled: hasClip },
      { label: '複製', key: 'duplicate', enabled: !!targetEl && !isLocked },
      { label: '---' },
      { label: '前面へ', key: 'bringForward', enabled: !!targetEl && !isLocked },
      { label: '背面へ', key: 'sendBackward', enabled: !!targetEl && !isLocked },
      { label: '最前面へ', key: 'bringToFront', enabled: !!targetEl && !isLocked },
      { label: '最背面へ', key: 'sendToBack', enabled: !!targetEl && !isLocked },
      { label: '---' },
      { label: isLocked ? 'ロック解除' : 'ロック', key: 'toggleLock', enabled: !!targetEl },
      { label: '---' },
      { label: hasMulti ? 'グループ化' : (isGrp ? 'グループ解除' : 'グループ化'), key: hasMulti ? 'group' : (isGrp ? 'ungroup' : 'group'), enabled: hasMulti || isGrp },
      { label: '削除', key: 'delete', enabled: !!targetEl && !isLocked },
    ];

    items.forEach(function(item) {
      if (item.label === '---') {
        var sep = document.createElement('div');
        sep.style.cssText = 'height:1px;background:rgba(0,0,0,0.06);margin:3px 0;';
        menu.appendChild(sep);
        return;
      }
      var btn = document.createElement('button');
      btn.textContent = item.label;
      btn.disabled = !item.enabled;
      btn.style.cssText = [
        'display:block',
        'width:100%',
        'text-align:left',
        'padding:7px 12px',
        'border-radius:6px',
        'border:none',
        'background:transparent',
        'color:' + (item.enabled ? '#1d1d1f' : 'rgba(29,29,31,0.28)'),
        'cursor:' + (item.enabled ? 'pointer' : 'default'),
        'font-size:12px',
        'font-family:-apple-system,sans-serif',
        item.key === 'delete' ? 'color:#FF3B30;' : '',
      ].join(';');
      btn.onmouseenter = function() {
        if (item.enabled) btn.style.background = 'rgba(0,122,255,0.06)';
      };
      btn.onmouseleave = function() {
        btn.style.background = 'transparent';
      };
      btn.onclick = function(e) {
        e.stopPropagation();
        closeContextMenu();
        handleContextAction(item.key, targetEl);
      };
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    contextMenuEl = menu;

    // Auto-adjust if offscreen
    var rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (y - rect.height) + 'px';
    }
  }

  function handleContextAction(key, targetEl) {
    switch(key) {
      case 'copy': copySelected(); break;
      case 'cut': cutSelected(); break;
      case 'paste': pasteClipboard(null); break;
      case 'duplicate': duplicateElement(selectedEl || targetEl); break;
      case 'bringForward': zIndexOp('forward'); break;
      case 'sendBackward': zIndexOp('backward'); break;
      case 'bringToFront': zIndexOp('front'); break;
      case 'sendToBack': zIndexOp('back'); break;
      case 'toggleLock': toggleLock(selectedEl || targetEl); break;
      case 'group': groupSelection(); break;
      case 'ungroup': ungroupSelection(); break;
      case 'delete': deleteSelected(); break;
    }
  }

  // ---- Z-index operations ----
  function zIndexOp(op) {
    var el = selectedEl;
    if (!el) return;
    var cs = window.getComputedStyle(el);
    var current = parseInt(cs.zIndex) || 0;
    if (isNaN(current)) current = 0;
    switch(op) {
      case 'front': el.style.zIndex = '9999'; break;
      case 'back': el.style.zIndex = '0'; break;
      case 'forward': el.style.zIndex = (current + 1) + ''; break;
      case 'backward': el.style.zIndex = Math.max(0, current - 1) + ''; break;
    }
    notifyParentSelected();
    serializeDOM();
  }

  // ---- Lock / Unlock ----
  function toggleLock(el) {
    if (!el) return;
    if (el.getAttribute('data-sf-locked')) {
      el.removeAttribute('data-sf-locked');
    } else {
      el.setAttribute('data-sf-locked', '1');
    }
    if (selectedEl === el) {
      updateOverlay(el);
      notifyParentSelected();
    }
    serializeDOM();
  }

  // ---- Align elements ----
  function alignElements(xpaths, alignType) {
    var els = xpaths.map(function(xp) { return getElementByXPath(xp); }).filter(Boolean);
    if (els.length < 2) return;

    // Ensure all are absolutely positioned
    els.forEach(function(el) {
      var cs = window.getComputedStyle(el);
      if (cs.position === 'static' || cs.position === 'relative') {
        var rect = el.getBoundingClientRect();
        var parent = el.offsetParent || document.documentElement;
        var parentRect = parent.getBoundingClientRect();
        el.style.position = 'absolute';
        el.style.left = (rect.left - parentRect.left) + 'px';
        el.style.top = (rect.top - parentRect.top) + 'px';
      }
    });

    var rects = els.map(function(el) { return el.getBoundingClientRect(); });
    var minL = Math.min.apply(null, rects.map(function(r) { return r.left; }));
    var maxR = Math.max.apply(null, rects.map(function(r) { return r.right; }));
    var minT = Math.min.apply(null, rects.map(function(r) { return r.top; }));
    var maxB = Math.max.apply(null, rects.map(function(r) { return r.bottom; }));
    var centerX = (minL + maxR) / 2;
    var centerY = (minT + maxB) / 2;

    els.forEach(function(el, i) {
      var r = rects[i];
      var curL = parseFloat(el.style.left) || r.left;
      var curT = parseFloat(el.style.top) || r.top;
      switch(alignType) {
        case 'left':    el.style.left = (curL + (minL - r.left)) + 'px'; break;
        case 'centerX': el.style.left = (curL + (centerX - r.width/2 - r.left)) + 'px'; break;
        case 'right':   el.style.left = (curL + (maxR - r.right)) + 'px'; break;
        case 'top':     el.style.top  = (curT + (minT - r.top)) + 'px'; break;
        case 'centerY': el.style.top  = (curT + (centerY - r.height/2 - r.top)) + 'px'; break;
        case 'bottom':  el.style.top  = (curT + (maxB - r.bottom)) + 'px'; break;
        case 'distributeX': {
          var sorted = els.slice().sort(function(a,b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
          var totalW = sorted.reduce(function(s,e) { return s + e.getBoundingClientRect().width; }, 0);
          var gap = (maxR - minL - totalW) / (sorted.length - 1);
          var x = minL;
          sorted.forEach(function(e) {
            var er = e.getBoundingClientRect();
            var cl = parseFloat(e.style.left) || er.left;
            e.style.left = (cl + (x - er.left)) + 'px';
            x += er.width + gap;
          });
          break;
        }
        case 'distributeY': {
          var sorted2 = els.slice().sort(function(a,b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
          var totalH = sorted2.reduce(function(s,e) { return s + e.getBoundingClientRect().height; }, 0);
          var gap2 = (maxB - minT - totalH) / (sorted2.length - 1);
          var y = minT;
          sorted2.forEach(function(e) {
            var er2 = e.getBoundingClientRect();
            var ct = parseFloat(e.style.top) || er2.top;
            e.style.top = (ct + (y - er2.top)) + 'px';
            y += er2.height + gap2;
          });
          break;
        }
      }
    });

    updateMultiBBoxOverlay();
    serializeDOM();
  }

  // ---- Click ----
  document.addEventListener('click', function(e) {
    // Close context menu on any click
    if (contextMenuEl && !contextMenuEl.contains(e.target)) {
      closeContextMenu();
    }

    if (isEditing || isDragging) return;
    var target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;
    if (target.id === '__sf_overlay__' || target.id === '__sf_multi_bbox__') return;
    if (target.getAttribute && (target.getAttribute('data-sf-handle') || target.getAttribute('data-sf-rotate-handle'))) return;
    if (target.getAttribute && target.getAttribute('data-sf-placeholder')) return;
    if (target.id === '__sf_context_menu__' || (target.closest && target.closest('#__sf_context_menu__'))) return;
    if (target.id === '__sf_snap_guides__') return;

    e.preventDefault();
    e.stopPropagation();

    // Determine what to actually select
    var groupAncestor = findGroupAncestor(target);
    var targetIsGroup = target.classList && target.classList.contains('sf-group');
    var elToSelect;

    if (targetIsGroup) {
      elToSelect = target;
      activeGroup = null;
    } else if (groupAncestor && activeGroup !== groupAncestor) {
      elToSelect = groupAncestor;
      activeGroup = null;
    } else {
      if (!groupAncestor) activeGroup = null;
      elToSelect = target;
    }

    // Skip locked elements for selection (allow but show lock)
    // Actually allow selection of locked elements but prevent drag

    // Shift+click 竊・multi-select
    if (e.shiftKey) {
      var idx = multiSelectedEls.indexOf(elToSelect);
      if (idx === -1) {
        multiSelectedEls.push(elToSelect);
      } else {
        multiSelectedEls.splice(idx, 1);
      }
      if (multiSelectedEls.length === 1) {
        selectedEl = multiSelectedEls[0];
        multiSelectedEls = [];
        updateOverlay(selectedEl);
        updateMultiBBoxOverlay();
        notifyParentSelected();
      } else if (multiSelectedEls.length === 0) {
        selectedEl = null;
        updateOverlay(null);
        updateMultiBBoxOverlay();
      } else {
        selectedEl = null;
        updateOverlay(null);
        updateMultiBBoxOverlay();
        notifyParentMultiSelect();
      }
      return;
    }

    // Regular click 竊・clear multi-select, select one element
    multiSelectedEls = [];
    updateMultiBBoxOverlay();

    selectedEl = elToSelect;
    updateOverlay(elToSelect);

    var xpath = getXPath(elToSelect);
    var computedStyles = getComputedStylesObj(elToSelect);
    var rect = elToSelect.getBoundingClientRect();
    var isGroup = elToSelect.classList && elToSelect.classList.contains('sf-group');
    var isLocked = !!(elToSelect.getAttribute && elToSelect.getAttribute('data-sf-locked'));

    window.parent.postMessage({
      type: 'element-selected',
      xpath: xpath,
      tagName: elToSelect.tagName,
      textContent: elToSelect.textContent || '',
      computedStyles: computedStyles,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      inlineStyle: elToSelect.getAttribute('style') || '',
      isGroup: isGroup,
      groupChildCount: isGroup ? elToSelect.children.length : 0,
      isLocked: isLocked,
    }, '*');
  }, true);

  // ---- Double-click ----
  document.addEventListener('dblclick', function(e) {
    var target = e.target;
    if (!target || target.id === '__sf_overlay__' || target.id === '__sf_multi_bbox__') return;
    if (target.getAttribute && (target.getAttribute('data-sf-handle') || target.getAttribute('data-sf-rotate-handle'))) return;

    e.preventDefault();
    e.stopPropagation();

    var targetIsGroup = target.classList && target.classList.contains('sf-group');
    var groupAncestor = findGroupAncestor(target);

    if (targetIsGroup) {
      activeGroup = target;
      selectedEl = null;
      updateOverlay(null);
      return;
    }
    if (groupAncestor && activeGroup !== groupAncestor) {
      activeGroup = groupAncestor;
      selectedEl = null;
      updateOverlay(null);
      return;
    }

    // Don't edit locked elements
    if (target.getAttribute && target.getAttribute('data-sf-locked')) return;

    target.contentEditable = 'true';
    target.focus();
    isEditing = true;
    if (overlay) overlay.style.display = 'none';

    function onBlur() {
      target.contentEditable = 'false';
      isEditing = false;
      var xpath = getXPath(target);
      window.parent.postMessage({
        type: 'text-updated',
        xpath: xpath,
        textContent: target.innerHTML,
      }, '*');
      target.removeEventListener('blur', onBlur);
      updateOverlay(target);
      serializeDOM();
    }
    target.addEventListener('blur', onBlur);
  }, true);

  // ---- Right-click context menu ----
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    e.stopPropagation();

    var target = e.target;
    if (!target || target === document.body || target === document.documentElement) {
      showContextMenu(e.clientX, e.clientY, null);
      return;
    }
    if (target.id === '__sf_overlay__' || target.id === '__sf_multi_bbox__') {
      showContextMenu(e.clientX, e.clientY, selectedEl);
      return;
    }
    if (target.getAttribute && (target.getAttribute('data-sf-handle') || target.getAttribute('data-sf-rotate-handle'))) return;
    if (target.id === '__sf_context_menu__' || (target.closest && target.closest('#__sf_context_menu__'))) return;

    // Select the right-clicked element if not already selected
    var groupAncestor = findGroupAncestor(target);
    var targetIsGroup = target.classList && target.classList.contains('sf-group');
    var elToSelect = targetIsGroup ? target : (groupAncestor && activeGroup !== groupAncestor ? groupAncestor : target);

    if (multiSelectedEls.length === 0 || multiSelectedEls.indexOf(elToSelect) === -1) {
      multiSelectedEls = [];
      updateMultiBBoxOverlay();
      selectedEl = elToSelect;
      updateOverlay(elToSelect);
      notifyParentSelected();
    }

    showContextMenu(e.clientX, e.clientY, elToSelect);
  }, true);

  // ---- Drag: mousedown ----
  document.addEventListener('mousedown', function(e) {
    if (isEditing || isResizing || isRotating) return;
    if (!selectedEl) return;
    if (e.target && e.target.getAttribute && (e.target.getAttribute('data-sf-handle') || e.target.getAttribute('data-sf-rotate-handle'))) return;
    if (e.target !== selectedEl && !selectedEl.contains(e.target)) return;
    // Don't drag locked elements
    if (selectedEl.getAttribute && selectedEl.getAttribute('data-sf-locked')) return;

    mouseDownOnEl = true;
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    var cs = window.getComputedStyle(selectedEl);
    if (cs.position === 'static' || cs.position === 'relative') {
      var rect = selectedEl.getBoundingClientRect();
      var parent = selectedEl.offsetParent || document.documentElement;
      var parentRect = parent.getBoundingClientRect();
      dragStartLeft = rect.left - parentRect.left;
      dragStartTop = rect.top - parentRect.top;
    } else {
      dragStartLeft = parseFloat(cs.left) || 0;
      dragStartTop = parseFloat(cs.top) || 0;
    }
  }, true);

  // ---- Drag / Resize: mousemove ----
  document.addEventListener('mousemove', function(e) {
    if (isRotating && selectedEl) {
      var angle = Math.atan2(e.clientY - rotateCenterY, e.clientX - rotateCenterX) * 180 / Math.PI + 90;
      if (e.shiftKey) angle = Math.round(angle / 15) * 15;
      selectedEl.style.transform = 'rotate(' + angle + 'deg)';
      updateOverlay(selectedEl);
      notifyParentSelected();
      return;
    }

    // Resize
    if (isResizing && selectedEl) {
      var dx = e.clientX - resizeStartX;
      var dy = e.clientY - resizeStartY;
      var newLeft = resizeStartLeft;
      var newTop = resizeStartTop;
      var newWidth = resizeStartWidth;
      var newHeight = resizeStartHeight;

      if (resizeType.indexOf('e') !== -1) newWidth = Math.max(10, resizeStartWidth + dx);
      if (resizeType.indexOf('s') !== -1) newHeight = Math.max(10, resizeStartHeight + dy);
      if (resizeType.indexOf('w') !== -1) {
        newWidth = Math.max(10, resizeStartWidth - dx);
        newLeft = resizeStartLeft + (resizeStartWidth - newWidth);
      }
      if (resizeType.indexOf('n') !== -1) {
        newHeight = Math.max(10, resizeStartHeight - dy);
        newTop = resizeStartTop + (resizeStartHeight - newHeight);
      }

      selectedEl.style.width = newWidth + 'px';
      selectedEl.style.height = newHeight + 'px';
      selectedEl.style.left = newLeft + 'px';
      selectedEl.style.top = newTop + 'px';
      updateOverlay(selectedEl);
      notifyParentSelected();
      return;
    }

    // Drag threshold check
    if (mouseDownOnEl && !isDragging) {
      var mdx = Math.abs(e.clientX - mouseDownX);
      var mdy = Math.abs(e.clientY - mouseDownY);
      if (mdx > 3 || mdy > 3) {
        isDragging = true;
        var cs = window.getComputedStyle(selectedEl);
        if (cs.position === 'static' || cs.position === 'relative') {
          wasStaticBeforeDrag = true;
          var ph = document.createElement('div');
          ph.setAttribute('data-sf-placeholder', '1');
          ph.style.cssText = [
            'display:block',
            'visibility:hidden',
            'pointer-events:none',
            'box-sizing:border-box',
            'width:' + selectedEl.offsetWidth + 'px',
            'height:' + selectedEl.offsetHeight + 'px',
            'flex-shrink:0',
            'margin-top:' + cs.marginTop,
            'margin-right:' + cs.marginRight,
            'margin-bottom:' + cs.marginBottom,
            'margin-left:' + cs.marginLeft,
          ].join(';');
          dragOriginalParent = selectedEl.parentNode;
          if (dragOriginalParent) {
            dragOriginalParent.insertBefore(ph, selectedEl);
          }
          dragPlaceholder = ph;
          selectedEl.style.position = 'absolute';
          selectedEl.style.left = dragStartLeft + 'px';
          selectedEl.style.top = dragStartTop + 'px';
        } else {
          wasStaticBeforeDrag = false;
        }
      }
    }

    // Drag move with snap
    if (isDragging && selectedEl) {
      var ddx = e.clientX - dragStartX;
      var ddy = e.clientY - dragStartY;
      var rawLeft = dragStartLeft + ddx;
      var rawTop = dragStartTop + ddy;
      var w = selectedEl.offsetWidth;
      var h = selectedEl.offsetHeight;

      var snapResult = applySnap(rawLeft, rawTop, w, h);
      selectedEl.style.left = snapResult.snapped.left + 'px';
      selectedEl.style.top  = snapResult.snapped.top + 'px';
      drawSnapGuides(snapResult.guides);
      updateOverlay(selectedEl);
      notifyParentSelected();
    }
  });

  // ---- Mouseup ----
  document.addEventListener('mouseup', function(e) {
    var wasDragging = isDragging || isResizing || isRotating;
    isDragging = false;
    mouseDownOnEl = false;
    isResizing = false;
    isRotating = false;
    resizeType = '';
    clearSnapGuides();

    if (wasDragging && selectedEl && dragPlaceholder && wasStaticBeforeDrag) {
      var phRect = dragPlaceholder.getBoundingClientRect();
      var elRect = selectedEl.getBoundingClientRect();
      var distX = Math.abs(elRect.left - phRect.left);
      var distY = Math.abs(elRect.top - phRect.top);

      if (distX < 30 && distY < 30) {
        if (dragOriginalParent && dragPlaceholder.parentNode === dragOriginalParent) {
          dragOriginalParent.insertBefore(selectedEl, dragPlaceholder);
        }
        if (dragPlaceholder.parentNode) dragPlaceholder.parentNode.removeChild(dragPlaceholder);
        selectedEl.style.position = '';
        selectedEl.style.left = '';
        selectedEl.style.top = '';
      }
    }

    dragPlaceholder = null;
    dragOriginalParent = null;
    wasStaticBeforeDrag = false;

    if (wasDragging && selectedEl) {
      notifyParentSelected();
      serializeDOM();
    }
  });

  // ---- Keyboard shortcuts ----
  document.addEventListener('keydown', function(e) {
    var isCtrl = e.ctrlKey || e.metaKey;

    // Ctrl+G / Ctrl+Shift+G
    if (isCtrl && (e.key === 'g' || e.key === 'G')) {
      e.preventDefault();
      if (e.shiftKey) {
        ungroupSelection();
      } else {
        groupSelection();
      }
      return;
    }

    // Ctrl+C
    if (isCtrl && e.key === 'c' && !isEditing) {
      e.preventDefault();
      copySelected();
      return;
    }

    // Ctrl+X
    if (isCtrl && e.key === 'x' && !isEditing) {
      e.preventDefault();
      cutSelected();
      return;
    }

    // Ctrl+V
    if (isCtrl && e.key === 'v' && !isEditing) {
      e.preventDefault();
      pasteClipboard(null);
      return;
    }

    // Ctrl+D (duplicate)
    if (isCtrl && e.key === 'd' && !isEditing) {
      e.preventDefault();
      duplicateElement(selectedEl);
      return;
    }

    // Delete / Backspace
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditing) {
      e.preventDefault();
      deleteSelected();
      return;
    }
  });

  // ---- Parent 竊・iframe messages ----
  window.addEventListener('message', function(e) {
    var data = e.data || {};
    var type = data.type, xpath = data.xpath, property = data.property, value = data.value;

    if (type === 'update-style') {
      var el = getElementByXPath(xpath);
      if (el) {
        if ((property === 'left' || property === 'top') && el.style.position !== 'absolute') {
          var cs = window.getComputedStyle(el);
          if (cs.position === 'static' || cs.position === 'relative') {
            var rect = el.getBoundingClientRect();
            var parent = el.offsetParent || document.documentElement;
            var parentRect = parent.getBoundingClientRect();
            if (property !== 'left') el.style.left = (rect.left - parentRect.left) + 'px';
            if (property !== 'top')  el.style.top  = (rect.top  - parentRect.top)  + 'px';
            el.style.position = 'absolute';
          }
        }
        el.style[property] = value;
        if (selectedEl === el) updateOverlay(el);
        var computedStyles = getComputedStylesObj(el);
        var rect2 = el.getBoundingClientRect();
        var isLocked2 = !!(el.getAttribute && el.getAttribute('data-sf-locked'));
        window.parent.postMessage({
          type: 'element-selected',
          xpath: xpath,
          tagName: el.tagName,
          textContent: el.textContent || '',
          computedStyles: computedStyles,
          rect: { left: rect2.left, top: rect2.top, width: rect2.width, height: rect2.height },
          inlineStyle: el.getAttribute('style') || '',
          isGroup: el.classList && el.classList.contains('sf-group'),
          groupChildCount: (el.classList && el.classList.contains('sf-group')) ? el.children.length : 0,
          isLocked: isLocked2,
        }, '*');
        serializeDOM();
      }
    }

    if (type === 'update-text') {
      var el2 = getElementByXPath(xpath);
      if (el2) {
        el2.innerHTML = value;
        serializeDOM();
      }
    }

    if (type === 'clear-selection') {
      selectedEl = null;
      multiSelectedEls = [];
      activeGroup = null;
      if (overlay) overlay.style.display = 'none';
      updateMultiBBoxOverlay();
    }

    // Select element by xpath (from LayerPanel)
    if (type === 'select-element') {
      var selEl = getElementByXPath(xpath);
      if (selEl) {
        selectedEl = selEl;
        multiSelectedEls = [];
        updateOverlay(selEl);
        notifyParentSelected();
      }
    }

    if (type === 'update-css-var') {
      document.documentElement.style.setProperty(data.name, data.value);
      serializeDOM();
    }

    if (type === 'group-selected') {
      groupSelection();
    }

    if (type === 'ungroup-selected') {
      ungroupSelection();
    }

    // Insert new element
    if (type === 'insert-element') {
      var slideEl = document.querySelector('.slide') || document.body.firstElementChild;
      if (!slideEl) return;
      var tmp = document.createElement('div');
      tmp.innerHTML = data.html || '';
      var newEl = tmp.firstElementChild;
      if (!newEl) return;
      if (data.x !== undefined) newEl.style.left = data.x + 'px';
      if (data.y !== undefined) newEl.style.top = data.y + 'px';
      slideEl.appendChild(newEl);
      // Auto-select inserted element
      selectedEl = newEl;
      updateOverlay(newEl);
      notifyParentSelected();
      serializeDOM();
    }

    // Delete element by xpath
    if (type === 'delete-element') {
      var delEl = getElementByXPath(xpath);
      if (delEl && delEl.parentNode) {
        delEl.parentNode.removeChild(delEl);
        selectedEl = null;
        if (overlay) overlay.style.display = 'none';
        window.parent.postMessage({ type: 'selection-cleared' }, '*');
        serializeDOM();
      }
    }

    // Duplicate element
    if (type === 'duplicate-element') {
      duplicateElement(getElementByXPath(xpath) || selectedEl);
    }

    // Z-index operation
    if (type === 'zindex-op') {
      if (xpath) {
        var zEl = getElementByXPath(xpath);
        if (zEl) { selectedEl = zEl; updateOverlay(zEl); }
      }
      zIndexOp(data.op);
    }

    // Lock / unlock
    if (type === 'lock-element') {
      var lockEl = getElementByXPath(xpath) || selectedEl;
      if (lockEl) {
        lockEl.setAttribute('data-sf-locked', '1');
        if (selectedEl === lockEl) { updateOverlay(lockEl); notifyParentSelected(); }
        serializeDOM();
      }
    }
    if (type === 'unlock-element') {
      var unlockEl = getElementByXPath(xpath) || selectedEl;
      if (unlockEl) {
        unlockEl.removeAttribute('data-sf-locked');
        if (selectedEl === unlockEl) { updateOverlay(unlockEl); notifyParentSelected(); }
        serializeDOM();
      }
    }

    // Align
    if (type === 'align-elements') {
      alignElements(data.xpaths || [], data.alignType);
    }

    // Paste from parent clipboard
    if (type === 'paste-clipboard') {
      pasteClipboard(data.htmls || null);
    }

    // Set clipboard from parent
    if (type === 'set-clipboard') {
      clipboardEls = data.htmls || [];
      clipboardOffset = 0;
    }

    // Set zIndex directly
    if (type === 'set-zindex') {
      var zEl2 = getElementByXPath(xpath) || selectedEl;
      if (zEl2) {
        zEl2.style.zIndex = String(data.value);
        if (selectedEl === zEl2) { notifyParentSelected(); }
        serializeDOM();
      }
    }
  });

  window.parent.postMessage({ type: 'iframe-ready' }, '*');
})();
`;
