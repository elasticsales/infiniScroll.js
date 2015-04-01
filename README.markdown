# infiniScroll.js

infiniScroll.js is a Backbone.js module to add infinite scrolling to your backbone views. Simply create an `InfiniScroll` object passing the desired collection and success callback.

This is a heavily modified fork of [joneath/infiniScroll.js](https://github.com/joneath/infiniScroll.js).

## Usage
###Backbone.InfiniScroll(collection, options)

Instantiate a new `InfiniScroll` object after your Backbone view has been rendered.

    myView = Backbone.View.extend({
      initialize: function(){
        this.infiniScroll = new Backbone.InfiniScroll(this.collection, {success: this.appendRender});
      },
      remove: function() {
        this.infiniScroll.destroy();
        return Backbone.View.prototype.remove.call(this);
      }
    )};

### methods

* `destroy()` - Removes target scroll binding. Call this when you're removing the view.
* `enableFetch()` - Enables infiniScroll
* `disableFetch()` - Disables infiniScroll

### Options
    options = {
      contentEl: $('.my-list'),
      extraParams: {},
      pageSizeParam: "page_size",
      pageSize: collection.length,
      scrollOffset: 100,
      includePage: false
    }

* `contentEl` - Element where the content is going. We detect the position of this element and automatically find it's scroll parent to listen to.
* `extraParams` - extra GET params used when `collection.fetch` is called
* `untilAttr` - The GET param attribute used when `collection.fetch` is called. Finds last record in collection and uses this param as key. Can be a function name on the model, which can be used as a computed property.
* `pageSize` - Used internally to determine when fetching of pages is completed.
* `pageSizeParam` - GET param used to send page size when `collection.fetch` is called.
* `scrollOffset` - Pixel count from bottom of page to offset the scroll for when to trigger `collection.fetch`

And see the code for more.
