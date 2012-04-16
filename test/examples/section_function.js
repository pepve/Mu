{
  foo: function (text) {
    return text.toUpperCase();
  },
  bar: function (text, cb) {
    cb(text.replace('r', 'z'));
  },
  complex: function (text, cb) {
    var rendered = '';
    mu.renderText(text, this)
      .on('data', function (data) { rendered += data; })
      .on('end', function () { cb(rendered.replace('.', '!')); });
  },
  what: 'complex'
}
