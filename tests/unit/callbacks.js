module("Callbacks");

/**
 * Trigger callbacks
 */

test("Trigger/Change", function() {
  expect(1);

  var $form = $("#testForm1").autosave({
    callbacks: {
      trigger: "change",
      save: function() {
        ok(true, "Trigger 'change' fired successfully");
      }
    }
  });

  $form.find(":input[type=text]").val("test").change();
});

asyncTest("Trigger/Interval", function() {
  expect(1);

  var $form = $("#testForm1").autosave({
    callbacks: {
      trigger: {
        method: "interval",
        options: {
          interval: 10
        }
      },
      condition: function(options, $input, formData, caller) {
        equal(caller, this.timer, "Trigger 'interval' fired successfully");

        this.stopInterval();
        start();

        return false;
      }
    }
  });
});

/**
 * Scope callbacks
 */

test("Scope/All", function() {
  expect(1);

  var $form = $("#testForm1").autosave({
    callbacks: {
      scope: "all",
      condition: function(options, $inputs) {
        equal($inputs.length, this.validInputs().length, "Using all valid inputs");

        return false;
      }
    }
  });

  $form.find(":input[type=text]").val("test").change();
});

test("Scope/Changed", function() {
  expect(2);

  var $form = $("#testForm1").autosave({
    callbacks: {
      scope: "changed",
      condition: function(options, $inputs) {
        equal($inputs.length, 1, "One changed input");
        equal($inputs[0].name, "text", "Changed input's name is 'text'");

        return false;
      }
    }
  });

  $form.find(":input[type=text]").val("test").change();
});

/**
 * Data callbacks
 */

test("Data/SerializeArray", function() {
  expect(1);

  var $form = $("#testForm1").autosave({
    callbacks: {
      scope: "changed",
      condition: function(options, $fields, formData) {
        var data = [{ name: "text", value: "test" }];

        deepEqual(formData, data, "SerializeArray data matches correctly");

        return false;
      }
    }
  });

  $form.find(":input[type=text]").val("test").change();
});

test("Data/SerializeObject", function() {
  expect(1);

  var $form = $("#testForm1").autosave({
    callbacks: {
      scope: "changed",
      data: "serializeObject",
      condition: function(options, $fields, formData) {
        var data = { text: "test" };

        deepEqual(formData, data, "SerializeObject data matches correctly");

        return false;
      }
    }
  });

  $form.find(":input[type=text]").val("test").change();
});

/**
 * Condition callbacks
 */

test("Condition/Changed", function() {
  expect(1);

  var $form = $("#testForm1").autosave({
    callbacks: {
      condition: "changed",
      save: function() {
        ok(true, "Only save if there is changed data");
      }
    }
  });

  $form.find(":input[name=save]").click();
  $form.find(":input[type=text]").val("test").change();
});

/**
 * Save callbacks
 */

asyncTest("Save/AJAX", function() {
  expect(1);

  var $form = $("#testForm1").autosave({
    callbacks: {
      save: {
        method: "ajax",
        options: {
          complete: function() {
            ok(true, "AJAX save completed successfully");
            start();
          }
        }
      }
    }
  });

  $form.find(":input[type=text]").val("test").change();
});
