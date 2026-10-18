import { shouldHandleLink } from '../../../router';
import { LightningElement, api } from 'lwc';

const VARIANT_CONSOLE = 'console';
// Room kept free so a tab never ends flush against the bar's edge.
const FIT_SLACK = 16;
// Width assumed for the More trigger until it has rendered once and been measured.
const MORE_WIDTH_GUESS = 96;

export default class GlobalNavigation extends LightningElement {
    @api currentPage = 'home';
    @api navItems = [];
    @api appItems = [];
    @api pagesInCurrentApp = [];
    @api variant = 'standard';
    @api hideWaffle = false;

    isWaffleMenuOpen = false;
    isObjectSwitcherOpen = false;
    isMoreOpen = false;
    // How many tabs fit the bar; the rest go into More. Starts with every tab shown so each
    // one renders once at its natural width and can be measured.
    visibleCount = Infinity;
    _tabWidths = new Map();
    _moreWidth = MORE_WIDTH_GUESS;

    get isConsole() {
        return this.variant === VARIANT_CONSOLE;
    }

    get isStandard() {
        return !this.isConsole;
    }

    /** Waffle app-launcher trigger is hidden when the vertical nav rail replaces it. */
    get showWaffle() {
        return !this.hideWaffle;
    }

    get contextBarClass() {
        return this.isConsole
            ? 'slds-context-bar slds-context-bar_tabs'
            : 'slds-context-bar';
    }

    get waffleDropdownTriggerClass() {
        const base = 'slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click slds-no-hover';
        return this.isWaffleMenuOpen ? `${base} slds-is-open` : base;
    }

    /** True when the "main" object-switcher tab is the focused tab (no transient tab active). */
    get isMainTabActive() {
        return true;
    }

    get mainTabAriaSelected() {
        return this.isMainTabActive ? 'true' : 'false';
    }

    get objectSwitcherTabClass() {
        const base = 'slds-context-bar__item slds-context-bar__object-switcher';
        return this.isMainTabActive ? `${base} slds-is-active` : base;
    }

    get objectSwitcherChevronClass() {
        const base = 'slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click slds-no-hover';
        return this.isObjectSwitcherOpen ? `${base} slds-is-open` : base;
    }

    /** App Launcher entries with selected-state derived from `current` flag. */
    get appItemsWithCurrent() {
        return (this.appItems || []).map((item) => ({
            ...item,
            ariaCurrent: item.isCurrent ? 'true' : null,
        }));
    }

    /** Label of the active app (shown next to the waffle in the context bar). */
    get currentAppLabel() {
        const current = (this.appItems || []).find((a) => a.isCurrent);
        return current?.label ?? '';
    }

    /** Currently selected page (Console object switcher trigger label). */
    get currentPageLabel() {
        const current = (this.pagesInCurrentApp || []).find((p) => p.isCurrent);
        return current?.label ?? 'Page Not Found';
    }

    /** Nav items with isActive and tabClass derived from currentPage (Standard variant). */
    get navItemsWithActive() {
        return (this.navItems || []).map((item) => {
            const isActive = item.page === this.currentPage;
            const base = 'slds-context-bar__item';
            return {
                ...item,
                isActive,
                tabClass: isActive ? `${base} slds-is-active` : base,
                ariaCurrent: isActive ? 'page' : null,
            };
        });
    }

    get visibleNavItems() {
        return this.navItemsWithActive.slice(0, this.visibleCount);
    }

    get overflowNavItems() {
        return this.navItemsWithActive.slice(this.visibleCount);
    }

    get hasOverflow() {
        return this.overflowNavItems.length > 0;
    }

    get isActiveInOverflow() {
        return this.overflowNavItems.some((item) => item.isActive);
    }

    get moreTriggerClass() {
        const classes = ['slds-context-bar__item', 'slds-context-bar__dropdown-trigger', 'slds-dropdown-trigger',
            'slds-dropdown-trigger_click'];
        if (this.isMoreOpen) classes.push('slds-is-open');
        if (this.isActiveInOverflow) classes.push('slds-is-active');
        return classes.join(' ');
    }

    get moreAriaExpanded() {
        return String(this.isMoreOpen);
    }

    handleMoreToggle(event) {
        event.stopPropagation();
        this.isMoreOpen = !this.isMoreOpen;
        if (this.isMoreOpen) {
            this.isWaffleMenuOpen = false;
            this.isObjectSwitcherOpen = false;
        }
    }

    handleMoreKeydown(event) {
        if (event.key === 'Escape' && this.isMoreOpen) {
            event.preventDefault();
            this.isMoreOpen = false;
            this.template.querySelector('.more-button')?.focus();
        }
    }

