var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var res = mod._cached ? mod._cached : mod();
    return res;
}

require.paths = [];
require.modules = {};
require.extensions = [".js",".coffee"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        var y = cwd || '.';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = x + '/package.json';
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key)
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

require.define = function (filename, fn) {
    var dirname = require._core[filename]
        ? ''
        : require.modules.path().dirname(filename)
    ;
    
    var require_ = function (file) {
        return require(file, dirname)
    };
    require_.resolve = function (name) {
        return require.resolve(name, dirname);
    };
    require_.modules = require.modules;
    require_.define = require.define;
    var module_ = { exports : {} };
    
    require.modules[filename] = function () {
        require.modules[filename]._cached = module_.exports;
        fn.call(
            module_.exports,
            require_,
            module_,
            module_.exports,
            dirname,
            filename
        );
        require.modules[filename]._cached = module_.exports;
        return module_.exports;
    };
};

if (typeof process === 'undefined') process = {};

if (!process.nextTick) process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;
    
    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }
    
    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

if (!process.title) process.title = 'browser';

if (!process.binding) process.binding = function (name) {
    if (name === 'evals') return require('vm')
    else throw new Error('No such module')
};

if (!process.cwd) process.cwd = function () { return '.' };

require.define("path", function (require, module, exports, __dirname, __filename) {
    function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("/timeboats.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var MouseCommand, Point, Square, State, Timeboats;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  State = require('./state.coffee').State;

  Square = require('./square.coffee').Square;

  MouseCommand = require('./mouse_command.coffee').MouseCommand;

  Point = require('./point.coffee').Point;

  exports.Timeboats = Timeboats = (function() {

    function Timeboats(context, width, height) {
      this.context = context;
      this.width = width;
      this.height = height;
      this.onMouseMove = __bind(this.onMouseMove, this);
      this.onMouseDown = __bind(this.onMouseDown, this);
      this.timestep = 1 / 60;
      this.renderstep = 1 / 60;
      this.gamestate = "init";
      this.frame_history = [new State()];
      this.command_history = [];
      this.frame_num = 0;
      this.player_id = 1;
      this.message = 'not recording';
    }

    Timeboats.prototype.playClick = function() {
      if (this.gamestate === "init") {
        return this.updateState("init", "recording");
      } else if (this.gamestate === "recording") {
        return this.updateState("recording", "paused");
      } else if (this.gamestate === "paused") {
        return this.updateState("paused", "playing");
      } else if (this.gamestate === "playing") {
        return this.updateState("playing", "paused");
      } else if (this.gamestate === "stopped") {
        return this.updateState("stopped", "playing");
      }
    };

    Timeboats.prototype.addClick = function() {
      if (this.gamestate !== "stopped") {
        return this.updateState(this.gamestate, "stopped");
      } else {
        return this.updateState(this.gamestate, "recording");
      }
    };

    Timeboats.prototype.updateState = function(oldState, newState) {
      var player;
      console.log(oldState, '->', newState);
      if (newState === "recording") {
        this.player_id++;
        player = new Square(100, 100, 50);
        this.frame_history[this.frame_num].addObject(this.player_id, player);
        this.gamestate = "recording";
        $("#playbutton").html("Stop");
        $("#addbutton").html("Rewind");
        return $("#addbutton").prop("disabled", true);
      } else if (oldState === "recording" && newState === "paused") {
        this.frame_num = 0;
        this.gamestate = "paused";
        this.updateSlider(this.frame_num);
        $("#playbutton").html("Play");
        $("#addbutton").html("Rewind");
        return $("#addbutton").prop("disabled", false);
      } else if (newState === "playing") {
        this.gamestate = "playing";
        $("#playbutton").html("Pause");
        return $("#addbutton").html("Rewind");
      } else if (newState === "paused") {
        this.gamestate = "paused";
        $("#playbutton").html("Play");
        return $("#addbutton").html("Rewind");
      } else if (newState === "stopped") {
        this.gamestate = "stopped";
        this.message = "Done playback.";
        this.frame_num = 0;
        this.updateSlider(this.frame_num);
        $("#playbutton").html("Play");
        return $("#addbutton").html("Add New");
      } else {
        return console.log("couldn't switch state");
      }
    };

    Timeboats.prototype.updateSlider = function(value, max) {
      if (max == null) max = -1;
      $("#timeslider").prop('value', value);
      if (max > 0) return $("#timeslider").prop('max', max);
    };

    Timeboats.prototype.sliderDrag = function(value) {
      if (this.gamestate === "paused") {
        return this.frame_num = value;
      } else {
        return this.updateState(this.gamestate, "paused");
      }
    };

    Timeboats.prototype.addCommand = function(command) {
      while (this.frame_num >= this.command_history.length) {
        this.command_history.push([]);
      }
      return this.command_history[this.frame_num].push(command);
    };

    Timeboats.prototype.update = function(dt) {
      var next_state;
      if (this.gamestate === "recording") {
        next_state = this.frame_history[this.frame_num].clone();
        next_state.setCommands(this.command_history[this.frame_num] || []);
        next_state.update(dt);
        this.frame_num++;
        if (this.frame_history.length > this.frame_num) {
          this.frame_history[this.frame_num] = next_state;
        } else {
          this.frame_history.push(next_state);
        }
        return this.updateSlider(this.frame_num, this.frame_history.length - 1);
      } else if (this.gamestate === "playing") {
        this.frame_num++;
        this.updateSlider(this.frame_num);
        if (this.frame_num >= this.frame_history.length) {
          return this.updateState("playing", "stopped");
        }
      } else if (this.gamestate === "paused") {
        return this.state = this.frame_history[this.frame_num];
      }
    };

    Timeboats.prototype.draw = function() {
      this.context.clearRect(0, 0, this.width + 1, this.height + 1);
      this.frame_history[this.frame_num].draw(this.context);
      return this.context.fillText(this.message, 10, 30);
    };

    Timeboats.prototype.onMouseDown = function(e) {};

    Timeboats.prototype.onMouseMove = function(e) {
      var command;
      if (this.gamestate === "recording") {
        command = new MouseCommand(this.player_id, e[0], e[1]);
        return this.addCommand(command);
      }
    };

    return Timeboats;

  })();

}).call(this);

});

