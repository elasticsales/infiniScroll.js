// Created by Jonathan Eatherly, (https://github.com/joneath)
// MIT license
// Version 0.3

(function() {
  Backbone.InfiniScroll = function(collection, options) {
    options = options || { };

    var self = {},
        $target,
        fetchOn,
        page,
        prevScrollY = 0;

    self.collection = collection;
    self.options = _.defaults(options, {
      success: function(){ },
      error: function(){ },
      onFetch: function(){ },
      target: $(window),
      pageSizeParam: 'page_size',
      pageSize: collection.length || 25,
      includePageSize: true,
      offsetParam: 'offset',
      includeOffset: false,
      pageParam: 'page',
      param: 'until',
      untilAttr: 'id',
      includeUntil: true,
      scrollOffset: 100,
      remove: false,
      strict: false,
      includePage: false,
      extraParams: {}
    });

    var initialize = function() {
      $target = $(self.options.target);
      self.reset();
      $target.on('scroll', self.watchScroll);
      self.collection.on('reset', self.reset);
    };

    self.reset = function() {
      page = 1;
      prevScrollY = 0;
      self.enableFetch();
    },

    self.destroy = function() {
      $target.off('scroll', self.watchScroll);
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

    self.checkDisable = function() {
      if (self.options.strict && self.collection.length < page * self.options.pageSize) {
        self.disableFetch();
      }
    };

    self.fetchSuccess = function(collection, response) {
      page += 1;
      // no need to check the strict condition in detail here, it will be done in watchScroll->checkDisable
      if (self.options.strict || (!self.options.strict && response.length > 0)) {
        self.enableFetch();
      } else {
        self.disableFetch();
      }
      self.options.success(collection, response);
    };

    self.fetchError = function(collection, response) {
      self.enableFetch();

      self.options.error(collection, response);
    };

    self.watchScroll = function(e) {
      self.checkDisable();
      if (!fetchOn) return;

      var scrollY = $target.scrollTop() + $target.height();
      var docHeight = $target.get(0).scrollHeight || $(document).height();

      if (scrollY >= docHeight - self.options.scrollOffset && prevScrollY <= scrollY) {
        var lastModel = self.collection.last();
        if (!lastModel) return;

        self.onFetch();
        self.disableFetch();
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
