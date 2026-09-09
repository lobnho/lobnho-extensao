/**
 * Lobnho Extension - Target Cursor Tracker
 * Adapted from React Bits Target Cursor with Shadow DOM isolation and GSAP precision.
 */
(function (global) {
  'use strict';

  const logger = new global.LobnhoLogger('TARGET-CURSOR');

  class LobnhoTargetCursor {
    constructor(options = {}) {
      this.options = Object.assign({
        spinDuration: 2,
        hoverDuration: 0.2,
        cursorColor: '#ffffff',
        cursorColorOnTarget: '#ED2590', // Orkut Magenta
        borderWidth: 3,
        cornerSize: 12,
        onSelect: null
      }, options);

      this.isEnabled = false;
      this.hostElement = null;
      this.shadowRoot = null;
      this.cursorElement = null;
      this.dotElement = null;
      this.corners = [];
      this.badgeElement = null;

      this.spinTl = null;
      this.tickerFn = null;
      this.activeTarget = null;
      this.targetCornerPositions = null;
      this.activeStrength = { current: 0 };
      this.originalBodyCursor = '';
      this.containingBlock = null;

      this._boundMouseMove = this._onMouseMove.bind(this);
      this._boundMouseOver = this._onMouseOver.bind(this);
      this._boundTargetMouseLeave = this._onTargetMouseLeave.bind(this);
      this._boundMouseDown = this._onMouseDown.bind(this);
      this._boundMouseUp = this._onMouseUp.bind(this);
      this._boundScroll = this._onScroll.bind(this);
      this._boundResize = this._onResize.bind(this);
      this._boundClick = this._onClick.bind(this);
    }

    _getContainingBlock(element) {
      let node = element?.parentElement;
      while (node && node !== document.documentElement) {
        const style = window.getComputedStyle(node);
        if (
          style.transform !== 'none' ||
          style.perspective !== 'none' ||
          style.filter !== 'none' ||
          style.willChange.includes('transform') ||
          style.willChange.includes('perspective') ||
          style.willChange.includes('filter') ||
          /paint|layout|strict|content/.test(style.contain)
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    _getContainingBlockOffset(block) {
      if (!block) return { x: 0, y: 0 };
      const rect = block.getBoundingClientRect();
      return { x: rect.left + block.clientLeft, y: rect.top + block.clientTop };
    }

    _buildDOM() {
      if (this.hostElement) return;

      this.hostElement = document.createElement('div');
      this.hostElement.id = 'lobnho-target-cursor-host';
      this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

      // Fetch or inline styles
      const styleEl = document.createElement('style');
      styleEl.textContent = `
        :host {
          all: initial;
          position: fixed;
          top: 0;
          left: 0;
          width: 0;
          height: 0;
          pointer-events: none;
          z-index: 2147483647;
        }
        .target-cursor-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          width: 0;
          height: 0;
          pointer-events: none;
          z-index: 2147483647;
          mix-blend-mode: difference;
          transform: translate(-50%, -50%);
          will-change: transform;
        }
        .target-cursor-dot {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 5px;
          height: 5px;
          background: #ffffff;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          will-change: transform;
          box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
        }
        .target-cursor-corner {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 12px;
          height: 12px;
          border-color: #ffffff;
          pointer-events: none;
          box-sizing: border-box;
        }
        .target-cursor-corner.corner-tl {
          border-top: 3px solid #ffffff;
          border-left: 3px solid #ffffff;
        }
        .target-cursor-corner.corner-tr {
          border-top: 3px solid #ffffff;
          border-right: 3px solid #ffffff;
        }
        .target-cursor-corner.corner-br {
          border-bottom: 3px solid #ffffff;
          border-right: 3px solid #ffffff;
        }
        .target-cursor-corner.corner-bl {
          border-bottom: 3px solid #ffffff;
          border-left: 3px solid #ffffff;
        }
        .target-cursor-badge {
          position: absolute;
          left: 20px;
          top: -24px;
          background: #3B5998;
          color: #ffffff;
          font-family: 'Trebuchet MS', Verdana, Arial, sans-serif;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid #ED2590;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s ease-out;
        }
        .target-cursor-active .target-cursor-badge {
          opacity: 1;
        }
      `;
      this.shadowRoot.appendChild(styleEl);

      const wrapper = document.createElement('div');
      wrapper.className = 'target-cursor-wrapper';

      const dot = document.createElement('div');
      dot.className = 'target-cursor-dot';
      wrapper.appendChild(dot);

      const cornersClasses = ['corner-tl', 'corner-tr', 'corner-br', 'corner-bl'];
      this.corners = cornersClasses.map((cls) => {
        const c = document.createElement('div');
        c.className = `target-cursor-corner ${cls}`;
        wrapper.appendChild(c);
        return c;
      });

      const badge = document.createElement('div');
      badge.className = 'target-cursor-badge';
      badge.textContent = '<element>';
      wrapper.appendChild(badge);

      this.shadowRoot.appendChild(wrapper);

      this.cursorElement = wrapper;
      this.dotElement = dot;
      this.badgeElement = badge;

      (document.body || document.documentElement).appendChild(this.hostElement);
    }

    activate() {
      if (this.isEnabled) return;
      this._buildDOM();
      this.hostElement.style.display = 'block';

      this.isEnabled = true;
      this.originalBodyCursor = document.body.style.cursor;
      document.body.style.cursor = 'none';

      this.containingBlock = this._getContainingBlock(this.cursorElement);
      const offset = this._getContainingBlockOffset(this.containingBlock);

      if (global.gsap) {
        gsap.set(this.cursorElement, {
          xPercent: -50,
          yPercent: -50,
          x: window.innerWidth / 2 - offset.x,
          y: window.innerHeight / 2 - offset.y
        });

        this.spinTl = gsap.timeline({ repeat: -1 })
          .to(this.cursorElement, { rotation: '+=360', duration: this.options.spinDuration, ease: 'none' });

        this._setupTicker();
      }

      window.addEventListener('mousemove', this._boundMouseMove, { passive: true });
      window.addEventListener('mouseover', this._boundMouseOver, { passive: true });
      window.addEventListener('mousedown', this._boundMouseDown, { passive: true });
      window.addEventListener('mouseup', this._boundMouseUp, { passive: true });
      window.addEventListener('scroll', this._boundScroll, { passive: true });
      window.addEventListener('resize', this._boundResize, { passive: true });
      document.addEventListener('click', this._boundClick, true);

      logger.info('Target Cursor activated');
    }

    deactivate() {
      if (!this.isEnabled) return;
      this.isEnabled = false;

      if (this.spinTl) {
        this.spinTl.kill();
        this.spinTl = null;
      }

      if (global.gsap && this.tickerFn) {
        gsap.ticker.remove(this.tickerFn);
        this.tickerFn = null;
      }

      window.removeEventListener('mousemove', this._boundMouseMove);
      window.removeEventListener('mouseover', this._boundMouseOver);
      this.activeTarget?.removeEventListener('mouseleave', this._boundTargetMouseLeave);
      window.removeEventListener('mousedown', this._boundMouseDown);
      window.removeEventListener('mouseup', this._boundMouseUp);
      window.removeEventListener('scroll', this._boundScroll);
      window.removeEventListener('resize', this._boundResize);
      document.removeEventListener('click', this._boundClick, true);

      document.body.style.cursor = this.originalBodyCursor;
      if (this.cursorElement) {
        this.cursorElement.classList.remove('target-cursor-active');
      }
      if (this.hostElement) {
        this.hostElement.style.display = 'none';
      }

      this.activeTarget = null;
      this.targetCornerPositions = null;
      this.activeStrength.current = 0;

      logger.info('Target Cursor deactivated');
    }

    _setupTicker() {
      const gsap = global.gsap;
      if (!gsap) return;

      this.tickerFn = () => {
        if (!this.targetCornerPositions || !this.cursorElement || this.corners.length === 0) return;
        const strength = this.activeStrength.current;
        if (strength === 0) return;

        const cursorX = gsap.getProperty(this.cursorElement, 'x');
        const cursorY = gsap.getProperty(this.cursorElement, 'y');

        this.corners.forEach((corner, i) => {
          const currentX = gsap.getProperty(corner, 'x');
          const currentY = gsap.getProperty(corner, 'y');

          const targetX = this.targetCornerPositions[i].x - cursorX;
          const targetY = this.targetCornerPositions[i].y - cursorY;

          const finalX = currentX + (targetX - currentX) * strength;
          const finalY = currentY + (targetY - currentY) * strength;

          gsap.to(corner, {
            x: finalX,
            y: finalY,
            duration: strength >= 0.99 ? 0.2 : 0.05,
            ease: 'power1.out',
            overwrite: 'auto'
          });
        });
      };

      gsap.ticker.add(this.tickerFn);
    }

    _onMouseMove(e) {
      if (!this.cursorElement || !global.gsap) return;
      const offset = this._getContainingBlockOffset(this.containingBlock);
      gsap.to(this.cursorElement, {
        x: e.clientX - offset.x,
        y: e.clientY - offset.y,
        duration: 0.1,
        ease: 'power3.out'
      });
    }

    _onMouseOver(e) {
      const target = e.target;
      if (!target || target === document.body || target === document.documentElement || this.hostElement?.contains(target)) {
        return;
      }

      // Ignore extension internal elements
      if (target.closest && (target.closest('#lobnho-inspector-host') || target.closest('#lobnho-target-cursor-host'))) {
        return;
      }

      if (this.activeTarget === target) return;
      this.activeTarget?.removeEventListener('mouseleave', this._boundTargetMouseLeave);
      this.activeTarget = target;
      target.addEventListener('mouseleave', this._boundTargetMouseLeave, { once: true });

      const gsap = global.gsap;
      if (!gsap) return;

      this.cursorElement.classList.add('target-cursor-active');

      // Update badge label
      const tag = target.tagName.toLowerCase();
      const id = target.id ? `#${target.id}` : '';
      const cls = target.className && typeof target.className === 'string' ? `.${target.className.trim().split(/\s+/)[0]}` : '';
      this.badgeElement.textContent = `<${tag}${id}${cls}>`;

      this.corners.forEach(c => gsap.killTweensOf(c, 'x,y'));
      gsap.killTweensOf(this.cursorElement, 'rotation');
      this.spinTl?.pause();
      gsap.set(this.cursorElement, { rotation: 0 });

      // Change border color to Orkut pink
      gsap.to(this.corners, { borderColor: this.options.cursorColorOnTarget, duration: 0.15 });
      gsap.to(this.dotElement, { backgroundColor: this.options.cursorColorOnTarget, duration: 0.15 });

      const rect = target.getBoundingClientRect();
      const { borderWidth, cornerSize } = this.options;
      const offset = this._getContainingBlockOffset(this.containingBlock);

      this.targetCornerPositions = [
        { x: rect.left - borderWidth - offset.x, y: rect.top - borderWidth - offset.y },
        { x: rect.right + borderWidth - cornerSize - offset.x, y: rect.top - borderWidth - offset.y },
        { x: rect.right + borderWidth - cornerSize - offset.x, y: rect.bottom + borderWidth - cornerSize - offset.y },
        { x: rect.left - borderWidth - offset.x, y: rect.bottom + borderWidth - cornerSize - offset.y }
      ];

      gsap.to(this.activeStrength, { current: 1, duration: this.options.hoverDuration, ease: 'power2.out' });
    }

    _onTargetMouseLeave(event) {
      if (this.activeTarget !== event.currentTarget) return;
      const gsap = global.gsap;
      this.activeTarget = null;
      this.targetCornerPositions = null;
      this.cursorElement?.classList.remove('target-cursor-active');

      if (!gsap) {
        this.activeStrength.current = 0;
        return;
      }

      const initialCornerPositions = [
        { x: -18, y: -18 },
        { x: 6, y: -18 },
        { x: 6, y: 6 },
        { x: -18, y: 6 }
      ];
      this.corners.forEach((corner, index) => {
        gsap.to(corner, {
          x: initialCornerPositions[index].x,
          y: initialCornerPositions[index].y,
          duration: 0.25,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      });
      gsap.to(this.activeStrength, { current: 0, duration: this.options.hoverDuration, ease: 'power2.out' });
      gsap.to(this.corners, { borderColor: this.options.cursorColor, duration: 0.15 });
      gsap.to(this.dotElement, { backgroundColor: this.options.cursorColor, duration: 0.15 });
      gsap.set(this.cursorElement, { rotation: 0 });
      this.spinTl?.play();
    }

    _onMouseDown() {
      if (!this.dotElement || !global.gsap) return;
      gsap.to(this.dotElement, { scale: 0.7, duration: 0.3 });
      gsap.to(this.cursorElement, { scale: 0.9, duration: 0.2 });
    }

    _onMouseUp() {
      if (!this.dotElement || !global.gsap) return;
      gsap.to(this.dotElement, { scale: 1, duration: 0.3 });
      gsap.to(this.cursorElement, { scale: 1, duration: 0.2 });
    }

    _onScroll() {
      if (!this.activeTarget) return;
      const rect = this.activeTarget.getBoundingClientRect();
      const { borderWidth, cornerSize } = this.options;
      const offset = this._getContainingBlockOffset(this.containingBlock);

      this.targetCornerPositions = [
        { x: rect.left - borderWidth - offset.x, y: rect.top - borderWidth - offset.y },
        { x: rect.right + borderWidth - cornerSize - offset.x, y: rect.top - borderWidth - offset.y },
        { x: rect.right + borderWidth - cornerSize - offset.x, y: rect.bottom + borderWidth - cornerSize - offset.y },
        { x: rect.left - borderWidth - offset.x, y: rect.bottom + borderWidth - cornerSize - offset.y }
      ];
    }

    _onResize() {
      this.containingBlock = this._getContainingBlock(this.cursorElement);
    }

    _onClick(e) {
      if (!this.isEnabled) return;
      const target = e.target;
      if (!target || this.hostElement?.contains(target)) return;
      if (target.closest && (target.closest('#lobnho-inspector-host') || target.closest('#lobnho-target-cursor-host'))) return;

      e.preventDefault();
      e.stopPropagation();

      logger.info('Element selected by Target Cursor', target);
      if (typeof this.options.onSelect === 'function') {
        this.options.onSelect(target);
      }
    }
  }

  global.LobnhoTargetCursor = LobnhoTargetCursor;
})(typeof window !== 'undefined' ? window : globalThis);