require.define("/state.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Serializable, State;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  Serializable = require('./serializable.coffee').Serializable;

  exports.State = State = (function() {

    __extends(State, Serializable);

    State.prototype.__type = 'State';

    function State() {
      this.objects = {};
      this.commands = [];
    }

    State.prototype.clone = function() {
      var id, object, st, _ref;
      st = new State();
      _ref = this.objects;
      for (id in _ref) {
        object = _ref[id];
        st.objects[id] = object.clone();
      }
      return st;
    };

    State.prototype.setCommands = function(commands) {
      return this.commands = commands;
    };

    State.prototype.addObject = function(id, object) {
      return this.objects[id] = object;
    };

    State.prototype.getObject = function(id) {
      return this.objects[id];
    };

    State.prototype.removeObject = function(id) {
      return this.objects[id].leave(function() {
        return delete this.objects[id];
      });
    };

    State.prototype.update = function(dt) {
      var command, id, object, _fn, _i, _len, _ref, _ref2;
      var _this = this;
      _ref = this.commands;
      _fn = function(command) {
        return command.apply(_this);
      };
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        command = _ref[_i];
        _fn(command);
      }
      _ref2 = this.objects;
      for (id in _ref2) {
        object = _ref2[id];
        object.update(dt);
      }
      return true;
    };

    State.prototype.draw = function(context) {
      var id, object, _ref;
      _ref = this.objects;
      for (id in _ref) {
        object = _ref[id];
        object.draw(context);
      }
      return true;
    };

    return State;

  })();

}).call(this);

});

require.define("/serializable.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Serializable;
  var __slice = Array.prototype.slice;

  exports.Serializable = Serializable = (function() {
    var __type;

    __type = 'Serializable';

    function Serializable() {
      this.__type = this.__type;
    }

    Serializable.buildMap = function() {
      var id, key, map, maps, res, val;
      maps = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      res = {};
      for (id in maps) {
        map = maps[id];
        for (key in map) {
          val = map[key];
          res[key] = val;
        }
      }
      return res;
    };

    Serializable.deserialize = function(object, prototypes) {
      var key, value, _results;
      if ((object != null) && typeof object === 'object') {
        if (object.__type != null) {
          object.__proto__ = prototypes[object.__type].prototype;
        }
        _results = [];
        for (key in object) {
          value = object[key];
          if (typeof value === 'object') {
            _results.push(this.deserialize(value, prototypes));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      }
    };

    return Serializable;

  })();

}).call(this);

});

