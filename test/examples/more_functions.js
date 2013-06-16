{
  simple: function () { return 'some string'; },
  object: function () { return { value: 'string in an object' }; },
  simpleWithCb: function (cb) { cb(null, 'some string by callback'); },
  objectWithCb: function (cb) { cb(null, { value: 'string in an object by callback' }); },
  replaceSection: function (body, cb) { cb(null, body.toUpperCase()); },
  objectInArray: [function () { return { value: 'object in array' }; }],
  objectWithCbInArray: [function (cb) { cb(null, { value: 'object by callback in array' }); }]
}
