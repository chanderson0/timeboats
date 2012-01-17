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
  var Command, Map, Point, Square, State, Timeboats;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  State = require('./state.coffee').State;

  Square = require('./square.coffee').Square;

  Command = require('./command.coffee');

  Point = require('./point.coffee').Point;

  Map = require('./map.coffee').Map;

  exports.Timeboats = Timeboats = (function() {

    function Timeboats(game, context, width, height) {
      this.game = game;
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
      this.active_commands = [];
      Map.getInstance().generate(this.width / Map.CELL_SIZE_PX, this.height / Map.CELL_SIZE_PX, new Date().getTime());
    }

    Timeboats.prototype.playClick = function() {
      if (this.gamestate === "init" || this.gamestate === "ready") {
        return this.updateState("init", "recording");
      } else if (this.gamestate === "recording") {
        return this.updateState("recording", "paused");
      } else if (this.gamestate === "paused") {
        return this.updateState("paused", "playing");
      } else if (this.gamestate === "playing") {
        return this.updateState("playing", "paused");
      }
    };

    Timeboats.prototype.addClick = function() {
      return this.updateState(this.gamestate, "ready");
    };

    Timeboats.prototype.updateState = function(oldState, newState) {
      var command, player;
      console.log(oldState, '->', newState);
      if ((oldState === "init" || oldState === "ready") && newState === "recording") {
        player = new Square(this.game.turn_id, 100, 100, 20, this.game.currentPlayer().color);
        command = new Command.JoinCommand(player.id, player);
        this.addCommand(this.command_history, command);
        this.addCommand(this.active_commands, command);
        this.gamestate = "recording";
        $("#playbutton").html("Stop");
        $("#playbutton").prop("disabled", true);
        $("#addbutton").html("Ready Next");
        return $("#addbutton").prop("disabled", true);
      } else if (oldState === "paused" && newState === "rerecording") {
        this.gamestate = "rerecording";
        $("#playbutton").html("Stop");
        $("#playbutton").prop("disabled", true);
        $("#addbutton").html("Ready Next");
        return $("#addbutton").prop("disabled", true);
      } else if (oldState === "rerecording" && newState === "paused") {
        this.gamestate = "paused";
        this.frame_num = 0;
        this.updateSlider(this.frame_num);
        $("#playbutton").html("Play");
        $("#playbutton").prop("disabled", false);
        $("#addbutton").html("Ready Next");
        return $("#addbutton").prop("disabled", false);
      } else if (oldState === "recording" && newState === "paused") {
        this.game.recordTurn(this.active_commands);
        this.active_commands = [];
        this.game.nextTurn();
        this.frame_num = 0;
        this.gamestate = "paused";
        this.updateSlider(this.frame_num);
        $("#playbutton").html("Play");
        $("#playbutton").prop("disabled", false);
        $("#addbutton").html("Ready Next");
        return $("#addbutton").prop("disabled", false);
      } else if (oldState === "paused" && newState === "playing") {
        this.gamestate = "playing";
        $("#playbutton").html("Pause");
        $("#addbutton").html("Ready Next");
        return $("#addbutton").prop("disabled", true);
      } else if (oldState === "paused" && newState === "ready") {
        if (!this.game.isLatestTurn()) {
          this.game.setTurn(this.game.latestTurnNumber());
          this.command_history = this.game.computeCommands();
          this.frame_num = 0;
          this.frame_history = [this.frame_history[this.frame_num]];
        }
        this.gamestate = "ready";
        this.frame_num = 0;
        this.updateSlider(this.frame_num);
        $("#playbutton").html("Start");
        $("#addbutton").html("Ready Next");
        return $("#addbutton").prop("disabled", true);
      } else if ((oldState === "playing" || oldState === "ready") && newState === "paused") {
        this.gamestate = "paused";
        $("#playbutton").html("Play");
        $("#addbutton").html("Ready Next");
        return $("#addbutton").prop("disabled", false);
      } else {
        return console.log("couldn't switch state");
      }
    };

    Timeboats.prototype.updateSlider = function(value, max) {
      if (max == null) max = -1;
      $("#timeslider").prop('value', value);
      if (max > 0) return $("#timeslider").prop('max', max);
    };

    Timeboats.prototype.turnClicked = function(number) {
      if (this.gamestate === "paused") {
        this.game.setTurn(number);
        this.command_history = this.game.computeCommands();
        this.frame_num = 0;
        this.frame_history = [this.frame_history[this.frame_num]];
        this.updateSlider(this.frame_num);
        return this.updateState("paused", "rerecording");
      }
    };

    Timeboats.prototype.sliderDrag = function(value) {
      if (this.gamestate === "paused") {
        return this.frame_num = value;
      } else {
        return this.updateState(this.gamestate, "paused");
      }
    };

    Timeboats.prototype.addCommand = function(buffer, command) {
      while (this.frame_num >= buffer.length) {
        buffer.push([]);
      }
      return buffer[this.frame_num].push(command);
    };

    Timeboats.prototype.update = function(dt) {
      var id, next_state, object, player_count, _ref;
      Map.getInstance().update(dt);
      if (this.gamestate === "recording" || this.gamestate === "rerecording") {
        next_state = this.frame_history[this.frame_num].clone();
        next_state.setCommands(this.command_history[this.frame_num] || []);
        next_state.update(dt);
        this.frame_num++;
        if (this.frame_history.length > this.frame_num) {
          this.frame_history[this.frame_num] = next_state;
        } else {
          this.frame_history.push(next_state);
        }
        this.updateSlider(this.frame_num, this.frame_history.length - 1);
        if (this.frame_num > 0) {
          player_count = 0;
          _ref = next_state.objects;
          for (id in _ref) {
            object = _ref[id];
            if (object.__type === 'Square' || object.__type === 'Explosion') {
              player_count++;
            }
          }
          if (player_count === 0) {
            this.frame_history.splice(this.frame_num + 1, this.frame_history.length - this.frame_num);
            this.updateSlider(this.frame_num, this.frame_num);
            return this.updateState(this.gamestate, "paused");
          }
        }
      } else if (this.gamestate === "playing") {
        this.frame_num++;
        this.updateSlider(this.frame_num);
        if (this.frame_num >= this.frame_history.length) {
          this.updateState("playing", "paused");
          this.frame_num = 0;
          return this.updateSlider(this.frame_num);
        }
      } else if (this.gamestate === "paused") {
        return this.state = this.frame_history[this.frame_num];
      }
    };

    Timeboats.prototype.draw = function() {
      this.context.clearRect(0, 0, this.width + 1, this.height + 1);
      Map.getInstance().draw(this.context);
      return this.frame_history[this.frame_num].draw(this.context, {
        active: this.game.turn_id
      });
    };

    Timeboats.prototype.onMouseDown = function(e) {
      var command;
      if (this.gamestate === "recording") {
        command = new Command.ExplodeCommand(this.game.turn_id);
        this.addCommand(this.command_history, command);
        return this.addCommand(this.active_commands, command);
      }
    };

    Timeboats.prototype.onMouseMove = function(e) {
      var command;
      if (this.gamestate === "recording") {
        command = new Command.MouseCommand(this.game.turn_id, e[0], e[1]);
        this.addCommand(this.command_history, command);
        return this.addCommand(this.active_commands, command);
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
      var _this = this;
      return this.objects[id].leave(function() {
        return delete _this.objects[id];
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
        object.update(dt, this);
      }
      return true;
    };

    State.prototype.draw = function(context, options) {
      var id, object, _ref;
      _ref = this.objects;
      for (id in _ref) {
        object = _ref[id];
        object.draw(context, {
          dim: options.active !== id
        });
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
  var Explosion, GameObject2D, Map, Point, Square;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  GameObject2D = require('./game_object_2d.coffee').GameObject2D;

  Point = require('./point.coffee').Point;

  Explosion = require('./explosion.coffee').Explosion;

  Map = require('./map.coffee').Map;

  exports.Square = Square = (function() {

    __extends(Square, GameObject2D);

    Square.prototype.__type = 'Square';

    function Square(id, x, y, size, fill) {
      this.id = id;
      this.x = x;
      this.y = y;
      this.size = size;
      this.fill = fill != null ? fill : "white";
      Square.__super__.constructor.call(this, this.id, this.x, this.y);
      this.destx = this.x;
      this.desty = this.y;
      this.radius = this.size / 2;
    }

    Square.prototype.clone = function() {
      var sq;
      sq = new Square(this.id, this.x, this.y, this.size, this.fill);
      sq.rotation = this.rotation;
      sq.vx = this.vx;
      sq.vy = this.vy;
      sq.destx = this.destx;
      sq.desty = this.desty;
      return sq;
    };

    Square.prototype.explode = function(state) {
      var explosion, id;
      id = Math.floor(Math.random() * 1000000);
      explosion = new Explosion(id, this.x, this.y, 50);
      state.addObject(id, explosion);
      return state.removeObject(this.id);
    };

    Square.prototype.update = function(dt, state) {
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
      Map.getInstance().collideWith(this, state, true);
      return Square.__super__.update.call(this, dt, state);
    };

    Square.prototype.draw = function(context, options) {
      context.save();
      if ((options != null) && options.dim) context.globalAlpha = 0.5;
      context.fillStyle = this.fill;
      context.translate(this.x, this.y);
      context.rotate(this.rotation);
      context.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
      return context.restore();
    };

    Square.prototype.collide = function(state) {
      return this.explode(state);
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

    function GameObject2D(id, x, y, vx, vy, rotation, radius) {
      this.id = id;
      this.x = x != null ? x : 0;
      this.y = y != null ? y : 0;
      this.vx = vx != null ? vx : 0;
      this.vy = vy != null ? vy : 0;
      this.rotation = rotation != null ? rotation : 0;
      this.radius = radius != null ? radius : 0;
      GameObject2D.__super__.constructor.call(this, this.id);
    }

    GameObject2D.prototype.clone = function() {
      return new GameObject2D(this.id, this.x, this.y, this.vx, this.vy, this.rotation, this.radius);
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

    GameObject2D.prototype.collide = function(state) {
      this.vx = 0;
      return this.vy = 0;
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

    function GameObject(id) {
      this.id = id;
      GameObject.__super__.constructor.apply(this, arguments);
    }

    GameObject.prototype.clone = function() {
      return new GameObject(this.id);
    };

    GameObject.prototype.draw = function(context) {};

    GameObject.prototype.update = function(dt, state) {};

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

require.define("/explosion.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Explosion, GameObject, Map, Point;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  GameObject = require('./game_object.coffee').GameObject;

  Point = require('./point.coffee').Point;

  Map = require('./map.coffee').Map;

  exports.Explosion = Explosion = (function() {

    __extends(Explosion, GameObject);

    Explosion.prototype.__type = 'Explosion';

    function Explosion(id, x, y, max_radius) {
      this.id = id;
      this.x = x;
      this.y = y;
      this.max_radius = max_radius;
      Explosion.__super__.constructor.call(this, this.id, this.x, this.y);
      this.radius = 0;
      Map.getInstance().damageAt(this.x, this.y, this.max_radius);
    }

    Explosion.prototype.clone = function() {
      var exp;
      exp = new Explosion(this.id, this.x, this.y, this.max_radius);
      exp.radius = this.radius;
      return exp;
    };

    Explosion.prototype.update = function(dt, state) {
      var id, object, _ref;
      this.radius += dt * 100;
      _ref = state.objects;
      for (id in _ref) {
        object = _ref[id];
        if (object.__type === 'Square' && Point.getDistance(this.x, this.y, object.x, object.y) < this.radius) {
          object.explode(state);
        }
      }
      Explosion.__super__.update.call(this, dt, state);
      if (this.radius >= this.max_radius) return state.removeObject(this.id);
    };

    Explosion.prototype.draw = function(context) {
      context.save();
      context.translate(this.x, this.y);
      context.strokeStyle = "white";
      context.beginPath();
      context.arc(0, 0, this.radius, 0, Math.PI * 2, true);
      context.closePath();
      context.stroke();
      return context.restore();
    };

    return Explosion;

  })();

}).call(this);

});

require.define("/map.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var GameObject, Gaussian, Map, MapCell, Point, Random;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  GameObject = require('./game_object').GameObject;

  MapCell = require('./map_cell.coffee').MapCell;

  Random = require('./random.coffee').Random;

  Gaussian = require('./gaussian.coffee').Gaussian;

  Point = require('./point.coffee').Point;

  exports.Map = Map = (function() {
    var instance;

    __extends(Map, GameObject);

    Map.prototype.__type = 'Map';

    instance = null;

    Map.CELL_SIZE_PX = 12;

    Map.getInstance = function() {
      if (!(instance != null)) instance = new this;
      return instance;
    };

    function Map() {
      this.width = 0;
      this.height = 0;
      this.cells = [];
      this.isInitialized = false;
      this.random = null;
      this.waterLevel = 5;
      this.waterDt = 0;
      Map.__super__.constructor.apply(this, arguments);
    }

    Map.prototype.clone = function() {
      return instance;
    };

    Map.prototype.update = function(dt) {
      var x, y, _ref, _results;
      this.waterDt += dt;
      if (this.waterDt >= 1 / 10) {
        this.waterDt = 0;
        if (this.isInitialized) {
          _results = [];
          for (x = 0, _ref = this.width - 1; 0 <= _ref ? x <= _ref : x >= _ref; 0 <= _ref ? x++ : x--) {
            _results.push((function() {
              var _ref2, _results2;
              _results2 = [];
              for (y = 0, _ref2 = this.height - 1; 0 <= _ref2 ? y <= _ref2 : y >= _ref2; 0 <= _ref2 ? y++ : y--) {
                this.cells[x][y].excitement *= 0.9;
                if (this.random.nextf() > 0.97) {
                  _results2.push(this.cells[x][y].excitement += -0.3 + this.random.nextf() * 0.6);
                } else {
                  _results2.push(void 0);
                }
              }
              return _results2;
            }).call(this));
          }
          return _results;
        }
      }
    };

    Map.prototype.draw = function(context) {
      var alpha, b, cellX, cellY, g, landAlpha, r, waterAlpha, x, y, _ref, _ref2;
      if (this.isInitialized) {
        context.save();
        for (x = 0, _ref = this.width - 1; 0 <= _ref ? x <= _ref : x >= _ref; 0 <= _ref ? x++ : x--) {
          for (y = 0, _ref2 = this.height - 1; 0 <= _ref2 ? y <= _ref2 : y >= _ref2; 0 <= _ref2 ? y++ : y--) {
            cellX = x * Map.CELL_SIZE_PX;
            cellY = y * Map.CELL_SIZE_PX;
            b = Math.floor(40 + this.cells[x][y].altitude * 10);
            r = Math.floor(b * 0.9);
            g = r;
            if (this.cells[x][y].altitude < this.waterLevel) {
              alpha = 0.5 + this.cells[x][y].excitement * 0.2;
              landAlpha = 1 / (1 + alpha);
              waterAlpha = alpha / (1 + alpha);
              r = Math.floor(r * landAlpha + 60.0 * waterAlpha);
              g = Math.floor(g * landAlpha + 110.0 * waterAlpha);
              b = Math.floor(b * landAlpha + 150.0 * waterAlpha);
            }
            if (this.cells[x][y].isPlant) {
              r = Math.floor(r * 0.2 + 72 * 0.8);
              g = Math.floor(g * 0.2 + 105 * 0.8);
              b = Math.floor(b * 0.2 + 87 * 0.8);
            }
            context.fillStyle = "rgba(" + r + ", " + g + ", " + b + ", 1)";
            context.fillRect(cellX, cellY, cellX + Map.CELL_SIZE_PX, cellY + Map.CELL_SIZE_PX);
          }
        }
        return context.restore();
      }
    };

    Map.prototype.collideWith = function(obj, state, disturb) {
      var collided, x, xFinish, xStart, y, yFinish, yStart, _results;
      if (disturb == null) disturb = false;
      if (this.isInitialized) {
        xStart = this.getCellAt(obj.x - obj.radius);
        yStart = this.getCellAt(obj.y - obj.radius);
        xFinish = this.getCellAt(obj.x + obj.radius);
        yFinish = this.getCellAt(obj.y + obj.radius);
        collided = false;
        _results = [];
        for (x = xStart; xStart <= xFinish ? x <= xFinish : x >= xFinish; xStart <= xFinish ? x++ : x--) {
          _results.push((function() {
            var _results2;
            _results2 = [];
            for (y = yStart; yStart <= yFinish ? y <= yFinish : y >= yFinish; yStart <= yFinish ? y++ : y--) {
              if (disturb) this.cells[x][y].excitement = 0.7;
              if (this.cells[x][y].altitude >= this.waterLevel) {
                if (!collided) {
                  obj.collide(state);
                  collided = true;
                  if (!disturb) {
                    x = xFinish + 1;
                    _results2.push(y = yFinish + 1);
                  } else {
                    _results2.push(void 0);
                  }
                } else {
                  _results2.push(void 0);
                }
              } else {
                _results2.push(void 0);
              }
            }
            return _results2;
          }).call(this));
        }
        return _results;
      }
    };

    Map.prototype.damageAt = function(x, y, radius) {
      var g, xG, yG, _ref, _ref2, _results;
      if (this.isInitialized) {
        radius = Math.ceil(radius / Map.CELL_SIZE_PX);
        x = this.getCellAt(x);
        y = this.getCellAt(y);
        g = new Gaussian(radius * 0.8);
        _results = [];
        for (xG = _ref = x - radius, _ref2 = x + radius; _ref <= _ref2 ? xG <= _ref2 : xG >= _ref2; _ref <= _ref2 ? xG++ : xG--) {
          _results.push((function() {
            var _ref3, _ref4, _results2;
            _results2 = [];
            for (yG = _ref3 = y - radius, _ref4 = y + radius; _ref3 <= _ref4 ? yG <= _ref4 : yG >= _ref4; _ref3 <= _ref4 ? yG++ : yG--) {
              if (xG >= 0 && xG < this.width && yG >= 0 && yG < this.height) {
                this.cells[xG][yG].altitude -= g.get2d(xG - x, yG - y) * 5.0;
                if (this.cells[xG][yG].altitude < 0) {
                  this.cells[xG][yG].altitude = 0;
                }
                if (this.cells[xG][yG].altitude < this.waterLevel) {
                  _results2.push(this.cells[xG][yG].isPlant = false);
                } else {
                  _results2.push(void 0);
                }
              } else {
                _results2.push(void 0);
              }
            }
            return _results2;
          }).call(this));
        }
        return _results;
      }
    };

    Map.prototype.getCellAt = function(p) {
      return Math.floor(p / Map.CELL_SIZE_PX);
    };

    Map.prototype.generate = function(width, height, seed) {
      var col, i, numGaussians, x, y, _ref, _ref2, _ref3, _ref4;
      this.width = width;
      this.height = height;
      this.random = new Random(seed);
      this.isInitialized = false;
      this.cells = [];
      for (x = 0, _ref = this.width - 1; 0 <= _ref ? x <= _ref : x >= _ref; 0 <= _ref ? x++ : x--) {
        col = [];
        for (y = 0, _ref2 = this.height - 1; 0 <= _ref2 ? y <= _ref2 : y >= _ref2; 0 <= _ref2 ? y++ : y--) {
          col.push(new MapCell(0));
        }
        this.cells.push(col);
      }
      this.swipeGaussian(18, 20, 30);
      this.swipeGaussian(18, 20, 30);
      numGaussians = 1 + this.random.next() % 3;
      for (i = 1; 1 <= numGaussians ? i <= numGaussians : i >= numGaussians; 1 <= numGaussians ? i++ : i--) {
        this.swipeGaussian(12, 14, 6 + this.random.next() % 15);
      }
      numGaussians = 1 + this.random.next() % 4;
      for (i = 1; 1 <= numGaussians ? i <= numGaussians : i >= numGaussians; 1 <= numGaussians ? i++ : i--) {
        this.swipeGaussian(7, 10, 10);
      }
      for (x = 0, _ref3 = this.width - 1; 0 <= _ref3 ? x <= _ref3 : x >= _ref3; 0 <= _ref3 ? x++ : x--) {
        for (y = 0, _ref4 = this.height - 1; 0 <= _ref4 ? y <= _ref4 : y >= _ref4; 0 <= _ref4 ? y++ : y--) {
          if (this.cells[x][y].altitude > this.waterLevel + 1 && (this.cells[x][y].altitude - this.waterLevel - 1) * 0.03 > this.random.nextf()) {
            this.cells[x][y].isPlant = true;
          }
          this.cells[x][y].altitude = Math.floor(this.cells[x][y].altitude);
        }
      }
      return this.isInitialized = true;
    };

    Map.prototype.swipeGaussian = function(variance, radius, gaussLife) {
      var g, gaussAccX, gaussAccY, gaussVelX, gaussVelY, gaussX, gaussY, i, _results;
      gaussX = this.random.next() % this.width;
      gaussY = this.random.next() % this.height;
      gaussVelX = 0.5 + (this.random.nextf() * 3.0);
      gaussVelY = 0.5 + (this.random.nextf() * 3.0);
      gaussAccX = -0.2 + (this.random.nextf() * 0.2);
      gaussAccY = -0.2 + (this.random.nextf() * 0.2);
      g = new Gaussian(variance);
      g.compute(-radius, radius, -radius, radius);
      _results = [];
      for (i = 1; 1 <= gaussLife ? i <= gaussLife : i >= gaussLife; 1 <= gaussLife ? i++ : i--) {
        this.applyGaussian(g, radius, Math.floor(gaussX), Math.floor(gaussY));
        gaussX += gaussVelX;
        gaussY += gaussVelY;
        gaussVelX += gaussAccX;
        _results.push(gaussVelY += gaussAccY);
      }
      return _results;
    };

    Map.prototype.applyGaussian = function(g, radius, xCenter, yCenter) {
      var x, y, _ref, _ref2, _results;
      radius = Math.ceil(radius);
      _results = [];
      for (x = _ref = xCenter - radius, _ref2 = xCenter + radius; _ref <= _ref2 ? x <= _ref2 : x >= _ref2; _ref <= _ref2 ? x++ : x--) {
        _results.push((function() {
          var _ref3, _ref4, _results2;
          _results2 = [];
          for (y = _ref3 = yCenter - radius, _ref4 = yCenter + radius; _ref3 <= _ref4 ? y <= _ref4 : y >= _ref4; _ref3 <= _ref4 ? y++ : y--) {
            if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
              _results2.push(this.cells[x][y].altitude += g.get2d(x - xCenter, y - yCenter) * 100.0);
            } else {
              _results2.push(void 0);
            }
          }
          return _results2;
        }).call(this));
      }
      return _results;
    };

    return Map;

  })();

}).call(this);

});

require.define("/map_cell.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var GameObject, MapCell;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  GameObject = require('./game_object.coffee').GameObject;

  exports.MapCell = MapCell = (function() {

    __extends(MapCell, GameObject);

    MapCell.prototype.__type = 'MapCell';

    function MapCell(altitude) {
      this.altitude = altitude;
      this.isPlant = false;
      this.excitement = 0;
      MapCell.__super__.constructor.apply(this, arguments);
    }

    MapCell.prototype.clone = function() {
      return new MapCell(this.altitude);
    };

    MapCell.prototype.update = function(dt) {};

    return MapCell;

  })();

}).call(this);

});

require.define("/random.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Random;

  exports.Random = Random = (function() {

    Random.prototype.__type = 'Random';

    Random.MAX = 4294967294;

    function Random(seed) {
      this.last = seed;
    }

    Random.prototype.next = function() {
      this.last = ((1664525 * this.last) + 1013904223) % Random.MAX;
      return this.last;
    };

    Random.prototype.nextf = function() {
      return this.next() / Random.MAX;
    };

    return Random;

  })();

}).call(this);

});