require.define("/square.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var GameObject2D, Point, Square;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  GameObject2D = require('./game_object_2d.coffee').GameObject2D;

  Point = require('./point.coffee').Point;

  exports.Square = Square = (function() {

    __extends(Square, GameObject2D);

    Square.prototype.__type = 'Square';

    function Square(x, y, size) {
      this.x = x;
      this.y = y;
      this.size = size;
      Square.__super__.constructor.call(this, this.x, this.y);
      this.destx = this.x;
      this.desty = this.y;
    }

    Square.prototype.clone = function() {
      var sq;
      sq = new Square(this.x, this.y, this.size);
      sq.rotation = this.rotation;
      sq.vx = this.vx;
      sq.vy = this.vy;
      sq.destx = this.destx;
      sq.desty = this.desty;
      return sq;
    };

    Square.prototype.update = function(dt) {
      var dir, dist, to_move;
      dir = Point.subtract(this.destx, this.desty, this.x, this.y);
      dist = Point.getLength(dir.x, dir.y);
      to_move = Point.normalize(dir.x, dir.y, Math.sqrt(dist) * dt * 1000);
      if (dist < 0.5) {
        to_move = {
          x: 0,
          y: 0
        };
        this.setPos(this.destx, this.desty);
      }
      this.setVel(to_move.x, to_move.y);
      return Square.__super__.update.call(this, dt);
    };

    Square.prototype.draw = function(context) {
      context.save();
      context.translate(this.x, this.y);
      context.rotate(this.rotation);
      context.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
      return context.restore();
    };

    return Square;

  })();

}).call(this);

});

require.define("/game_object_2d.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var GameObject, GameObject2D, Point;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  GameObject = require('./game_object.coffee').GameObject;

  Point = require('./point.coffee').Point;

  exports.GameObject2D = GameObject2D = (function() {

    __extends(GameObject2D, GameObject);

    GameObject2D.prototype.__type = 'GameObject2D';

    function GameObject2D(x, y, vx, vy, rotation) {
      this.x = x != null ? x : 0;
      this.y = y != null ? y : 0;
      this.vx = vx != null ? vx : 0;
      this.vy = vy != null ? vy : 0;
      this.rotation = rotation != null ? rotation : 0;
      GameObject2D.__super__.constructor.call(this, this.state);
    }

    GameObject2D.prototype.clone = function() {
      return new GameObject2D(this.x, this.y, this.vx, this.vy, this.rotation);
    };

    GameObject2D.prototype.setPos = function(x, y) {
      this.x = x;
      return this.y = y;
    };

    GameObject2D.prototype.setVel = function(vx, vy) {
      this.vx = vx;
      this.vy = vy;
      if (this.vx !== 0 || this.vy !== 0) {
        return this.rotation = Point.getAngle(this.vx, this.vy);
      }
    };

    GameObject2D.prototype.update = function(dt) {
      var newPos;
      newPos = Point.add(this.x, this.y, this.vx * dt, this.vy * dt);
      return this.setPos(newPos.x, newPos.y);
    };

    return GameObject2D;

  })();

}).call(this);

});

require.define("/game_object.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var GameObject, Serializable;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  Serializable = require('./serializable.coffee').Serializable;

  exports.GameObject = GameObject = (function() {

    __extends(GameObject, Serializable);

    GameObject.prototype.__type = 'GameObject';

    function GameObject() {
      GameObject.__super__.constructor.apply(this, arguments);
    }

    GameObject.prototype.clone = function() {
      return new GameObject();
    };

    GameObject.prototype.draw = function(context) {};

    GameObject.prototype.update = function(dt) {};

    GameObject.prototype.leave = function(callback) {
      return callback();
    };

    return GameObject;

  })();

}).call(this);

});

