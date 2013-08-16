var BUFFER_LENGTH = 1024 * 8;
var MAX_STACK_SIZE = 1000;

var parser = require('./parser');
var nextTick = (typeof setImmediate == 'function') ? setImmediate : process.nextTick;

exports.render = render;


function render(tokens, context, partials, stream, callback) {
  if (!Array.isArray(context)) {
    context = [context];
  }

  return _render(tokens, context, partials, stream, { stackSize: 0 }, callback);
}

function _render(tokens, context, partials, stream, stackSize, callback) {
  if (tokens[0] !== 'multi') {
    throw new Error('Mu - WTF did you give me? I expected mustache tokens.');
  }
  
  var i = 1;
  
  function next() {
    try {
    
      if (stream.paused) {
        stream.once('resumed', function () {
          nextTick(next);
        });
        return;
      }

      if (++stackSize.stackSize % MAX_STACK_SIZE == 0) {
        nextTick(next);
        return;
      }
    
      var token = tokens[i++];
    
      if (!token) {
        return callback ? callback() : true;
      }
    
      switch (token[0]) {
      case 'static':
        stream.emit('data', token[2]);
        return next();
    
      case 'mustache':    
        switch (token[1]) {
        case 'utag': // Unescaped Tag
          return normalize(context, token[2], null, function (err, res) {
            if (err) stream.emit('error', err);
            else stream.emit('data', s(res));
            next();
          });
        
        case 'etag': // Escaped Tag
          return normalize(context, token[2], null, function (err, res) {
            if (err) stream.emit('error', err);
            else stream.emit('data', escape(s(res)));
            next();
          });
      
        case 'section':
          return normalize(context, token[2], token[3], function (err, res, replace) {
            if (err) {
              stream.emit('error', err);
              next();
            } else if (replace) {
              stream.emit('data', s(res));
              next();
            } else if (res) {
              section(context, token[2], res, token[4], partials, stream, stackSize, next);
            } else {
              next();
            }
          });
        
        case 'inverted_section':
          return normalize(context, token[2], token[3], function (err, res) {
            if (err) {
              stream.emit('error', err);
              next();
            } else if (!res || res.length === 0) {
              section(context, token[2], true, token[4], partials, stream, stackSize, next);
            } else {
              next();
            }
          });
        
        case 'partial':
          var partial = partials[token[2]];
          // console.log(require('util').inspect(partials));
          if (partial) {
            return _render(partial[0].tokens, context, partials, stream, stackSize, next);
          } else {
            return next();
          }
        }
    
      }
    
    } catch (err) {
      stream.emit('error', err);
      next();
    }
  }
  
  next();
}

function s(val) {
  if (val === null || typeof val === 'undefined') {
    return '';
  } else {
    return val.toString();
  }
}

function escape(string) {
  return string.replace(/[&<>"]/g, escapeReplace);
}

function normalize(context, name, body, cb) {
  var val = walkToFind(context, name);
  
  if (typeof(val) === 'function') {
    if (val.length === 0) {
      cb(null, val.call(smashContext(context)));
    } else if (val.length === 1) {
      val.call(smashContext(context), cb);
    } else if (val.length === 2) {
      val.call(smashContext(context), body, function (err, res) {
        cb(err, res, true);
      });
    } else {
      cb(new Error('Mu - Only functions with 0, 1 or 2 arguments are supported.'));
    }
  } else {
    cb(null, val);
  }
}

function walkToFind(context, name) {
  var i = context.length;

  while (i--) {
    var result = contextLevelContains(context[i], name);

    if (result !== undefined) {
      return result;
    }
  }

  return undefined;
}

function contextLevelContains(context, fullPath) {
  var pathParts = fullPath.split('.');
  var obj = context;

  for (var i = 0; i < pathParts.length; i++) {
    var part = pathParts[i];

    if (typeof obj == 'object' && part in obj) {
      obj = obj[part];
    } else {
      obj = undefined;
      break;
    }
  }

  return obj;
}

// TODO: if Proxy, make more efficient
// TODO: cache?
function smashContext(context) {
  var obj = {};

  for (var i = 0; i < context.length; i++) {
    var level = context[i];

    if (level instanceof Date) {
      obj.__date = level;
    } else {
      for (var k in level) {
        obj[k] = level[k];
      }
    }
  }

  return obj;
}

function section(context, name, val, tokens, partials, stream, stackSize, callback) {
  if (val instanceof Array) {
    var i = 0;
    
    (function next() {
      function handleItem(error, item) {
        if (error) {
          stream.emit('error', error);
          callback();
        } else if (item) {
          context.push(item);
          _render(tokens, context, partials, stream, stackSize, function () {
            context.pop();
            next();
          });
        } else {
          callback();
        }
      }

      var item = val[i++];
      
      if (typeof(item) === 'function') {
        if (item.length === 0) {
          handleItem(null, item.call(smashContext(context)));
        } else if (item.length === 1) {
          item.call(smashContext(context), handleItem);
        } else {
          handleItem(new Error('Mu - Only functions with 0 or 1 arguments are supported in an array.'));
        }
      } else {
        handleItem(null, item);
      }
    }());
    
    return;
  }
  
  if (typeof val === 'object') {
    context.push(val);
    _render(tokens, context, partials, stream, stackSize, function () {
      context.pop();
      callback();
    });
    return;
  }
  
  if (val) {
    return _render(tokens, context, partials, stream, stackSize, callback);
  }
  
  return callback();
}


//
//
//
function findInContext(context, key) {
  var i = context.length;
  while (i--) {
    if (context[i][key]) {
      return context[i][key];
    }
  }

  return undefined;
}


//
//
//
function escapeReplace(char) {
  switch (char) {
    case '<': return '&lt;';
    case '>': return '&gt;';
    case '&': return '&amp;';
    case '"': return '&quot;';
    default: return char;
  }
}