require.define("/gaussian.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Gaussian;

  exports.Gaussian = Gaussian = (function() {

    Gaussian.prototype.__type = 'Gaussian';

    function Gaussian(variance) {
      this.denominator = 2.0 * variance;
      this.a = 1.0 / Math.sqrt(variance * 2.0 * Math.PI);
      this.xMin = 0;
      this.yMin = 0;
      this.clear();
    }

    Gaussian.prototype.compute = function(xMin, xMax, yMin, yMax) {
      var col, x, y;
      this.clear();
      this.xMin = xMin;
      this.yMin = yMin;
      for (x = xMin; xMin <= xMax ? x <= xMax : x >= xMax; xMin <= xMax ? x++ : x--) {
        col = [];
        for (y = yMin; yMin <= yMax ? y <= yMax : y >= yMax; yMin <= yMax ? y++ : y--) {
          col.push(this.get2d(x, y));
        }
        this.cache.push(col);
      }
      return this.cached = true;
    };

    Gaussian.prototype.clear = function() {
      this.cache = [];
      return this.cached = false;
    };

    Gaussian.prototype.get2d = function(x, y) {
      if (this.cached) {
        return this.cache[x - this.xMin][y - this.yMin];
      } else {
        return this.get(x) * this.get(y);
      }
    };

    Gaussian.prototype.get = function(x) {
      return this.a * Math.pow(Math.E, -(x * x) / this.denominator);
    };

    return Gaussian;

  })();

}).call(this);

});

