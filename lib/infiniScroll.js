// Created by Jonathan Eatherly, (https://github.com/joneath)
// MIT license
// Version 0.3+

(function() {
  Backbone.InfiniScroll = function(collection, options) {
    options = options || { };

    var self = {},
        $target,
        $binder,
        fetchOn,
        page,
        prevScrollY = 0;
 
    // flag to make sure we only have one infiniscroll ajax request out at a time
    // different than fetchOn because fetchOn must be reset true ANY time a sync happens
    var pendingXhr;

    self.collection = collection;
    self.options = _.defaults(options, {
      // Success callback function called when collection.fetch is successful
      success: function() {},

      // Error callback function called when collection.fetch raises error
      error: function() {},

      onFetch: function() {},

      // Target element populated with collection items. Change this if you have an internal scrolling element to infinite scroll.
      // We look to see if the bottom of this element is in the scroll view.
      // Pass a jQuery element or selector string (in case the obj doesn't exist in the DOM at initialization)
      target: $(window),

      // Binder is element to watch scroll - the element with "overflow" set.
      // Change this if you have an internal scrolling element to infinite scroll.
      binder: $(window),

      // GET param used to send page size when collection.fetch is called.
      pageSizeParam: 'page_size',

      // Used internally to determine when fetching of pages is completed.
      pageSize: collection.length || 25,

      includePageSize: true,
      offsetParam: 'offset',
      includeOffset: false,
      pageParam: 'page',

      // GET param used when collection.fetch is called
      param: 'until',

      // The GET param attribute used when collection.fetch is called. Finds last record in collection and uses
      // this param as key. Can be a function name on the model, which can be used as a computed property.
      untilAttr: 'id',

      includeUntil: true,

      // Pixel count from bottom of page to offset the scroll for when to trigger collection.fetch
      scrollOffset: 100,

      // Passed to collection fetch to add new records to the collection without removing existing ones
      remove: false,

      // Used to determine when to stop fetching. Setting strict on will fetch until the response size
      // is less than the page size (This can save one extra request being made to the server, but requires
      // the response size to be consistent). Setting strict off will fetch until the response length is
      // equal to 0 (better for varying page size responses).
      strict: false,

      // Boolean to include the next page in the query params eg. "&page=2".
      includePage: false,

      // extra GET params used when collection.fetch is called
      extraParams: {}
    });

    var initialize = function() {
      $binder = $(self.options.binder);
      self.reset();
      $binder.on('scroll', self.watchScroll);
      self.collection.on('reset', self.reset);
      self.collection.on('sync', self.onSync);
    };

    self.reset = function() {
      page = 1;
      prevScrollY = 0;
      pendingXhr = false;
      self.enableFetch();
    },

    self.destroy = function() {
      $binder.off('scroll', self.watchScroll);
      self.collection.off('reset', self.reset);
      self.collection.off('sync', self.onSync);
    };

    self.enableFetch = function() {
      fetchOn = true;
    };

    self.disableFetch = function() {
      fetchOn = false;
    };

    self.onFetch = function() {
      self.options.onFetch();
    };

    self.onSync = function(obj, resp, options) {
      if (!(obj instanceof Backbone.Collection)) return; // only care about collection-level sync events

      // for strict mode, we want to enable fetch after a sync in case a full page of results were loaded
      // (for example the first page of results may be fetched outside of infiniscroll)
      // then the more strict condition checking will be done in watchScroll->checkDisable
      if (self.options.strict) {
        self.enableFetch();
      }
    };

    self.checkDisable = function() {
      if (self.options.strict && self.collection.length < page * self.options.pageSize) {
        self.disableFetch();
      }
    };

    self.fetchSuccess = function(collection, response) {
      pendingXhr = false;
      page += 1;
      // handle non-strict mode here. (strict mode is handled automatically in onSync)
      if (!self.options.strict) {
          if (response.length > 0) {
            self.enableFetch();
          } else {
            self.disableFetch();
          }
      }
      self.options.success(collection, response);
    };

    self.fetchError = function(collection, response) {
      self.enableFetch();

      self.options.error(collection, response);
    };

    self.watchScroll = function(e) {
      if (pendingXhr) return;
      self.checkDisable();
      if (!fetchOn) return;

      // do jquery lookup here in case the selector wasn't in the DOM during initialization
      $target = $(self.options.target);

      // pixels from top of document to bottom edge of visible scrolled content
      var scrollY = $binder.scrollTop() + $binder.height();

      var docHeight = $target.get(0).scrollHeight || $(document).height();

      if (scrollY >= docHeight - self.options.scrollOffset && prevScrollY <= scrollY) {
        var lastModel = self.collection.last();
        if (!lastModel) return;

        self.onFetch();
        self.disableFetch();
        pendingXhr = true;
        self.collection.fetch({
          success: self.fetchSuccess,
          error: self.fetchError,
          remove: self.options.remove,
          data: $.extend(buildQueryParams(lastModel), self.options.extraParams)
        });
      }
      prevScrollY = scrollY;
    };

    function buildQueryParams(model) {
      var params = {};

      if (self.options.includeUntil) {
        params[self.options.param] = typeof(model[self.options.untilAttr]) === 'function' ? model[self.options.untilAttr]() : model.get(self.options.untilAttr);
      }

      if (self.options.includePageSize) {
        params[self.options.pageSizeParam] = self.options.pageSize
      }

      if (self.options.includePage) {
        params[self.options.pageParam] = page + 1;
      }

      if (self.options.includeOffset) {
        params[self.options.offsetParam] = page * self.options.pageSize;
      }

      return params;
    }

    initialize();

    return self;
  };
})();
