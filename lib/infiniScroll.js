(function() {
  'use strict';

  // https://github.com/slindberg/jquery-scrollparent/blob/master/jquery.scrollparent.js
  if (!jQuery.fn.scrollParent) {
    jQuery.fn.scrollParent = function() {
    var overflowRegex = /(auto|scroll)/,
    position = this.css( "position" ),
    excludeStaticParent = position === "absolute",
    scrollParent = this.parents().filter( function() {
      var parent = $( this );
      if ( excludeStaticParent && parent.css( "position" ) === "static" ) {
        return false;
      }
      return (overflowRegex).test( parent.css( "overflow" ) + parent.css( "overflow-y" ) + parent.css( "overflow-x" ) );
    }).eq( 0 );

    return position === "fixed" || !scrollParent.length ? $( this[ 0 ].ownerDocument || document ) : scrollParent;
    };
  }

  Backbone.InfiniScroll = function(collection, options) {
    this.collection = collection;

    this.options = _.defaults(options || {}, {

      // Element populated with collection items. Must already be in DOM.
      // We look to see if the bottom of this element is in the scroll view (or close to it).
      contentEl: $(window),

      // name of GET parameters
      pageSizeParam: '_limit',
      offsetParam: '_skip',
      pageParam: null,

      // extra GET params used when collection.fetch is called
      extraParams: {},
      getParams: function() {},

      // How many items should be fetched per page
      // Used internally to determine when fetching of pages is completed.
      pageSize: collection.length || 10,

      // Pixel count from bottom of page to offset the scroll for when to trigger collection.fetch
      scrollBuffer: 400,

      // If set, this is a function to determine whether or not to stop paging based on the current results
      // Ideally each response has a field like 'has_more' to indicate if there's another page.
      // Otherwise you could see if resp length < page size if responses should be constant.
      // Otherwise you could do an extra response and then return false here when length is 0.
      hasMoreFn: function(collection, resp, options) {
        return resp.has_more;
      }
    });

    this.initialize.apply(this, arguments);
  };

  _.extend(Backbone.InfiniScroll.prototype, Backbone.Events, {

    // flag to help us avoid checking scroll position when we know we've already
    // fetched enough objects to fill the viewport.
    // flag to make sure we only have one infiniscroll ajax request out at a time
    // different than fetchEnabled because fetchEnabled must be reset true ANY time a sync happens
    pendingXhr: null,

    $scrollEl: null,
    scrollElHeight: null,
    $contentEl: null,

    page: null,

    prevScrollY: null,

    // Should we fetch results when user scrolls to the bottom of the page?
    fetchEnabled: null,

    initialize: function() {
      _.bindAll(this, 'onScroll', 'onResize', 'fetchSuccess');
      this.$contentEl = $(this.options.contentEl);
      if (!this.$contentEl.length || !jQuery.contains(document.documentElement, this.$contentEl[0])) {
        //throw new Error('contentEl must already be in DOM');
        console.warn('infiniScroll initialized with contentEl not in DOM');
        return;
      }
      var scrollParent = this.$contentEl.scrollParent();
      this.setScrollEl(scrollParent.is(document) ? $(window) : scrollParent);
      this.reset();
      this.listenTo(this.collection, 'reset', this.reset);
      this.listenTo(this.collection, 'sync', this.onSync);
      $(window).on('resize', this.onResize);
    },

    setScrollEl: function(el) {
      if (!el) {
          console.warn('setScrollEl got null');
          return;
      }
      if (this.$scrollEl) this.$scrollEl.off('scroll', this.onScroll);
      this.$scrollEl = el;
      this.scrollElHeight = this.$scrollEl.height();
      this.$scrollEl.on('scroll', this.onScroll);
    },

    reset: function() {
      this.page = 1;
      this.prevScrollY = 0;
      this.pendingXhr = false;
      this.enableFetch();
    },

    destroy: function() {
      this.$contentEl = null;
      if (this.$scrollEl) {
          this.$scrollEl.off('scroll', this.onScroll);
          this.$scrollEl = null;
      }
      this.stopListening(this.collection);
      $(window).off('resize', this.onResize);
    },

    onResize: _.debounce(function() {
      this.prevScrollY = 0;
      this.scrollElHeight = this.$scrollEl.height();
      this.onScroll();
    }, 300),

    enableFetch: function() {
      this.fetchEnabled = true;
    },

    disableFetch: function() {
      //console.log('disabling fetch');
      this.fetchEnabled = false;
    },

    // return true if the bottom of contentEl is not more than 'scrollBuffer' px
    // below the bottom of the scrollEl viewport.
    // Includes both cases:
    // 1) content is too short to fill scrollEl viewport
    // 2) content extends beyond scrollEl viewport and scroll has reached near the end of the content
    needsMoreContent: function() {
      if (!this.$contentEl || !this.$contentEl.length) return;
      var contentEl = this.$contentEl[0];
      var bottomOfContent = contentEl.offsetTop + contentEl.offsetHeight; // y pos inside scrollable
      var bottomOfScrollViewport = this.$scrollEl.scrollTop() + this.scrollElHeight; // y pos: how far scrolled + viewport height
      var needsMore = bottomOfContent < bottomOfScrollViewport + this.options.scrollBuffer;
      //console.log('bottomOfContent=%o, bottomOfScrollViewport=%o, combined=%o, needsMore=%o', bottomOfContent, bottomOfScrollViewport, bottomOfScrollViewport + this.options.scrollBuffer, needsMore);
      return needsMore;
    },

    onSync: function(obj, resp, options) {
      if (!(obj instanceof Backbone.Collection)) return; // only care about collection-level sync events

      if (!this.fetchEnabled) return;

      // If we know there's no more pages/items, stop fetching on scroll
      if (!this.options.hasMoreFn(obj, resp, options)) {
          this.disableFetch();
          return;
      }

      // Keep loading more content until the viewport is full
      // use setTieout so pendingXhr has a chance to clear
      setTimeout(_.bind(function() {
          if (!this.pendingXhr && this.needsMoreContent()) {
              this.fetch();
          }
      }, this), 1);
    },

    fetchSuccess: function(collection, response) {
      this.page += 1;
      // TODO trigger event?
    },

    onScroll: function() {
      if (this.pendingXhr || !this.fetchEnabled) return;

      // pixels from top of scrollable content to bottom edge of visible/scrolled content
      var scrollY = this.$scrollEl.scrollTop() + this.scrollElHeight;

      // If we're not scrolling beyond where we were already, don't do anything
      var scrollingDown = this.prevScrollY <= scrollY;
      //console.log('prev=%o, now=%o, down=%o', this.prevScrollY, scrollY, scrollingDown);
      if (!scrollingDown) return;

      this.prevScrollY = scrollY;

      var $contentEl = this.$contentEl;

      if (this.needsMoreContent()) this.fetch();
    },

    fetch: function() {
      var data = _.extend(this.getPaginationParams(), this.options.extraParams, this.options.getParams());
      //console.log('fetching', data);
      this.pendingXhr = this.collection.fetch({
        success: this.fetchSuccess,
        remove: false,
        data: data
      }).always(_(function() {
          this.pendingXhr = false;
      }).bind(this));
    },

    getPaginationParams: function() {
      var params = {};

      if (this.options.pageSizeParam) {
        params[this.options.pageSizeParam] = this.options.pageSize
      }

      if (this.options.pageParam) {
        params[this.options.pageParam] = this.page + 1;
      }

      if (this.options.offsetParam) {
        params[this.options.offsetParam] = this.page * this.options.pageSize;
      }

      return params;
    }

  });

  return Backbone.InfiniScroll;
})();