require.define("/command.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Command, ExplodeCommand, JoinCommand, MouseCommand, Serializable;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  Serializable = require('./serializable.coffee').Serializable;

  Command = Command = (function() {

    __extends(Command, Serializable);

    Command.prototype.__type = 'Command';

    function Command(id) {
      this.id = id;
      Command.__super__.constructor.apply(this, arguments);
    }

    Command.prototype.apply = function(state) {};

    return Command;

  })();

  MouseCommand = MouseCommand = (function() {

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

  ExplodeCommand = ExplodeCommand = (function() {

    __extends(ExplodeCommand, Command);

    ExplodeCommand.prototype.__type = 'ExplodeCommand';

    function ExplodeCommand(id) {
      this.id = id;
      ExplodeCommand.__super__.constructor.call(this, this.id);
    }

    ExplodeCommand.prototype.apply = function(state) {
      var obj;
      obj = state.getObject(this.id);
      if (obj != null) return obj.explode(state);
    };

    return ExplodeCommand;

  })();

  JoinCommand = JoinCommand = (function() {

    __extends(JoinCommand, Command);

    JoinCommand.prototype.__type = 'JoinCommand';

    function JoinCommand(id, player) {
      this.id = id;
      this.player = player;
      JoinCommand.__super__.constructor.call(this, this.id);
    }

    JoinCommand.prototype.apply = function(state) {
      return state.addObject(this.player.id, this.player);
    };

    return JoinCommand;

  })();

  exports.Command = Command;

  exports.MouseCommand = MouseCommand;

  exports.JoinCommand = JoinCommand;

  exports.ExplodeCommand = ExplodeCommand;

}).call(this);

});