    // Close More once focus leaves it, so tabbing past the list doesn't leave it hanging open.
    handleMoreFocusOut(event) {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            this.isMoreOpen = false;
        }
    }

    handleOverflowItemClick(event) {
        this.isMoreOpen = false;
        this.handleNavItemClick(event);
    }

    handleNavItemClick(event) {
        if (!shouldHandleLink(event)) return;
        event.preventDefault();
        const page = event.currentTarget.dataset.page;
        this._dispatchNavigate(page);
    }

    handleWaffleOpen(event) {
        // Stop the click from immediately bubbling to the document handler that closes the menu.
        event?.stopPropagation?.();
        const wasOpen = this.isWaffleMenuOpen;
        this.isWaffleMenuOpen = !this.isWaffleMenuOpen;
        if (this.isWaffleMenuOpen) {
            this.isObjectSwitcherOpen = false;
            this.isMoreOpen = false;
        }
        if (!wasOpen && this.isWaffleMenuOpen) {
            this._focusOnNextRender = 'waffle';
        }
    }

    handleWaffleMenuItemClick(event) {
        if (!shouldHandleLink(event)) return;
        event.preventDefault();
        this.isWaffleMenuOpen = false;
        const appId = event.currentTarget.dataset.value;
        this.dispatchEvent(
            new CustomEvent('appswitch', {
                detail: { app: appId },
                bubbles: true,
                composed: true,
            })
        );
    }

    handleObjectSwitcherToggle(event) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const wasOpen = this.isObjectSwitcherOpen;
        this.isObjectSwitcherOpen = !this.isObjectSwitcherOpen;
        if (this.isObjectSwitcherOpen) {
            this.isWaffleMenuOpen = false;
        }
        if (!wasOpen && this.isObjectSwitcherOpen) {
            this._focusOnNextRender = 'object';
        }
    }

    /**
     * Listens for `privateselect` bubbled up from `lightning-menu-item` children.
     * `lightning-menu-item` dispatches this with `bubbles: true` whenever the item
     * is activated by click or Space; we don't need a separate click handler.
     */
    handleObjectSwitcherSelect(event) {
        const page = event.detail?.value;
        if (!page) return;
        this.isObjectSwitcherOpen = false;
        this._dispatchNavigate(page);
    }

    handleWaffleMenuKeydown(event) {
        const menu = this._waffleMenuElement();
        if (!menu || !menu.contains(event.target)) return;

        const key = event.key;
        if (key === 'Escape') {
            event.preventDefault();
            this.isWaffleMenuOpen = false;
            setTimeout(() => this._focusWaffleTrigger(), 0);
            return;
        }
        if (key === 'Tab') {
            this.isWaffleMenuOpen = false;
            return;
        }
        if (key === 'ArrowDown' || key === 'ArrowUp') {
            event.preventDefault();
            const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
            const currentIndex = items.indexOf(event.target);
            if (currentIndex === -1) return;
            const nextIndex = key === 'ArrowDown'
                ? (currentIndex < items.length - 1 ? currentIndex + 1 : 0)
                : (currentIndex > 0 ? currentIndex - 1 : items.length - 1);
            items[nextIndex].focus();
        }
    }

    handleObjectSwitcherKeydown(event) {
        const key = event.key;
        if (key === 'Escape') {
            event.preventDefault();
            this.isObjectSwitcherOpen = false;
            setTimeout(() => this._focusObjectSwitcherTrigger(), 0);
            return;
        }
        if (key === 'Tab') {
            this.isObjectSwitcherOpen = false;
            return;
        }
        if (key === 'ArrowDown' || key === 'ArrowUp') {
            event.preventDefault();
            const items = this._objectSwitcherMenuItems();
            if (!items.length) return;
            // Items live in their own shadow root; match against the host element.
            const currentHost = event.target.closest('lightning-menu-item');
            const currentIndex = currentHost ? items.indexOf(currentHost) : -1;
            const nextIndex = key === 'ArrowDown'
                ? (currentIndex < items.length - 1 ? currentIndex + 1 : 0)
                : (currentIndex > 0 ? currentIndex - 1 : items.length - 1);
            items[nextIndex]?.focus();
        }
    }

    _waffleMenuElement() {
        return this.template.querySelector(
            '.slds-context-bar__primary > .slds-no-hover .slds-dropdown'
        );
    }

    _objectSwitcherMenuItems() {
        return Array.from(
            this.template.querySelectorAll(
                '.slds-context-bar__dropdown-trigger lightning-menu-item'
            )
        );
    }

    _focusWaffleTrigger() {
        const trigger = this.template.querySelector(
            '.slds-context-bar__primary > .slds-no-hover .slds-context-bar__icon-action lightning-dynamic-icon'
        );
        if (trigger?.focus) trigger.focus();
    }

    _focusObjectSwitcherTrigger() {
        const trigger = this.template.querySelector(
            '.slds-context-bar__dropdown-trigger lightning-button-icon'
        );
        if (trigger?.focus) trigger.focus();
    }

    _dispatchNavigate(page) {
        if (!page) return;
        this.dispatchEvent(
            new CustomEvent('navigate', {
                detail: { page },
                bubbles: true,
                composed: true,
            })
        );
    }

    connectedCallback() {
        this._handleDocumentClickBound = this._handleDocumentClick.bind(this);
        document.addEventListener('click', this._handleDocumentClickBound);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this._handleDocumentClickBound);
        this._resizeObserver?.disconnect();
        this._resizeObserver = undefined;
    }

    renderedCallback() {
        this._measureTabs();
        if (!this._focusOnNextRender) return;
        const target = this._focusOnNextRender;
        this._focusOnNextRender = null;
        if (target === 'waffle') {
            const first = this._waffleMenuElement()?.querySelector('[role="menuitem"]');
            if (first) setTimeout(() => first.focus(), 0);
        } else if (target === 'object') {
            const items = this._objectSwitcherMenuItems();
            if (items[0]) setTimeout(() => items[0].focus(), 0);
        }
    }

    // Tab widths are cached the first time each tab renders, so refitting on resize is
    // arithmetic only and never re-renders tabs just to measure them.
    _measureTabs() {
        if (!this.isStandard) return;
        const primary = this.template.querySelector('.slds-context-bar__primary');
        this.template.querySelectorAll('li[data-page]').forEach((li) => {
            if (!this._tabWidths.has(li.dataset.page)) {
                this._tabWidths.set(li.dataset.page, li.getBoundingClientRect().width);
                this._measuredPrimaryWidth = primary?.offsetWidth;
            }
        });
        const more = this.template.querySelector('li[data-more]');
        if (more) this._moreWidth = more.getBoundingClientRect().width;

        const items = this.navItems || [];
        if (items.some((item) => !this._tabWidths.has(item.page))) {
            // A new tab hasn't been measured yet: show them all for one render.
            if (this.visibleCount !== Infinity) this.visibleCount = Infinity;
            return;
        }
        if (!this._resizeObserver && typeof ResizeObserver !== 'undefined') {
            const bar = this.template.querySelector('.slds-context-bar');
            if (bar) {
                this._resizeObserver = new ResizeObserver(() => this._fitTabs());
                this._resizeObserver.observe(bar);
                this._resizeObserver.observe(primary);
            }
        }
        this._fitTabs();
    }

    // Forget the cached widths and show every tab for one render so each is measured afresh.
    _remeasure() {
        this._tabWidths.clear();
        if (this.visibleCount === Infinity) {
            this._measureTabs();
        } else {
            this.visibleCount = Infinity;
        }
    }

    _fitTabs() {
        const bar = this.template.querySelector('.slds-context-bar');
        const primary = this.template.querySelector('.slds-context-bar__primary');
        if (!bar || !primary) return;
        // The primary block's width depends only on styles and fonts. If it has changed since
        // the tabs were measured (the first render can come before the stylesheet applies, when
        // every tab measures as a full-width block), those widths are stale.
        if (primary.offsetWidth !== this._measuredPrimaryWidth) {
            this._remeasure();
            return;
        }
        const widths = (this.navItems || []).map((item) => this._tabWidths.get(item.page));
        if (widths.some((w) => w === undefined)) return;

        // The primary block's width doesn't depend on the tabs, so this can't feed back into itself.
        // On a very narrow bar the tab strip wraps below the app name and gets the full width.
        const secondary = this.template.querySelector('.slds-context-bar__secondary');
        const wrapped = secondary && secondary.offsetTop > primary.offsetTop;
        const available = bar.clientWidth - (wrapped ? 0 : primary.offsetWidth) - FIT_SLACK;
        let count = widths.length;
        if (widths.reduce((sum, w) => sum + w, 0) > available) {
            let used = this._moreWidth;
            count = 0;
            while (count < widths.length && used + widths[count] <= available) {
                used += widths[count];
                count += 1;
            }
        }
        if (count !== this.visibleCount) this.visibleCount = count;
        if (count >= widths.length && this.isMoreOpen) this.isMoreOpen = false;
    }

    _handleDocumentClick(event) {
        const path = event.composedPath ? event.composedPath() : [];
        if (this.isMoreOpen) {
            const more = this.template.querySelector('li[data-more]');
            if (more && !path.includes(more)) {
                this.isMoreOpen = false;
            }
        }
        if (!this.isWaffleMenuOpen && !this.isObjectSwitcherOpen) return;

        if (this.isWaffleMenuOpen) {
            const waffle = this.template.querySelector('.slds-context-bar__primary > .slds-no-hover');
            if (waffle && !path.includes(waffle)) {
                this.isWaffleMenuOpen = false;
            }
        }
        if (this.isObjectSwitcherOpen) {
            const chevron = this.template.querySelector('.slds-context-bar__dropdown-trigger');
            if (chevron && !path.includes(chevron)) {
                this.isObjectSwitcherOpen = false;
            }
        }
    }
}
