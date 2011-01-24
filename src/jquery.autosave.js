/**
 * @fileOverview jQuery.autosave
 * Unobtrusively saves form data based on certain conditions
 *
 * @author Mads Erik Forberg, Raymond Julin, Kyle Florence
 * @website https://github.com/nervetattoo/jquery-autosave
 * @version 1.0.0
 *
 * Dual licensed under the MIT and BSD Licenses.
 */

;(function($, undefined) {
  /**
   * Creates and attaches an instance of jQuery.autosave to elements.
   *
   * @param {Object} [options]
   *    User supplied options to override the defaults within the plugin.
   *
   * @returns {jQuery}
   *    The elements that invoked this function.
   */
  $.fn.autosave = function(options) {
    var $elements = this, instance = $.extend({}, $.autosave);

    instance.initialize($elements.filter(function() {
      return (this.elements || this.form);
    }).data("autosave", instance), options);

    return this;
  }

  /**
   * @class The jQuery.autosave class.
   */
  $.autosave = {
    /**
     * @namespace The default options for this plugin.
     */
    options: {
      conditions: [],
      events: {
        changed: "changed"
      },
      filters: [],
      methods: ["ajax"],
      triggers: ["changed"]
    },

    /**
     * Initializes the plugin.
     *
     * @param {jQuery} $elements
     *    The set of jQuery objects that this plugin was called with.
     * @param {Object} [options]
     *    User supplied options to merge with the defaults.
     */
    initialize: function($elements, options) {
      var self = this;

      $.extend(true, this.options, options);
      $.extend(this, {
        timer: 0,
        changed: [],
        $queue: $({}),
        $elements: $elements,
        $forms: this.getForms($elements),
        $fields: this.getFields($elements)
      });

      // Bind to each form field and listen for changes
      this.$fields.each(function() {
        // For IE bug fixes, see: https://gist.github.com/770449
        var eventType = (this.type == "checkbox" ||
          this.tagName.toLowerCase() == "select" && this.multiple)
          && ("onpropertychange" in document.body) ? "propertychange" : "change";

        $(this).bind(eventType, function(e) {
          if (e.type == "change" || (e.type == "propertychange"
            && /^(checked|selectedIndex)$/.test(window.event.propertyName))) {
            self.changed.push(this);

            // Fire an event for the form containing the field.
            $(this.form).triggerHandler(self.events.changed, [this]);
          }
        });
      });

      // Which options use the callback-style syntax
      var callbackOptions = ["triggers", "fields", "conditions", "methods"];

      // Parse each callback array and extract the methods
      $.each(callbackOptions, function(i, name) {
        var callbacks = self.options[name], validCallbacks = [];

        // Callbacks should be an array of strings, functions or objects
        if ($.isArray(callbacks) && callbacks.length) {
          $.each(callbacks, function(i, callback) {
            callback = self.getCallback(callback, self._callbacks[name]);

            // If callback has a valid method, we can use it
            if ($.isFunction(callback.method)) validCallbacks.push(callback);
          });
        }

        self.options[name] = validCallbacks;
      });

      // Set up save triggers
      $.each(this.options.triggers, function(i, callback) {
        callback.method.call(self, callback.options);
      });
    },

    /**
     * Get the form fields associated with elements.
     *
     * @param {jQuery|Element|Element[]} [elements]
     *    The elements to extract form fields from. Can be of type jQuery
     *    or an array of DOM elements. If no elements are passed, the form
     *    fields passed to the plugin on initialization will be used.
     *
     * @returns {jQuery}
     *    A jQuery object containing the form fields.
     */
    getFields: function(elements) {
      var $elements = elements ? $(elements) : this.$elements;

      // Extract inputs from form elements
      return $elements.map(function() {
        return this.elements ? $.makeArray(this.elements) : this;
      });
    },

    /**
     * Get the forms associated with elements.
     *
     * @param {jQuery|Element|Element[]} [elements]
     *    The elements to extract form fields from. Can be of type jQuery
     *    or an array of DOM elements. If no elements are passed, the form
     *    fields passed to the plugin on initialization will be used.
     *
     * @returns {jQuery}
     *    A jQuery object containing the forms.
     */
    getForms: function(elements) {
      var $elements = elements ? $(elements) : this.$elements;

      // Weed out duplicates
      return $($.unique($elements.map(function() {
        return this.elements ? this : this.form;
      }).get()));
    },

    /**
     * Get a callback method from a list of methods.
     *
     * @param {String|Object|function} method
     *    The method to get. Can be a string or object that represents one of
     *    the built in callback methods, or a custom function to use instead.
     *
     * @param {Object} methods
     *    An object containing the list of methods to search in.
     *
     * @returns {Object}
     *    The callback object. This will be an empty object if the callback
     *    could not be found. If it was found, this object will contain at the
     *    very least a "method" property and potentially an "options" property.
     */
    getCallback: function(method, methods) {
      var callback = {}, methodType = typeof method;

      if (methodType === "function") {
        // Custom function with no options
        callback.method = method;
      } else if (methodType === "string" && method in methods) {
        // Built in method, use default options
        callback = methods[method];
      } else if (methodType === "object") {
        callback = method, methodType = typeof callback.method;

        if (methodType === "string" && callback.method in methods) {
          // Built in method
          callback = methods[callback.method];

          if (typeof method.options === "object") {
            // Merge in user supplied options with the defaults
            callback.options = $.extend(true, {}, callback.options, method.options);
          } else {
            // Set options up as an empty object if none are found
            callback.options = {};
          }
        }
      }

      return callback;
    },

    /**
     * Starts an autosave interval loop, stopping the current one if needed.
     *
     * @param {number} interval
     *    An integer value representing the time between intervals in
     *    milliseconds.
     */
    startInterval: function(interval) {
        var self = this;

        interval = interval || this.interval;

        // If there is a timer running, stop it
        if (this.timer) this.stopInterval();

        // Make sure we have a valid interval
        if (!isNaN(parseInt(interval))) {
          this.timer = setTimeout(function() {
            self.save(undefined, self.timer);
          }, interval);
        }
    },

    /**
     * Stops an autosave interval loop.
     */
    stopInterval: function() {
      clearTimeout(this.timer);
      this.timer = undefined;
    },

    /**
     * Attemps to save form field data.
     *
     * @param {jQuery|Element|Element[]} [fields]
     *    The form fields to extract data from. Can be of type jQuery, a DOM
     *    element, or an array of DOM elements. If no fields are passed, the
     *    fields passed to the plugin on initialization will be used.
     *
     * @param {mixed} [caller]
     *    Used to denote who called this function. If passed, it is typically
     *    the ID of the current interval timer and may be used to check if the
     *    timer called this function.
     */
    save: function(fields, caller) {
      var self = this, $fields = fields ? this.getFields(fields) : this.$fields;

      // If there are no save methods defined, we can't save
      if (this.options.methods.length) {
        // Filter the scope of fields
        $.each(this.options.filters, function(i, callback) {
          $fields = callback.method.call(self, callback.options, $fields);
        });

        if ($fields.length) {
          var proceed = true, data = $fields.serializeArray();

          // Loop through pre-save conditions and proceed only if they pass
          $.each(this.options.conditions, function(i, callback) {
            return (proceed = callback.method.call(
              self, callback.options, $fields, data, caller
            )) !== false;
          });

          if (proceed) {
            // Add all of our save methods to the queue
            $.each(this.options.methods, function(i, callback) {
              self.$queue.queue("saveMethods", function() {
                // Methods that return false should handle the call to complete()
                if (callback.method.call(self, callback.options, data) !== false) {
                  self.complete();
                }
              });
            });
          }
        }
      }

      // Start the dequeue process
      this.complete();
    },

    /**
     * Called whenever a save method completes; performs necessary cleanup.
     */
    complete: function() {
      var queue = this.$queue.queue("saveMethods");

      // Dequeue the next function if queue is not empty
      if (queue && queue.length) this.$queue.dequeue("saveMethods");

      // Queue does not exist or is empty, proceed to cleanup
      else if (!queue || !queue.length) {
        this.changed = [];

        // If there is a timer running, start the next interval
        if (this.timer) this.startInterval();
      }
    },

    /**
     * @namespace Holds all of the built in callback methods.
     */
    _callbacks: {
      /**
       * @namespace Holds the callback objects for triggering an autosave.
       */
      triggers: {
        change: {
          /**
           * Binds the "valueChanged" event to all of the forms autosave is
           * attached to and attempts to save any time that event is fired.
           */
          method: function() {
            var self = this;

            this.$forms.bind(self.events.changed, function(e, field) {
              self.save(field);
            });
          }
        },
        event: {
          /**
           * Attaches an arbitrary event to all of the forms autosave is
           * attached to and attempts to save any time that event is fired.
           */
          method: function(options) {
            var self = this;

            if (typeof options.eventName === "string") {
              this.$forms.bind(options.eventName, function() {
                self.save(this, options.eventName);
              });
            }
          },
          options: {
            eventName: "autosave"
          }
        },
        interval: {
          /**
           * Creates an interval loop that will attempt to save periodically.
           */
          method: function(options) {
            if (!isNaN(parseInt(options.interval))) {
              this.startInterval(this.interval = options.interval);
            }
          },
          options: {
            interval: 30000
          }
        }
      },

      /**
       * @namespace Holds the callback objects for filtering fields for the dataset.
       */
      filters: {
        changed: {
          /**
           * Changes the scope of fields to only those whose value has changed
           * since the last autosave.
           */
          method: function() {
            return this.getFields(this.changed);
          }
        }
      },

      /**
       * @namespace Holds the callback objects for pre-save conditions.
       */
      conditions: {
        /**
         * Only save if the interval called the save method
         */
        interval: {
          method: function($fields, data, caller) {
            return (!this.timer || this.timer === context);
          }
        },
        /**
         * Only save if at least one of the field values has changed
         */
        changed: {
          method: function($fields, data, caller) {
            return (this.changed.length > 0);
          }
      },

      /**
       * @namespace Holds the callback objects for the different saving methods.
       */
      methods: {
        /**
         * Saves form field data using a jQuery.ajax call. Any options that can
         * be passed to the jQuery.ajax method are valid here.
         */
        ajax: {
          method: function(options, data) {
            var self = this;

            $.ajax($.extend(true, {}, options, {
              data: data,
              complete: function(xhr, status) {
                if ($.isFunction(options.complete)) {
                  // Call user-provided complete function first
                  options.complete.apply(self, arguments);
                }

                // We are done now, cleanup
                self.complete();
              }
            }));

            // Don't call this.complete() yet
            return false;
          },
          options: {
            url: window.location.href,
            method: "POST"
          }
        }
      }
    }
  }
})(jQuery);