require.define("/turns.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Game, Player, Serializable, Turn, UUID;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  Serializable = require('./serializable.coffee').Serializable;

  UUID = require('./lib/uuid.js');

  exports.Player = Player = (function() {

    __extends(Player, Serializable);

    Player.prototype.__type = 'Player';

    function Player(id, color) {
      this.id = id != null ? id : null;
      this.color = color != null ? color : "white";
      if (!(this.id != null)) this.id = UUID.generate();
      Player.__super__.constructor.apply(this, arguments);
    }

    return Player;

  })();

  exports.Game = Game = (function() {

    __extends(Game, Serializable);

    Game.prototype.__type = 'Game';

    function Game(id, players, order, turns) {
      var player, _ref;
      this.id = id != null ? id : null;
      this.players = players != null ? players : {};
      this.order = order != null ? order : [];
      this.turns = turns != null ? turns : [];
      if (!(this.id != null)) this.id = UUID.generate();
      _ref = this.players;
      for (id in _ref) {
        player = _ref[id];
        this.renderPlayerTile(player, false, false);
      }
      this.current_player_id = null;
      this.turn_id = null;
      this.turn_idx = null;
      this.nextTurn();
      Game.__super__.constructor.apply(this, arguments);
    }

    Game.prototype.addPlayer = function(player) {
      this.players[player.id] = player;
      this.order.push(player.id);
      return this.renderPlayerTile(player, false, false);
    };

    Game.prototype.renderPlayerTile = function(player, active, update) {
      var html;
      if (active == null) active = false;
      if (update == null) update = true;
      html = new EJS({
        element: 'player_template'
      }).render({
        active: active ? 'active' : '',
        id: player.id,
        name: player.color,
        score: 0
      });
      if (update) {
        return $('#' + player.id).replaceWith(html);
      } else {
        return $('#player_tiles').append($(html));
      }
    };

    Game.prototype.currentPlayer = function() {
      return this.players[this.order[this.current_player_id]];
    };

    Game.prototype.recordTurn = function(commands) {
      var turn;
      turn = new Turn(this.turn_id, this.currentPlayer().id, commands);
      this.turns.push(turn);
      this.turn_idx = this.turns.length - 1;
      this.renderPlayerTile(this.currentPlayer(), true, true);
      if (this.turns.length > 1) {
        this.renderTurnTile(this.turns[this.turns.length - 2], this.turns.length - 2, false, true);
      }
      return this.renderTurnTile(turn, this.turn_idx, true, false);
    };

    Game.prototype.latestTurnNumber = function() {
      return this.turns.length - 1;
    };

    Game.prototype.isLatestTurn = function() {
      return this.turn_idx === this.turns.length - 1;
    };

    Game.prototype.setTurn = function(turn_num) {
      if (turn_num < 0 || turn_num >= this.turns.length) return;
      this.renderTurnTile(this.turns[this.turn_idx], this.turn_idx, false, true);
      this.turn_idx = turn_num;
      return this.renderTurnTile(this.turns[this.turn_idx], this.turn_idx, true, true);
    };

    Game.prototype.renderTurnTile = function(turn, number, active, update) {
      var html;
      if (active == null) active = false;
      if (update == null) update = true;
      html = new EJS({
        element: 'turn_template'
      }).render({
        active: active ? 'active' : '',
        id: turn.id,
        player_name: this.players[turn.player_id].color,
        turn_time: turn.time.toISOString(),
        turn_number: number
      });
      if (update) {
        $('#' + turn.id).replaceWith(html);
      } else {
        $('#turn_tiles').append($(html));
      }
      return $('#' + turn.id).click(function() {
        return window.turnClicked(number);
      });
    };

    Game.prototype.nextTurn = function() {
      if (this.current_player_id === null) {
        this.current_player_id = 0;
        this.turn_idx = 0;
      } else if (this.current_player_id >= this.order.length - 1) {
        this.renderPlayerTile(this.currentPlayer(), false, true);
        this.current_player_id = 0;
      } else {
        this.renderPlayerTile(this.currentPlayer(), false, true);
        this.current_player_id++;
      }
      this.renderPlayerTile(this.currentPlayer(), true, true);
      return this.turn_id = UUID.generate();
    };

    Game.prototype.computeCommands = function() {
      var command_idx, commands, turn_i, _ref, _ref2;
      commands = [];
      for (turn_i = 0, _ref = this.turn_idx; 0 <= _ref ? turn_i <= _ref : turn_i >= _ref; 0 <= _ref ? turn_i++ : turn_i--) {
        for (command_idx = 0, _ref2 = this.turns[turn_i].commands.length; 0 <= _ref2 ? command_idx <= _ref2 : command_idx >= _ref2; 0 <= _ref2 ? command_idx++ : command_idx--) {
          while (command_idx >= commands.length) {
            commands.push([]);
          }
          commands[command_idx] = commands[command_idx].concat(this.turns[turn_i].commands[command_idx] || []);
        }
      }
      return commands;
    };

    return Game;

  })();

  exports.Turn = Turn = (function() {

    __extends(Turn, Serializable);

    function Turn(id, player_id, commands, time) {
      this.id = id != null ? id : null;
      this.player_id = player_id;
      this.commands = commands;
      this.time = time != null ? time : null;
      if (!(this.time != null)) this.time = new Date();
      if (!(this.id != null)) this.id = UUID.generate();
      Turn.__super__.constructor.apply(this, arguments);
    }

    return Turn;

  })();

}).call(this);

});