require.define("/point.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Point;

  exports.Point = Point = (function() {

    function Point() {}

    Point.getAngleDeg = function(x, y) {
      return this.getAngle(x, y) * 180 / Math.PI;
    };

    Point.getAngle = function(x, y) {
      return Math.atan2(y, x);
    };

    Point.add = function(x1, y1, x2, y2) {
      return {
        x: x1 + x2,
        y: y1 + y2
      };
    };

    Point.subtract = function(x1, y1, x2, y2) {
      return {
        x: x1 - x2,
        y: y1 - y2
      };
    };

    Point.getDistance = function(x1, y1, x2, y2) {
      var x, y;
      x = x1 - x2;
      y = y1 - y2;
      return Math.sqrt(x * x + y * y);
    };

    Point.getLength = function(x, y) {
      return Math.sqrt(x * x + y * y);
    };

    Point.normalize = function(x, y, length) {
      var current, scale;
      if (length == null) length = 1;
      current = this.getLength(x, y);
      scale = current !== 0 ? length / current : 0;
      return {
        x: x * scale,
        y: y * scale
      };
    };

    return Point;

  })();

}).call(this);

});

require.define("/mouse_command.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Command, MouseCommand;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  Command = require('./command.coffee').Command;

  exports.MouseCommand = MouseCommand = (function() {

    __extends(MouseCommand, Command);

    MouseCommand.prototype.__type = 'MouseCommand';

    function MouseCommand(id, destx, desty) {
      this.id = id;
      this.destx = destx;
      this.desty = desty;
      MouseCommand.__super__.constructor.call(this, this.id);
    }

    MouseCommand.prototype.apply = function(state) {
      var obj;
      obj = state.getObject(this.id);
      if (obj != null) {
        obj.destx = this.destx;
        return obj.desty = this.desty;
      }
    };

    return MouseCommand;

  })();

}).call(this);

});

require.define("/command.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Command, Serializable;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  Serializable = require('./serializable.coffee').Serializable;

  exports.Command = Command = (function() {

    __extends(Command, Serializable);

    Command.prototype.__type = 'Command';

    function Command(id) {
      this.id = id;
      Command.__super__.constructor.apply(this, arguments);
    }

    Command.prototype.apply = function(state) {};

    return Command;

  })();

}).call(this);

});

require.define("/client.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Timeboats, timestamp;

  Timeboats = require('./timeboats.coffee').Timeboats;

  timestamp = function() {
    return +new Date();
  };

  window.onload = function() {
    var canvas, context, dt, frame, frame_num, game, gdt, last, rdt;
    canvas = $('#game-canvas')[0];
    context = canvas.getContext('2d');
    game = new Timeboats(context, canvas.width, canvas.height);
    $("#addbutton").prop("disabled", true);
    $("#addbutton").click(function() {
      return game.addClick();
    });
    $("#playbutton").click(function() {
      return game.playClick();
    });
    $("#timeslider").change(function() {
      return game.sliderDrag($("#timeslider").val());
    });
    canvas.onmousedown = function(e) {
      return game.onMouseDown(e);
    };
    canvas.onmousemove = function(e) {
      var canoffset, x, y;
      canoffset = $(canvas).offset();
      x = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft - Math.floor(canoffset.left);
      y = event.clientY + document.body.scrollTop + document.documentElement.scrollTop - Math.floor(canoffset.top) + 1;
      return game.onMouseMove([x, y]);
    };
    last = timestamp();
    dt = 0;
    gdt = 0;
    rdt = 0;
    frame_num = 0;
    frame = function() {
      var now;
      frame_num += 1;
      now = timestamp();
      dt = Math.min(1, (now - last) / 1000);
      gdt = gdt + dt;
      while (gdt > game.timestep) {
        gdt = gdt - game.timestep;
        game.update(game.timestep);
      }
      rdt = rdt + dt;
      if (rdt > game.renderstep) {
        rdt = rdt - game.renderstep;
        game.draw();
        context.fillText("" + Math.floor(1 / dt), 10, 10);
      }
      last = now;
      return requestAnimationFrame(frame);
    };
    return frame();
  };

}).call(this);

});
require("/client.coffee");