require.define("/lib/uuid.js", function (require, module, exports, __dirname, __filename) {
    /*
 The MIT License: Copyright (c) 2010 LiosK.
*/
function UUID(){}UUID.generate=function(){var a=UUID._getRandomInt,b=UUID._hexAligner;return b(a(32),8)+"-"+b(a(16),4)+"-"+b(16384|a(12),4)+"-"+b(32768|a(14),4)+"-"+b(a(48),12)};UUID._getRandomInt=function(a){if(a<0)return NaN;if(a<=30)return 0|Math.random()*(1<<a);if(a<=53)return(0|Math.random()*1073741824)+(0|Math.random()*(1<<a-30))*1073741824;return NaN};UUID._getIntAligner=function(a){return function(b,f){for(var c=b.toString(a),d=f-c.length,e="0";d>0;d>>>=1,e+=e)if(d&1)c=e+c;return c}};
UUID._hexAligner=UUID._getIntAligner(16);

exports.generate = UUID.generate
});

require.define("/client.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Timeboats, Turns, timestamp;

  Timeboats = require('./timeboats.coffee').Timeboats;

  Turns = require('./turns.coffee');

  timestamp = function() {
    return +new Date();
  };

  window.onload = function() {
    var canvas, context, dt, frame, frame_num, game, gdt, last, order, player1, player2, players, rdt, timeboats;
    canvas = $('#game-canvas')[0];
    context = canvas.getContext('2d');
    player1 = new Turns.Player(1, "white");
    player2 = new Turns.Player(2, "red");
    players = {
      1: player1,
      2: player2
    };
    order = [1, 2];
    game = new Turns.Game(1, players, order);
    timeboats = new Timeboats(game, context, canvas.width, canvas.height);
    $("#addbutton").prop("disabled", true);
    $("#addbutton").click(function() {
      return timeboats.addClick();
    });
    $("#playbutton").click(function() {
      return timeboats.playClick();
    });
    $("#timeslider").change(function() {
      return timeboats.sliderDrag($("#timeslider").val());
    });
    window.turnClicked = function(number) {
      return timeboats.turnClicked(number);
    };
    canvas.onmousedown = function(e) {
      return timeboats.onMouseDown(e);
    };
    canvas.onmousemove = function(e) {
      var canoffset, x, y;
      canoffset = $(canvas).offset();
      x = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft - Math.floor(canoffset.left);
      y = event.clientY + document.body.scrollTop + document.documentElement.scrollTop - Math.floor(canoffset.top) + 1;
      return timeboats.onMouseMove([x, y]);
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
      while (gdt > timeboats.timestep) {
        gdt = gdt - timeboats.timestep;
        timeboats.update(timeboats.timestep);
      }
      rdt = rdt + dt;
      if (rdt > timeboats.renderstep) {
        rdt = rdt - timeboats.renderstep;
        timeboats.draw();
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
