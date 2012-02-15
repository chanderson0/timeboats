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
  var AssetLoader, Command, Dock, Map, Point, Square, State, Timeboats;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  State = require('./state.coffee').State;

  Square = require('./square.coffee').Square;

  Command = require('./command.coffee');

  Point = require('./point.coffee').Point;

  Map = require('./map.coffee').Map;

  AssetLoader = require('./asset_loader.coffee').AssetLoader;

  Dock = require('./dock.coffee').Dock;

  exports.Timeboats = Timeboats = (function() {

    function Timeboats(game, context, width, height, api, document) {
      var checkpoint, gamePlayer, initialState, mine, startDock, _i, _j, _len, _len2, _ref, _ref2;
      this.game = game;
      this.context = context;
      this.width = width;
      this.height = height;
      this.api = api != null ? api : null;
      this.document = document != null ? document : null;
      this.onMouseMove = __bind(this.onMouseMove, this);
      this.onMouseDown = __bind(this.onMouseDown, this);
      this.timestep = 1 / 60;
      this.renderstep = 1 / 60;
      this.gamestate = "init";
      this.placeholder = null;
      this.frame_history = [];
      this.command_history = [];
      this.setFrameNum(0);
      this.active_commands = [];
      if (!(this.game.mapSeed != null)) this.game.setMap(new Date().getTime());
      initialState = new State();
      Map.getInstance().generate(this.width / Map.CELL_SIZE_PX, this.height / Map.CELL_SIZE_PX, this.game.mapSeed, this.game.players);
      _ref = Map.getInstance().checkpoints;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        checkpoint = _ref[_i];
        initialState.addObject(checkpoint.id, checkpoint);
      }
      _ref2 = Map.getInstance().mines;
      for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
        mine = _ref2[_j];
        initialState.addObject(mine.id, mine);
      }
      Map.getInstance().mines = [];
      this.frame_history.push(initialState);
      this.full_redraw = true;
      if (this.document != null) {
        this.game_canvas = this.document.createElement('canvas');
        this.game_canvas.width = this.width;
        this.game_canvas.height = this.height;
        this.game_context = this.game_canvas.getContext('2d');
        this.map_canvas = this.document.createElement('canvas');
        this.map_canvas.width = this.width;
        this.map_canvas.height = this.height;
        this.map_context = this.map_canvas.getContext('2d');
      } else {
        this.m_canvas = null;
      }
      AssetLoader.getInstance().load();
      gamePlayer = this.game.currentPlayer();
      startDock = Map.getInstance().docks[gamePlayer.id];
      startDock.active = 'ready';
      this.time = 0;
      this.game.render();
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
      var command, gamePlayer, map, player, scores, startDock, state;
      console.log(oldState, '->', newState);
      if ((oldState === "init" || oldState === "ready") && newState === "recording") {
        this.placeholder = null;
        gamePlayer = this.game.currentPlayer();
        startDock = Map.getInstance().docks[gamePlayer.id];
        player = new Square(this.game.next_turn_id, startDock.x, startDock.y, 32, gamePlayer.color, gamePlayer.id);
        command = new Command.JoinCommand(player.id, player);
        this.addCommand(this.command_history, command);
        this.addCommand(this.active_commands, command);
        startDock.active = null;
        this.gamestate = "recording";
        $("#playbutton").html("Stop");
        $("#playbutton").prop("disabled", true);
        return $("#timeslider").prop("disabled", true);
      } else if ((oldState === "init" || oldState === "paused") && newState === "rerecording") {
        this.gamestate = "rerecording";
        gamePlayer = this.game.currentPlayer();
        startDock = Map.getInstance().docks[gamePlayer.id];
        startDock.active = 'ready';
        $("#playbutton").html("Stop");
        $("#playbutton").prop("disabled", true);
        return $("#timeslider").prop("disabled", false);
      } else if (oldState === "rerecording" && newState === "paused") {
        this.gamestate = "paused";
        this.setFrameNum(0);
        this.full_redraw = true;
        gamePlayer = this.game.currentPlayer();
        startDock = Map.getInstance().docks[gamePlayer.id];
        startDock.active = 'ready';
        if (this.game.turns.length > 0) {
          $("#playbutton").html("Play");
          $("#playbutton").prop("disabled", false);
        }
        return $("#timeslider").prop("disabled", false);
      } else if (oldState === "recording" && newState === "paused") {
        this.game.recordTurn(this.active_commands);
        this.active_commands = [];
        this.game.nextTurn();
        state = this.frame_history[this.frame_num];
        map = this.game.turnsToPlayers();
        scores = state.playerScores(map);
        this.game.setScores(scores, state.time);
        this.game.render();
        if (this.api != null) {
          this.api.saveGame(this.game, function(err, worked) {
            if (err || !worked) return alert("Couldn't save game");
          });
        }
        this.gamestate = "paused";
        if (this.frame_history[this.frame_history.length - 1].gameover) {
          this.updateState(this.gamestate, "gameover");
          return;
        }
        gamePlayer = this.game.currentPlayer();
        startDock = Map.getInstance().docks[gamePlayer.id];
        startDock.active = 'ready';
        this.setFrameNum(0);
        if (this.game.turns.length > 0) {
          $("#playbutton").html("Play");
          $("#playbutton").prop("disabled", false);
        }
        return $("#timeslider").prop("disabled", false);
      } else if (oldState === "paused" && newState === "playing") {
        this.gamestate = "playing";
        gamePlayer = this.game.currentPlayer();
        startDock = Map.getInstance().docks[gamePlayer.id];
        startDock.active = 'ready';
        $("#playbutton").html("Pause");
        $("#playbutton").prop("disabled", false);
        return $("#timeslider").prop("disabled", true);
      } else if (oldState === "paused" && newState === "ready") {
        this.setFrameNum(0);
        this.time = 0;
        if (!this.game.isLatestTurn()) {
          this.game.setTurn(this.game.latestTurnNumber());
          this.command_history = this.game.computeCommands();
          this.frame_history = [this.frame_history[0]];
        }
        gamePlayer = this.game.currentPlayer();
        startDock = Map.getInstance().docks[gamePlayer.id];
        startDock.active = 'go';
        this.gamestate = "ready";
        $("#playbutton").html("Start");
        $("#playbutton").prop("disabled", false);
        return $("#timeslider").prop("disabled", true);
      } else if ((oldState === "playing" || oldState === "ready") && newState === "paused") {
        this.gamestate = "paused";
        gamePlayer = this.game.currentPlayer();
        startDock = Map.getInstance().docks[gamePlayer.id];
        startDock.active = 'ready';
        $("#playbutton").html("Play");
        $("#playbutton").prop("disabled", false);
        return $("#timeslider").prop("disabled", false);
      } else if (newState === "gameover") {
        this.gamestate = "gameover";
        $("#playbutton").html("Play");
        $("#playbutton").prop("disabled", true);
        $("#timeslider").prop("disabled", true);
        return window.gameOver(this.game);
      } else {
        return console.log("couldn't switch state");
      }
    };

    Timeboats.prototype.setFrameNum = function(value, updateSlider) {
      var frame_not_consecutive;
      if (updateSlider == null) updateSlider = true;
      frame_not_consecutive = value !== this.frame_num + 1;
      this.frame_num = value;
      Map.getInstance().setFrame(value);
      Map.getInstance().computeTerrainState(frame_not_consecutive);
      if (updateSlider) return this.updateSlider(value);
    };

    Timeboats.prototype.updateSlider = function(value, max) {
      if (max == null) max = -1;
      $("#timeslider").prop('value', value);
      if (max > 0) return $("#timeslider").prop('max', max);
    };

    Timeboats.prototype.turnClicked = function(number) {
      if (this.gamestate === "paused" || this.gamestate === "init") {
        if (number === null) number = this.game.latestTurnNumber();
        this.game.setTurn(number);
        this.command_history = this.game.computeCommands();
        this.setFrameNum(0);
        this.frame_history = [this.frame_history[this.frame_num]];
        this.updateState("paused", "rerecording");
        return this.full_redraw = true;
      }
    };

    Timeboats.prototype.sliderDrag = function(value) {
      if (this.gamestate === "paused") {
        this.full_redraw = true;
        return this.setFrameNum(parseInt(value), false);
      }
    };

    Timeboats.prototype.addCommand = function(buffer, command) {
      while (this.frame_num >= buffer.length) {
        buffer.push([]);
      }
      return buffer[this.frame_num].push(command);
    };

    Timeboats.prototype.update = function(dt) {
      var command_count, id, next_state, object, player_count, _ref;
      Map.getInstance().update(dt);
      if (this.gamestate === "recording" || this.gamestate === "rerecording") {
        this.time += dt;
        Map.getInstance().setFrame(this.frame_num + 1, true);
        next_state = this.frame_history[this.frame_num].clone(this.time);
        next_state.setCommands(this.command_history[this.frame_num] || []);
        next_state.update(dt);
        this.setFrameNum(this.frame_num + 1);
        if (this.frame_history.length > this.frame_num) {
          this.frame_history[this.frame_num] = next_state;
        } else {
          this.frame_history.push(next_state);
        }
        this.updateSlider(this.frame_num, this.frame_history.length - 1);
        if (this.frame_num > 0) {
          player_count = 0;
          command_count = next_state.commands.length;
          if (command_count > 0) {
            this.frames_no_commands = 0;
          } else {
            this.frames_no_commands++;
          }
          _ref = next_state.objects;
          for (id in _ref) {
            object = _ref[id];
            if (object.__type === 'Square' || object.__type === 'Explosion') {
              player_count++;
            }
          }
          if (player_count === 0 || this.frames_no_commands > 300) {
            this.frame_history.splice(this.frame_num + 1, this.frame_history.length - this.frame_num);
            this.updateSlider(this.frame_num, this.frame_num);
            return this.updateState(this.gamestate, "paused");
          }
        } else {
          return this.frames_no_commands = 0;
        }
      } else if (this.gamestate === "playing") {
        this.setFrameNum(this.frame_num + 1);
        if (this.frame_num >= this.frame_history.length) {
          this.updateState("playing", "paused");
          return this.setFrameNum(0);
        }
      } else if (this.gamestate === "paused") {
        return this.state = this.frame_history[this.frame_num];
      }
    };

    Timeboats.prototype.drawHUD = function(context) {
      var time;
      if (this.gamestate === 'recording' && this.frames_no_commands > 200) {
        context.save();
        context.fillStyle = '#c0262f';
        context.font = 'bold 20px Verdana';
        context.textAlign = 'center';
        context.fillText('No movement warning!', this.width / 2, 30);
        context.restore();
      }
      time = this.frame_history[this.frame_num].time;
      if (!(time != null)) time = 0;
      return $('#time').html(time.toFixed(2));
    };

    Timeboats.prototype.draw = function() {
      Map.getInstance().draw(this.map_context, {
        full_redraw: this.full_redraw
      });
      this.full_redraw = false;
      this.game_context.clearRect(0, 0, this.width, this.height);
      Map.getInstance().drawNonTerrain(this.game_context);
      this.frame_history[this.frame_num].draw(this.game_context, {
        active: this.game.next_turn_id
      });
      this.drawHUD(this.game_context);
      this.context.drawImage(this.map_canvas, 0, 0);
      return this.context.drawImage(this.game_canvas, 0, 0);
    };

    Timeboats.prototype.onMouseDown = function(e) {
      var command, gamePlayer, startDock;
      if (this.gamestate === "recording") {
        command = new Command.ExplodeCommand(this.game.next_turn_id);
        this.addCommand(this.command_history, command);
        return this.addCommand(this.active_commands, command);
      } else if (this.gamestate === "ready") {
        gamePlayer = this.game.currentPlayer();
        startDock = Map.getInstance().docks[gamePlayer.id];
        if (startDock.containsPoint(e.offsetX, e.offsetY)) {
          return this.updateState(this.gamestate, "recording");
        }
      } else if (this.gamestate === "paused") {
        gamePlayer = this.game.currentPlayer();
        startDock = Map.getInstance().docks[gamePlayer.id];
        if (startDock.containsPoint(e.offsetX, e.offsetY)) {
          return this.updateState(this.gamestate, "ready");
        }
      }
    };

    Timeboats.prototype.onMouseMove = function(e) {
      var command, gamePlayer, startDock;
      $('#game-canvas')[0].style.cursor = 'default';
      if (this.gamestate === "recording") {
        command = new Command.MouseCommand(this.game.next_turn_id, e[0], e[1]);
        this.addCommand(this.command_history, command);
        return this.addCommand(this.active_commands, command);
      } else if ((this.document != null) && (this.gamestate === "init" || this.gamestate === "ready" || this.gamestate === "paused")) {
        gamePlayer = this.game.currentPlayer();
        startDock = Map.getInstance().docks[gamePlayer.id];
        if (startDock.containsPoint(e[0], e[1])) {
          return $('#game-canvas')[0].style.cursor = 'pointer';
        } else {
          return $('#game-canvas')[0].style.cursor = 'default';
        }
      }
    };

    return Timeboats;

  })();

}).call(this);

});

require.define("/state.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Map, Serializable, State;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  Serializable = require('./serializable.coffee').Serializable;

  Map = require('./map.coffee').Map;

  exports.State = State = (function() {

    __extends(State, Serializable);

    State.prototype.__type = 'State';

    function State(time) {
      this.time = time != null ? time : null;
      this.draw = __bind(this.draw, this);
      this.removeObject = __bind(this.removeObject, this);
      this.objects = {};
      this.commands = [];
      this.scores = {};
      this.gameover = false;
    }

    State.prototype.clone = function(time) {
      var id, object, scores, scoretype, st, value, _ref, _ref2;
      if (time == null) time = null;
      st = new State(time);
      st.gameover = this.gameover;
      _ref = this.scores;
      for (id in _ref) {
        scores = _ref[id];
        st.scores[id] = {};
        for (scoretype in scores) {
          value = scores[scoretype];
          st.scores[id][scoretype] = value;
        }
      }
      _ref2 = this.objects;
      for (id in _ref2) {
        object = _ref2[id];
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
      this.objects[id].leave(function() {
        return delete _this.objects[id];
      });
      return this.full_redraw = true;
    };

    State.prototype.addScore = function(id, score, scoretype) {
      console.log(id, score, scoretype);
      if (!(this.scores[id] != null)) this.scores[id] = {};
      if (!(this.scores[id][scoretype] != null)) this.scores[id][scoretype] = 0;
      return this.scores[id][scoretype] += score;
    };

    State.prototype.playerScores = function(mapping) {
      var id, player_id, ret, scores, scoretype, value, _ref;
      ret = {};
      _ref = this.scores;
      for (id in _ref) {
        scores = _ref[id];
        player_id = mapping[id];
        for (scoretype in scores) {
          value = scores[scoretype];
          if (!(ret[player_id] != null)) ret[player_id] = {};
          if (!(ret[player_id][scoretype] != null)) ret[player_id][scoretype] = 0;
          ret[player_id][scoretype] += value;
        }
      }
      return ret;
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

    State.prototype.drawRegions = function(context) {
      var id, object, region, _ref, _results;
      _ref = this.objects;
      _results = [];
      for (id in _ref) {
        object = _ref[id];
        region = object.redrawRegion();
        _results.push(Map.getInstance().drawRegion(context, {
          region: region
        }));
      }
      return _results;
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

    Serializable.prototype.afterDeserialize = function() {};

    Serializable.prototype.eachKey = function(key, value) {
      return;
    };

    Serializable.buildClassMap = function() {
      var object, objects, res, _i, _len;
      objects = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      res = {};
      for (_i = 0, _len = objects.length; _i < _len; _i++) {
        object = objects[_i];
        res[object.prototype.__type] = object;
      }
      return res;
    };

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
      var key, val, value;
      if ((object != null) && typeof object === 'object') {
        if (object.__type != null) {
          object.__proto__ = prototypes[object.__type].prototype;
        }
        for (key in object) {
          value = object[key];
          val = void 0;
          if (object.__type != null) val = object.eachKey(key, value);
          if (val === void 0 && typeof value === 'object') {
            this.deserialize(value, prototypes);
          } else if (val !== void 0) {
            object[key] = val;
          }
        }
        if (object.__type != null) return object.afterDeserialize();
      }
    };

    return Serializable;

  })();

}).call(this);

});

require.define("/map.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Checkpoint, Dock, GameObject, Gaussian, Map, MapCell, Mine, Point, Random;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  GameObject = require('./game_object').GameObject;

  MapCell = require('./map_cell.coffee').MapCell;

  Random = require('./random.coffee').Random;

  Gaussian = require('./gaussian.coffee').Gaussian;

  Point = require('./point.coffee').Point;

  Checkpoint = require('./checkpoint.coffee').Checkpoint;

  Dock = require('./dock.coffee').Dock;

  Mine = require('./mine.coffee').Mine;

  exports.Map = Map = (function() {
    var instance;

    __extends(Map, GameObject);

    Map.prototype.__type = 'Map';

    instance = null;

    Map.CELL_SIZE_PX = 8;

    Map.CLEAR_POSITION_BUFFER_CELLS = 4;

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
      this.frame_num = 0;
      this.last_computed_damage = 0;
      this.damages = [];
      this.checkpoints = [];
      this.docks = [];
      this.mines = [];
      Map.__super__.constructor.apply(this, arguments);
    }

    Map.prototype.clone = function() {
      return instance;
    };

    Map.prototype.update = function(dt, state) {
      var alpha, b, dock, g, landAlpha, o_b, o_g, o_r, playerId, r, waterAlpha, x, y, _ref, _ref2, _results;
      this.waterDt += dt;
      _ref = this.docks;
      for (playerId in _ref) {
        dock = _ref[playerId];
        dock.update(dt, state);
      }
      if (this.waterDt >= 1 / 10) {
        this.waterDt = 0;
        if (this.isInitialized) {
          _results = [];
          for (x = 0, _ref2 = this.width - 1; 0 <= _ref2 ? x <= _ref2 : x >= _ref2; 0 <= _ref2 ? x++ : x--) {
            _results.push((function() {
              var _ref3, _ref4, _results2;
              _results2 = [];
              for (y = 0, _ref3 = this.height - 1; 0 <= _ref3 ? y <= _ref3 : y >= _ref3; 0 <= _ref3 ? y++ : y--) {
                _ref4 = this.cells[x][y].getColor(), o_r = _ref4[0], o_g = _ref4[1], o_b = _ref4[2];
                this.cells[x][y].excitement *= 0.9;
                if (this.random.nextf() > 0.97) {
                  this.cells[x][y].excitement += -0.3 + this.random.nextf() * 0.6;
                }
                b = Math.floor(40 + this.cells[x][y].altitude * 10);
                r = Math.floor(b * 0.9);
                g = r;
                if (this.cells[x][y].altitude < this.waterLevel) {
                  alpha = 0.45 + this.cells[x][y].excitement * 0.3;
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
                if (r !== o_r || g !== o_g || b !== o_b) {
                  this.cells[x][y].dirty = true;
                  _results2.push(this.cells[x][y].setColor(r, g, b));
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

    Map.prototype.draw = function(context, options) {
      var b, cellX, cellY, g, r, x, y, _ref, _ref2, _ref3;
      if (options == null) options = {};
      if (this.isInitialized) {
        context.save();
        for (x = 0, _ref = this.width - 1; 0 <= _ref ? x <= _ref : x >= _ref; 0 <= _ref ? x++ : x--) {
          for (y = 0, _ref2 = this.height - 1; 0 <= _ref2 ? y <= _ref2 : y >= _ref2; 0 <= _ref2 ? y++ : y--) {
            if (options.full_redraw || this.cells[x][y].dirty) {
              this.cells[x][y].dirty = false;
              cellX = x * Map.CELL_SIZE_PX;
              cellY = y * Map.CELL_SIZE_PX;
              _ref3 = this.cells[x][y].getColor(), r = _ref3[0], g = _ref3[1], b = _ref3[2];
              context.fillStyle = "rgba(" + r + ", " + g + ", " + b + ", 1)";
              context.fillRect(cellX, cellY, Map.CELL_SIZE_PX, Map.CELL_SIZE_PX);
            }
          }
        }
        return context.restore();
      }
    };

    Map.prototype.drawNonTerrain = function(context) {
      var dock, playerId, _ref, _results;
      if (this.isInitialized) {
        _ref = this.docks;
        _results = [];
        for (playerId in _ref) {
          dock = _ref[playerId];
          _results.push(dock.draw(context));
        }
        return _results;
      }
    };

    Map.prototype.drawRegion = function(context, options) {
      var b, cellX, cellY, endX, endY, g, r, startX, startY, x, y, _ref;
      if (options == null) options = {};
      if (this.isInitialized) {
        context.save();
        startX = Math.max(0, Math.floor(options.region.x / Map.CELL_SIZE_PX));
        startY = Math.max(0, Math.floor(options.region.y / Map.CELL_SIZE_PX));
        endX = Math.min(startX + Math.ceil(options.region.width / Map.CELL_SIZE_PX), this.width - 1);
        endY = Math.min(startY + Math.ceil(options.region.height / Map.CELL_SIZE_PX), this.height - 1);
        for (x = startX; startX <= endX ? x <= endX : x >= endX; startX <= endX ? x++ : x--) {
          for (y = startY; startY <= endY ? y <= endY : y >= endY; startY <= endY ? y++ : y--) {
            cellX = x * Map.CELL_SIZE_PX;
            cellY = y * Map.CELL_SIZE_PX;
            try {
              _ref = this.cells[x][y].getColor(), r = _ref[0], g = _ref[1], b = _ref[2];
            } catch (error) {
              console.log(x, y, 'out of bounds', options, this.width, this.height);
              return;
            }
            context.fillStyle = "rgba(" + r + ", " + g + ", " + b + ", 1)";
            context.fillRect(cellX, cellY, Map.CELL_SIZE_PX, Map.CELL_SIZE_PX);
          }
        }
        return context.restore();
      }
    };

    Map.prototype.setRegionDirty = function(xStart, yStart, xFinish, yFinish) {
      var x, xCellFinish, xCellStart, y, yCellFinish, yCellStart;
      xCellStart = Math.max(0, this.getCellAt(xStart));
      yCellStart = Math.max(0, this.getCellAt(yStart));
      xCellFinish = Math.min(this.width - 1, this.getCellAt(xFinish));
      yCellFinish = Math.min(this.height - 1, this.getCellAt(yFinish));
      for (x = xCellStart; xCellStart <= xCellFinish ? x <= xCellFinish : x >= xCellFinish; xCellStart <= xCellFinish ? x++ : x--) {
        for (y = yCellStart; yCellStart <= yCellFinish ? y <= yCellFinish : y >= yCellFinish; yCellStart <= yCellFinish ? y++ : y--) {
          this.cells[x][y].dirty = true;
        }
      }
      return true;
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
          if (x < 0 || x >= this.width) continue;
          _results.push((function() {
            var _results2;
            _results2 = [];
            for (y = yStart; yStart <= yFinish ? y <= yFinish : y >= yFinish; yStart <= yFinish ? y++ : y--) {
              if (y < 0 || y >= this.height) continue;
              if (disturb && Point.getDistance(obj.x, obj.y, x * Map.CELL_SIZE_PX, y * Map.CELL_SIZE_PX) <= obj.radius) {
                this.cells[x][y].excitement = 0.7;
              }
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
      if (this.damages["f" + this.frame_num] != null) {
        return this.damages["f" + this.frame_num].push([x, y, radius]);
      } else {
        return this.damages["f" + this.frame_num] = [[x, y, radius]];
      }
    };

    Map.prototype.setFrame = function(num, overwrite) {
      if (overwrite == null) overwrite = false;
      this.frame_num = num;
      if (overwrite) return this.damages["f" + this.frame_num] = [];
    };

    Map.prototype.computeTerrainState = function(recompute) {
      var d, i, _i, _j, _len, _len2, _ref, _ref2, _ref3, _ref4, _ref5;
      if (recompute == null) recompute = true;
      if (!this.isInitialized) return;
      if (recompute) {
        console.log("recomputing terrain");
        this.resetTerrain();
        for (i = 0, _ref = this.frame_num; 0 <= _ref ? i <= _ref : i >= _ref; 0 <= _ref ? i++ : i--) {
          if (this.damages["f" + i] != null) {
            _ref2 = this.damages["f" + i];
            for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
              d = _ref2[_i];
              this.applyDamageGaussian(d[0], d[1], d[2]);
            }
          }
        }
      } else {
        for (i = _ref3 = this.last_computed_damage, _ref4 = this.frame_num; _ref3 <= _ref4 ? i <= _ref4 : i >= _ref4; _ref3 <= _ref4 ? i++ : i--) {
          if (this.damages["f" + i] != null) {
            _ref5 = this.damages["f" + i];
            for (_j = 0, _len2 = _ref5.length; _j < _len2; _j++) {
              d = _ref5[_j];
              this.applyDamageGaussian(d[0], d[1], d[2]);
            }
          }
        }
      }
      return this.last_computed_damage = this.frame_num;
    };

    Map.prototype.resetTerrain = function() {
      var x, y, _ref, _results;
      if (this.isInitialized) {
        _results = [];
        for (x = 0, _ref = this.width - 1; 0 <= _ref ? x <= _ref : x >= _ref; 0 <= _ref ? x++ : x--) {
          _results.push((function() {
            var _ref2, _results2;
            _results2 = [];
            for (y = 0, _ref2 = this.height - 1; 0 <= _ref2 ? y <= _ref2 : y >= _ref2; 0 <= _ref2 ? y++ : y--) {
              _results2.push(this.cells[x][y].reset());
            }
            return _results2;
          }).call(this));
        }
        return _results;
      }
    };

    Map.prototype.applyDamageGaussian = function(x, y, radius) {
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
                this.cells[xG][yG].altitude -= g.get2d(xG - x, yG - y) * 12.0;
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

    Map.prototype.generate = function(width, height, seed, players) {
      var ck, ckPosition, clear, col, collisionObjects, dock, i, m, mPosition, numCheckpoints, numGaussians, numMines, player, playerId, quadrantOffset, x, y, _ref, _ref2, _ref3, _ref4;
      this.width = width;
      this.height = height;
      this.random = new Random(seed);
      this.isInitialized = false;
      this.cells = [];
      this.checkpoints = [];
      this.docks = [];
      this.mines = [];
      for (x = 0, _ref = this.width - 1; 0 <= _ref ? x <= _ref : x >= _ref; 0 <= _ref ? x++ : x--) {
        col = [];
        for (y = 0, _ref2 = this.height - 1; 0 <= _ref2 ? y <= _ref2 : y >= _ref2; 0 <= _ref2 ? y++ : y--) {
          col.push(new MapCell(0));
        }
        this.cells.push(col);
      }
      this.swipeGaussian(22, 26, 30);
      this.swipeGaussian(22, 26, 30);
      numGaussians = 1 + this.random.next() % 3;
      for (i = 1; 1 <= numGaussians ? i <= numGaussians : i >= numGaussians; 1 <= numGaussians ? i++ : i--) {
        this.swipeGaussian(12, 18, 10 + this.random.next() % 15);
      }
      numGaussians = 1 + this.random.next() % 4;
      for (i = 1; 1 <= numGaussians ? i <= numGaussians : i >= numGaussians; 1 <= numGaussians ? i++ : i--) {
        this.swipeGaussian(8, 14, 14);
      }
      for (x = 0, _ref3 = this.width - 1; 0 <= _ref3 ? x <= _ref3 : x >= _ref3; 0 <= _ref3 ? x++ : x--) {
        for (y = 0, _ref4 = this.height - 1; 0 <= _ref4 ? y <= _ref4 : y >= _ref4; 0 <= _ref4 ? y++ : y--) {
          if (this.cells[x][y].altitude > this.waterLevel + 1 && (this.cells[x][y].altitude - this.waterLevel - 1) * 0.03 > this.random.nextf()) {
            this.cells[x][y].isPlant = true;
          }
          this.cells[x][y].altitude = Math.floor(this.cells[x][y].altitude);
          this.cells[x][y].saveInitialState();
        }
      }
      collisionObjects = [];
      quadrantOffset = this.random.next() % 4;
      for (playerId in players) {
        player = players[playerId];
        clear = this.getRandomClearPositionInQuadrant(player.color + quadrantOffset);
        dock = new Dock("dock" + playerId, clear.x * Map.CELL_SIZE_PX, clear.y * Map.CELL_SIZE_PX, player.color);
        this.docks[playerId] = dock;
        collisionObjects.push(dock);
      }
      numCheckpoints = 3;
      for (i = 1; 1 <= numCheckpoints ? i <= numCheckpoints : i >= numCheckpoints; 1 <= numCheckpoints ? i++ : i--) {
        ckPosition = this.getRandomClearPosition(collisionObjects);
        ck = new Checkpoint("checkpoint" + i, ckPosition.x * Map.CELL_SIZE_PX, ckPosition.y * Map.CELL_SIZE_PX);
        ck.y += 5;
        this.checkpoints.push(ck);
        collisionObjects.push(ck);
      }
      numMines = 8;
      for (i = 1; 1 <= numMines ? i <= numMines : i >= numMines; 1 <= numMines ? i++ : i--) {
        mPosition = this.getRandomClearPosition(collisionObjects);
        m = new Mine("mine" + i, mPosition.x * Map.CELL_SIZE_PX, mPosition.y * Map.CELL_SIZE_PX);
        this.mines.push(m);
      }
      return this.isInitialized = true;
    };

    Map.prototype.getRandomClearPosition = function(existingObjects) {
      var hasClearPosition, object, posX, posY, _i, _len;
      hasClearPosition = false;
      posX = 0;
      posY = 0;
      while (!hasClearPosition) {
        posX = Map.CLEAR_POSITION_BUFFER_CELLS + this.random.next() % (this.width - 2 * Map.CLEAR_POSITION_BUFFER_CELLS);
        posY = Map.CLEAR_POSITION_BUFFER_CELLS + this.random.next() % (this.height - 2 * Map.CLEAR_POSITION_BUFFER_CELLS);
        if (this.cells[posX][posY].altitude === 0) {
          hasClearPosition = true;
          for (_i = 0, _len = existingObjects.length; _i < _len; _i++) {
            object = existingObjects[_i];
            if (Point.getDistance(object.x, object.y, posX * Map.CELL_SIZE_PX, posY * Map.CELL_SIZE_PX) <= object.radius) {
              hasClearPosition = false;
              break;
            }
          }
        }
      }
      return {
        x: posX,
        y: posY
      };
    };

    Map.prototype.getRandomClearPositionInQuadrant = function(quadrant) {
      var halfHeight, halfWidth, hasClearPosition, posX, posY;
      quadrant = Math.floor(quadrant) % 4;
      hasClearPosition = false;
      posX = 0;
      posY = 0;
      halfWidth = this.width / 2;
      halfHeight = this.height / 2;
      while (!hasClearPosition) {
        posX = Map.CLEAR_POSITION_BUFFER_CELLS + this.random.next() % (this.width - 2 * Map.CLEAR_POSITION_BUFFER_CELLS);
        posY = Map.CLEAR_POSITION_BUFFER_CELLS + this.random.next() % (this.height - 2 * Map.CLEAR_POSITION_BUFFER_CELLS);
        if (this.cells[posX][posY].altitude === 0) {
          if (quadrant === 0 && posX > halfWidth && posY < halfHeight) {
            hasClearPosition = true;
          } else if (quadrant === 1 && posX < halfWidth && posY < halfHeight) {
            hasClearPosition = true;
          } else if (quadrant === 2 && posX < halfWidth && posY > halfHeight) {
            hasClearPosition = true;
          } else if (quadrant === 3 && posX > halfWidth && posY > halfHeight) {
            hasClearPosition = true;
          }
        }
      }
      return {
        x: posX,
        y: posY
      };
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
      this.saveInitialState();
      this.r = 0;
      this.g = 0;
      this.b = 0;
      MapCell.__super__.constructor.apply(this, arguments);
    }

    MapCell.prototype.setColor = function(r, g, b) {
      this.r = r;
      this.g = g;
      return this.b = b;
    };

    MapCell.prototype.getColor = function() {
      return [this.r, this.g, this.b];
    };

    MapCell.prototype.clone = function() {
      return new MapCell(this.altitude);
    };

    MapCell.prototype.saveInitialState = function() {
      this.initial_altitude = this.altitude;
      return this.initial_isPlant = this.isPlant;
    };

    MapCell.prototype.reset = function() {
      this.altitude = this.initial_altitude;
      return this.isPlant = this.initial_isPlant;
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

require.define("/checkpoint.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var AssetLoader, Checkpoint, GameObject2D, Goldsplosion, Point;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  GameObject2D = require('./game_object_2d.coffee').GameObject2D;

  AssetLoader = require('./asset_loader.coffee').AssetLoader;

  Point = require('./point.coffee').Point;

  Goldsplosion = require('./goldsplosion.coffee').Goldsplosion;

  exports.Checkpoint = Checkpoint = (function() {

    __extends(Checkpoint, GameObject2D);

    Checkpoint.prototype.__type = 'Checkpoint';

    function Checkpoint(id, x, y) {
      this.id = id;
      this.x = x;
      this.y = y;
      Checkpoint.__super__.constructor.call(this, this.id, this.x, this.y);
      this.frame = 0;
      this.dt = 0;
      this.yInitial = this.y;
      this.radius = 30;
      this.checked = false;
    }

    Checkpoint.prototype.clone = function() {
      var c;
      c = new Checkpoint(this.id, this.x, this.y);
      c.frame = this.frame;
      c.dt = this.dt;
      c.yInitial = this.yInitial;
      c.checked = this.checked;
      return c;
    };

    Checkpoint.prototype.update = function(dt, state) {
      var allChecked, id, object, _ref, _ref2, _ref3;
      this.dt += dt;
      if (this.dt >= 0.4) {
        this.dt = 0;
        this.frame++;
        this.frame %= 2;
      }
      this.ay = this.yInitial - this.y;
      _ref = state.objects;
      for (id in _ref) {
        object = _ref[id];
        if (object.__type === 'Square' && Point.getDistance(this.x + 21, this.y + 24, object.x, object.y) < this.radius) {
          state.addScore(object.id, 1, 'checkpoint');
          object.explode(state);
          this.checked = true;
          allChecked = false;
          if (this.checked) {
            allChecked = true;
            _ref2 = state.objects;
            for (id in _ref2) {
              object = _ref2[id];
              if (object.__type === 'Checkpoint' && !object.checked) {
                allChecked = false;
                break;
              }
            }
          }
          if (allChecked) {
            _ref3 = state.objects;
            for (id in _ref3) {
              object = _ref3[id];
              if (object.__type === 'Mine' && !object.isGold) {
                object.isGold = true;
                state.addObject("goldsplosion_check" + object.id, new Goldsplosion("goldsplosion_check" + object.id, object.x + 24, object.y + 6));
              }
            }
          }
          break;
        }
      }
      return Checkpoint.__super__.update.call(this, dt);
    };

    Checkpoint.prototype.draw = function(context) {
      var assetId;
      assetId = "";
      if (this.checked) {
        assetId = "checkpoint_checked" + this.frame;
      } else {
        assetId = "checkpoint" + this.frame;
      }
      return context.drawImage(AssetLoader.getInstance().getAsset(assetId), this.x, this.y, 43.5, 48);
    };

    return Checkpoint;

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

    function GameObject2D(id, x, y, vx, vy, rotation, radius, ax, ay) {
      this.id = id;
      this.x = x != null ? x : 0;
      this.y = y != null ? y : 0;
      this.vx = vx != null ? vx : 0;
      this.vy = vy != null ? vy : 0;
      this.rotation = rotation != null ? rotation : 0;
      this.radius = radius != null ? radius : 0;
      this.ax = ax != null ? ax : 0;
      this.ay = ay != null ? ay : 0;
      GameObject2D.__super__.constructor.call(this, this.id);
    }

    GameObject2D.prototype.clone = function() {
      return new GameObject2D(this.id, this.x, this.y, this.vx, this.vy, this.rotation, this.radius, this.ax, this.ay);
    };

    GameObject2D.prototype.setPos = function(x, y) {
      this.x = x;
      return this.y = y;
    };

    GameObject2D.prototype.setVel = function(vx, vy) {
      this.vx = vx;
      return this.vy = vy;
    };

    GameObject2D.prototype.setAcc = function(ax, ay) {
      this.ax = ax;
      return this.ay = ay;
    };

    GameObject2D.prototype.update = function(dt) {
      var newPos, newVel;
      newVel = Point.add(this.vx, this.vy, this.ax * dt, this.ay * dt);
      this.setVel(newVel.x, newVel.y);
      newPos = Point.add(this.x, this.y, this.vx * dt, this.vy * dt);
      return this.setPos(newPos.x, newPos.y);
    };

    GameObject2D.prototype.redrawRegion = function() {
      var region;
      return region = {
        x: this.x - this.radius * 2,
        y: this.y - this.radius * 2,
        width: this.radius * 4,
        height: this.radius * 4
      };
    };

    GameObject2D.prototype.containsPoint = function(x, y) {
      return Point.getDistance(x, y, this.x, this.y) < this.radius;
    };

    GameObject2D.prototype.collide = function(state) {
      this.vx = 0;
      return this.vy = 0;
    };

    return GameObject2D;

  })();

}).call(this);

});

require.define("/asset_loader.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var AssetLoader;

  exports.AssetLoader = AssetLoader = (function() {
    var assetsDirectory, instance;

    instance = null;

    assetsDirectory = "img/";

    AssetLoader.getInstance = function() {
      if (!(instance != null)) instance = new this;
      return instance;
    };

    AssetLoader.prototype.clone = function() {
      return instance;
    };

    function AssetLoader() {
      this.assets = [];
      this.loaded = [];
      this.urls = {
        checkpoint0: "checkpoint0.png",
        checkpoint1: "checkpoint1.png",
        checkpoint_checked0: "checkpoint_checked0.png",
        checkpoint_checked1: "checkpoint_checked1.png",
        dock: "dock.png",
        marker0: "marker0.png",
        marker1: "marker1.png",
        marker2: "marker2.png",
        marker3: "marker3.png",
        marker_shadow: "marker_shadow.png",
        smoke0: "smoke1.png",
        smoke1: "smoke2.png",
        smoke2: "circle4.png",
        go0: "go0.png",
        go1: "go1.png",
        getready0: "getready0.png",
        getready1: "getready1.png",
        mine0: "mine0.png",
        mine1: "mine1.png",
        boat0: "boat0.png",
        boat1: "boat1.png",
        boat2: "boat2.png",
        boat3: "boat3.png",
        gold: "gold.png",
        sparkle0: "sparkle0.png",
        sparkle1: "sparkle1.png"
      };
      this.numAssets = this.urls.length;
      this.numLoaded = 0;
    }

    AssetLoader.prototype.load = function() {
      var asset, url, _ref, _results;
      if (this.numLoaded === this.numAssets) return;
      _ref = this.urls;
      _results = [];
      for (asset in _ref) {
        url = _ref[asset];
        this.loaded[asset] = false;
        this.assets[asset] = new Image;
        this.assets[asset].name = asset;
        this.assets[asset].onLoad = function() {
          AssetLoader.getInstance().loaded[this.name] = true;
          return AssetLoader.getInstance().numLoaded++;
        };
        _results.push(this.assets[asset].src = assetsDirectory + url);
      }
      return _results;
    };

    AssetLoader.prototype.getAsset = function(name) {
      return this.assets[name];
    };

    return AssetLoader;

  })();

}).call(this);

});

require.define("/goldsplosion.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var AssetLoader, GameObject2D, Goldsplosion, Random;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  GameObject2D = require('./game_object_2d.coffee').GameObject2D;

  Random = require('./random.coffee').Random;

  AssetLoader = require('./asset_loader.coffee').AssetLoader;

  exports.Goldsplosion = Goldsplosion = (function() {

    __extends(Goldsplosion, GameObject2D);

    Goldsplosion.prototype.__type = 'Goldsplosion';

    function Goldsplosion(id, x, y) {
      this.id = id;
      this.x = x;
      this.y = y;
      Goldsplosion.__super__.constructor.call(this, this.id, this.x, this.y);
      this.lifespan = this.ttl = 0.4;
      this.seed = this.x + this.y + 42;
    }

    Goldsplosion.prototype.clone = function() {
      var exp;
      exp = new Goldsplosion(this.id, this.x, this.y);
      exp.lifespan = this.lifespan;
      exp.ttl = this.ttl;
      return exp;
    };

    Goldsplosion.prototype.update = function(dt, state) {
      this.ttl -= dt;
      Goldsplosion.__super__.update.call(this, dt, state);
      if (this.ttl <= 0) return state.removeObject(this.id);
    };

    Goldsplosion.prototype.draw = function(context) {
      var goldPositions, goldTypes, goldVelocity, halfsize, i, j, numGolds, random, size, _ref, _ref2, _ref3;
      context.save();
      random = new Random(this.seed);
      goldPositions = [];
      goldTypes = [];
      numGolds = 10;
      for (i = 0, _ref = numGolds - 1; 0 <= _ref ? i <= _ref : i >= _ref; 0 <= _ref ? i++ : i--) {
        goldPositions.push([-3.0 + random.nextf() * 6.0, -3.0 + random.nextf() * 6.0]);
        goldVelocity = [-4.0 + random.nextf() * 8.0, -4.0 + random.nextf() * 8.0];
        goldTypes.push(Math.floor(random.next() % 2));
        for (j = 0, _ref2 = (this.lifespan - this.ttl) * 60 * this.lifespan; 0 <= _ref2 ? j <= _ref2 : j >= _ref2; 0 <= _ref2 ? j++ : j--) {
          goldPositions[i][0] += goldVelocity[0];
          goldPositions[i][1] += goldVelocity[1];
        }
      }
      context.translate(this.x, this.y);
      context.globalAlpha = 0.85 * (this.ttl / this.lifespan);
      console.log(goldTypes[0], goldTypes[1], goldTypes[2], goldTypes[3], goldTypes[4], goldTypes[5], goldTypes[6], goldTypes[7], goldTypes[8], goldTypes[9]);
      for (i = 0, _ref3 = numGolds - 1; 0 <= _ref3 ? i <= _ref3 : i >= _ref3; 0 <= _ref3 ? i++ : i--) {
        size = halfsize = 0;
        if (goldTypes[i] === 0) {
          size = 15;
          halfsize = 7;
        } else {
          size = 7;
          halfsize = 3;
        }
        context.drawImage(AssetLoader.getInstance().getAsset("sparkle" + goldTypes[i]), goldPositions[i][0] - halfsize, goldPositions[i][1] - halfsize, size, size);
      }
      return context.restore();
    };

    return Goldsplosion;

  })();

}).call(this);

});

require.define("/dock.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var AssetLoader, Dock, GameObject2D;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  GameObject2D = require('./game_object_2d.coffee').GameObject2D;

  AssetLoader = require('./asset_loader.coffee').AssetLoader;

  exports.Dock = Dock = (function() {

    __extends(Dock, GameObject2D);

    Dock.prototype.__type = 'Dock';

    function Dock(id, x, y, color) {
      this.id = id;
      this.x = x;
      this.y = y;
      this.color = color;
      Dock.__super__.constructor.call(this, this.id, this.x, this.y);
      this.frame = 0;
      this.dt = 0;
      this.alpha = 1;
      this.radius = 48;
      this.active = null;
    }

    Dock.prototype.clone = function() {
      var c;
      c = new Dock(this.id, this.x, this.y, this.color);
      c.frame = this.frame;
      c.dt = this.dt;
      c.alpha = this.alpha;
      return c;
    };

    Dock.prototype.update = function(dt, state) {
      this.dt += dt;
      if (this.dt >= 0.4) {
        this.dt = 0;
        if (this.active != null) {
          this.frame++;
          this.frame %= 2;
        }
      }
      if (this.alpha > 0.5) this.alpha -= 0.25 * dt;
      return Dock.__super__.update.call(this, dt);
    };

    Dock.prototype.draw = function(context) {
      context.save();
      context.drawImage(AssetLoader.getInstance().getAsset("dock"), this.x - 38, this.y - 23, 76, 46);
      if (this.frame === 0) {
        context.drawImage(AssetLoader.getInstance().getAsset("marker" + this.color), this.x - 12, this.y - 32, 24, 12);
        context.drawImage(AssetLoader.getInstance().getAsset("marker_shadow"), this.x - 28, this.y, 26, 11);
      } else {
        context.drawImage(AssetLoader.getInstance().getAsset("marker" + this.color), this.x - 12, this.y - 26, 24, 12);
        context.drawImage(AssetLoader.getInstance().getAsset("marker_shadow"), this.x - 26, this.y - 4, 26, 11);
      }
      if (this.active === 'ready') {
        context.drawImage(AssetLoader.getInstance().getAsset("getready" + this.frame), this.x - 15, this.y + 28, 30, 24);
      } else if (this.active === 'go') {
        context.drawImage(AssetLoader.getInstance().getAsset("go" + this.frame), this.x - 15, this.y + 23, 30, 24);
      }
      return context.restore();
    };

    return Dock;

  })();

}).call(this);

});

require.define("/mine.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var AssetLoader, GameObject2D, Goldsplosion, Mine, Point, Random;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  GameObject2D = require('./game_object_2d.coffee').GameObject2D;

  AssetLoader = require('./asset_loader.coffee').AssetLoader;

  Point = require('./point.coffee').Point;

  Random = require('./random.coffee').Random;

  Goldsplosion = require('./goldsplosion.coffee').Goldsplosion;

  exports.Mine = Mine = (function() {

    __extends(Mine, GameObject2D);

    Mine.prototype.__type = 'Mine';

    function Mine(id, x, y) {
      this.id = id;
      this.x = x;
      this.y = y;
      Mine.__super__.constructor.call(this, this.id, this.x, this.y);
      this.frame = 0;
      this.dt = new Random(this.x + this.y).nextf();
      this.dtTotal = this.dt;
      this.radius = 15;
      this.isGold = false;
    }

    Mine.prototype.clone = function() {
      var c;
      c = new Mine(this.id, this.x, this.y);
      c.frame = this.frame;
      c.dt = this.dt;
      c.dtTotal = this.dtTotal;
      c.isGold = this.isGold;
      c.vx = this.vx;
      return c;
    };

    Mine.prototype.update = function(dt, state) {
      var gold, id, object, rand, _ref, _ref2;
      this.dt += dt;
      this.dtTotal += dt;
      if (this.dt >= 0.4) {
        this.dt = 0;
        this.frame++;
        this.frame %= 2;
      }
      _ref = state.objects;
      for (id in _ref) {
        object = _ref[id];
        if (object.__type === 'Square' && Point.getDistance(this.x + 16, this.y + 16, object.x, object.y) < this.radius) {
          if (!this.isGold) {
            object.explode(state);
          } else {
            state.addScore(object.id, 1, 'gold');
            state.addObject("goldsplosion" + this.id, new Goldsplosion("goldsplosion" + this.id, this.x + 24, this.y + 6));
          }
          state.removeObject(this.id);
          gold = 0;
          _ref2 = state.objects;
          for (id in _ref2) {
            object = _ref2[id];
            if (object.__type === 'Mine') {
              gold++;
              break;
            }
          }
          if (gold === 0) state.gameover = true;
          break;
        }
      }
      rand = new Random(Math.floor(this.x + this.y + this.dtTotal * 10000));
      if (rand.nextf() < 0.15) this.vx += -7.0 + rand.nextf() * 14.0;
      this.vx *= 0.999;
      return Mine.__super__.update.call(this, dt);
    };

    Mine.prototype.draw = function(context) {
      if (this.isGold) {
        return context.drawImage(AssetLoader.getInstance().getAsset("gold"), this.x - 5, this.y, 37, 27);
      } else {
        return context.drawImage(AssetLoader.getInstance().getAsset("mine" + this.frame), this.x, this.y, 31, 31);
      }
    };

    return Mine;

  })();

}).call(this);

});

require.define("/square.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var AssetLoader, Explosion, GameObject2D, Map, Point, Square;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  GameObject2D = require('./game_object_2d.coffee').GameObject2D;

  Point = require('./point.coffee').Point;

  Explosion = require('./explosion.coffee').Explosion;

  Map = require('./map.coffee').Map;

  AssetLoader = require('./asset_loader.coffee').AssetLoader;

  exports.Square = Square = (function() {

    __extends(Square, GameObject2D);

    Square.prototype.__type = 'Square';

    function Square(id, x, y, size, color, playerId) {
      this.id = id;
      this.x = x;
      this.y = y;
      this.size = size;
      this.color = color != null ? color : 0;
      this.playerId = playerId != null ? playerId : 0;
      Square.__super__.constructor.call(this, this.id, this.x, this.y, 0, 0, -1.57);
      this.destx = this.x;
      this.desty = this.y;
      this.radius = (this.size / 2) - 5;
      this.invincibleTime = 1.0;
    }

    Square.prototype.clone = function() {
      var sq;
      sq = new Square(this.id, this.x, this.y, this.size, this.color);
      sq.rotation = this.rotation;
      sq.vx = this.vx;
      sq.vy = this.vy;
      sq.destx = this.destx;
      sq.desty = this.desty;
      sq.invincibleTime = this.invincibleTime;
      sq.playerId = this.playerId;
      return sq;
    };

    Square.prototype.explode = function(state) {
      var explosion, id;
      if (this.invincibleTime > 0) return;
      id = Math.floor(Math.random() * 1000000);
      explosion = new Explosion(id, this.x, this.y, 80);
      state.addObject(id, explosion);
      Map.getInstance().collideWith(explosion, state, true);
      state.removeObject(this.id);
      return state.addScore(this.id, 1, 'boat');
    };

    Square.prototype.setVel = function(vx, vy) {
      Square.__super__.setVel.call(this, vx, vy);
      if (this.vx !== 0 || this.vy !== 0) {
        return this.rotation = Point.getAngle(this.vx, this.vy);
      }
    };

    Square.prototype.update = function(dt, state) {
      var dir, dist, to_move;
      dir = Point.subtract(this.destx, this.desty, this.x, this.y);
      dist = Point.getLength(dir.x, dir.y);
      if (this.invincibleTime > 0) {
        this.invincibleTime -= 0.7 * dt;
        if (Point.getDistance(this.x, this.y, Map.getInstance().docks[this.playerId].x, Map.getInstance().docks[this.playerId].y) > 60) {
          this.invincibleTime = 0;
        }
      }
      to_move = Point.normalize(dir.x, dir.y, Math.sqrt(dist) * dt * 5000);
      if (dist < 0.5) {
        to_move = {
          x: 0,
          y: 0
        };
        this.setPos(this.destx, this.desty);
      }
      this.setAcc(to_move.x, to_move.y);
      this.vx *= (0.98 * 60) * dt;
      this.vy *= (0.98 * 60) * dt;
      Map.getInstance().collideWith(this, state, true);
      return Square.__super__.update.call(this, dt, state);
    };

    Square.prototype.draw = function(context, options) {
      if (this.invincibleTime > 0 && (Math.floor(this.invincibleTime * 15) % 2 === 1)) {
        return;
      }
      context.save();
      if ((options != null) && options.dim) context.globalAlpha = 0.5;
      context.translate(this.x, this.y);
      context.rotate(this.rotation);
      context.drawImage(AssetLoader.getInstance().getAsset("boat" + this.color), -this.size / 2, -this.size / 2, this.size, this.size);
      return context.restore();
    };

    Square.prototype.collide = function(state) {
      return this.explode(state);
    };

    return Square;

  })();

}).call(this);

});

require.define("/explosion.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var AssetLoader, Explosion, GameObject2D, Map, Point, Random;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  GameObject2D = require('./game_object_2d.coffee').GameObject2D;

  Point = require('./point.coffee').Point;

  Map = require('./map.coffee').Map;

  Random = require('./random.coffee').Random;

  AssetLoader = require('./asset_loader.coffee').AssetLoader;

  exports.Explosion = Explosion = (function() {

    __extends(Explosion, GameObject2D);

    Explosion.prototype.__type = 'Explosion';

    function Explosion(id, x, y, max_radius) {
      this.id = id;
      this.x = x;
      this.y = y;
      this.max_radius = max_radius;
      Explosion.__super__.constructor.call(this, this.id, this.x, this.y);
      this.lifespan = this.ttl = 0.4;
      this.seed = this.x + this.y + this.id;
      this.radius = this.max_radius;
      Map.getInstance().damageAt(this.x, this.y, this.max_radius);
    }

    Explosion.prototype.clone = function() {
      var exp;
      exp = new Explosion(this.id, this.x, this.y, this.max_radius);
      exp.lifespan = this.lifespan;
      exp.ttl = this.ttl;
      return exp;
    };

    Explosion.prototype.update = function(dt, state) {
      var dist, id, object, _ref;
      this.ttl -= dt;
      _ref = state.objects;
      for (id in _ref) {
        object = _ref[id];
        if (object.__type === 'Square') {
          dist = Point.getDistance(this.x, this.y, object.x, object.y);
          if (dist < this.max_radius * 0.3) {
            object.explode(state);
          } else if (dist < this.max_radius) {
            object.vx += (object.x - this.x) * 0.25;
            object.vy += (object.y - this.y) * 0.25;
          }
        }
      }
      Explosion.__super__.update.call(this, dt, state);
      if (this.ttl <= 0) return state.removeObject(this.id);
    };

    Explosion.prototype.draw = function(context) {
      var i, j, numSmokes, random, size, smokePositions, smokeScales, smokeTypes, smokeVelocity, _ref, _ref2, _ref3;
      context.save();
      random = new Random(this.seed);
      smokePositions = [];
      smokeScales = [];
      smokeTypes = [];
      numSmokes = 10;
      for (i = 0, _ref = numSmokes - 1; 0 <= _ref ? i <= _ref : i >= _ref; 0 <= _ref ? i++ : i--) {
        smokePositions.push([-3.0 + random.nextf() * 6.0, -3.0 + random.nextf() * 6.0]);
        smokeVelocity = [-4.0 + random.nextf() * 8.0, -4.0 + random.nextf() * 8.0];
        smokeTypes.push(Math.floor(random.next() % 3));
        if (smokeTypes[i] < 2) {
          smokeScales.push(0.2 + random.nextf() * 0.3);
        } else {
          smokeScales.push(0.1 + random.nextf() * 0.15);
        }
        for (j = 0, _ref2 = (this.lifespan - this.ttl) * 60 * this.lifespan; 0 <= _ref2 ? j <= _ref2 : j >= _ref2; 0 <= _ref2 ? j++ : j--) {
          smokePositions[i][0] += smokeVelocity[0];
          smokePositions[i][1] += smokeVelocity[1];
          smokeScales[i] *= 1.05;
        }
      }
      context.translate(this.x, this.y);
      context.globalAlpha = 0.7 * (this.ttl / this.lifespan);
      for (i = 0, _ref3 = numSmokes - 1; 0 <= _ref3 ? i <= _ref3 : i >= _ref3; 0 <= _ref3 ? i++ : i--) {
        size = 64 * smokeScales[i];
        context.drawImage(AssetLoader.getInstance().getAsset("smoke" + smokeTypes[i]), smokePositions[i][0] - size / 2, smokePositions[i][1] - size / 2, size, size);
      }
      return context.restore();
    };

    return Explosion;

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

require.define("/menu_boats.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var AssetLoader, Map, MenuBoats;

  Map = require('./map.coffee').Map;

  AssetLoader = require('./asset_loader.coffee').AssetLoader;

  exports.MenuBoats = MenuBoats = (function() {

    function MenuBoats(canvas, context, width, height, document) {
      this.canvas = canvas;
      this.context = context;
      this.width = width;
      this.height = height;
      this.document = document != null ? document : null;
      this.timestep = 1 / 60;
      this.renderstep = 1 / 60;
      Map.getInstance().generate(this.width / Map.CELL_SIZE_PX, this.height / Map.CELL_SIZE_PX, new Date().getTime(), []);
      this.full_redraw = false;
      if (this.document != null) {
        this.m_canvas = this.document.createElement('canvas');
        this.m_canvas.width = this.width;
        this.m_canvas.height = this.height;
        this.m_context = this.m_canvas.getContext('2d');
      } else {
        this.m_canvas = null;
      }
      console.log(Map.getInstance());
    }

    MenuBoats.prototype.update = function(dt) {
      return Map.getInstance().update(dt);
    };

    MenuBoats.prototype.draw = function() {
      Map.getInstance().draw(this.m_context, {
        full_redraw: this.full_redraw
      });
      this.full_redraw = false;
      return this.context.drawImage(this.m_canvas, 0, 0);
    };

    return MenuBoats;

  })();

}).call(this);

});

require.define("/turns.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Game, GameRenderer, Map, Player, Serializable, Turn, UUID;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  Serializable = require('./serializable.coffee').Serializable;

  UUID = require('./lib/uuid.js');

  Map = require('./map.coffee').Map;

  exports.Player = Player = (function() {

    __extends(Player, Serializable);

    Player.prototype.__type = 'Player';

    function Player(id, color, nickname) {
      this.id = id != null ? id : null;
      this.color = color != null ? color : 0;
      this.nickname = nickname != null ? nickname : null;
      if (!(this.id != null)) this.id = UUID.generate();
      if (!(this.nickname != null)) {
        this.nickname = ("" + this.id).substring(0, 10);
      }
      this.score = 0;
      Player.__super__.constructor.apply(this, arguments);
    }

    return Player;

  })();

  GameRenderer = (function() {

    function GameRenderer() {}

    GameRenderer.render = function(game) {
      var active_turn, player, player_idx, turn, turn_idx, _ref, _ref2;
      $('#turn_tiles').html('');
      $('#player_tiles').html('');
      if (game.order.length > 0) {
        for (player_idx = 0, _ref = game.order.length; 0 <= _ref ? player_idx < _ref : player_idx > _ref; 0 <= _ref ? player_idx++ : player_idx--) {
          player = game.getPlayerByIndex(player_idx);
          this.renderPlayerTile(player, false, false);
        }
        this.renderPlayerTile(game.currentPlayer(), true, true);
      }
      if (game.turns.length > 0) {
        console.log(game.turns);
        for (turn_idx = 0, _ref2 = game.turns.length; 0 <= _ref2 ? turn_idx < _ref2 : turn_idx > _ref2; 0 <= _ref2 ? turn_idx++ : turn_idx--) {
          turn = game.getTurnByIndex(turn_idx);
          this.renderTurnTile(turn, turn_idx, game, false, false);
        }
        active_turn = game.getTurnByIndex(game.turn_idx);
        return this.renderTurnTile(active_turn, game.turn_idx, game, true, true);
      }
    };

    GameRenderer.renderTurnTile = function(turn, number, game, active, update) {
      var html;
      if (active == null) active = false;
      if (update == null) update = true;
      html = new EJS({
        element: 'turn_template'
      }).render({
        active: active ? 'active' : '',
        id: turn.id,
        player_name: game.players[turn.player_id].color,
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

    GameRenderer.renderPlayerTile = function(player, active, update) {
      var html;
      if (active == null) active = false;
      if (update == null) update = true;
      html = new EJS({
        element: 'player_template'
      }).render({
        active: active ? 'active' : '',
        id: player.id,
        name: player.color,
        score: player.score
      });
      if (update) {
        return $('#' + player.id).replaceWith(html);
      } else {
        return $('#player_tiles').append($(html));
      }
    };

    return GameRenderer;

  })();

  exports.Game = Game = (function() {

    __extends(Game, Serializable);

    Game.prototype.__type = 'Game';

    function Game(id, players, order, turns) {
      this.id = id != null ? id : null;
      this.players = players != null ? players : {};
      this.order = order != null ? order : [];
      this.turns = turns != null ? turns : [];
      this.render = __bind(this.render, this);
      if (!(this.id != null)) this.id = UUID.generate();
      this.next_turn_id = UUID.generate();
      this.current_player_id = 0;
      this.turn_idx = 0;
      console.log('constructor');
      Game.__super__.constructor.apply(this, arguments);
    }

    Game.prototype.afterDeserialize = function() {
      this.next_turn_id = UUID.generate();
      return console.log('afterDeserialize');
    };

    Game.prototype.render = function() {
      return GameRenderer.render(this);
    };

    Game.prototype.setMap = function(seed) {
      return this.mapSeed = seed;
    };

    Game.prototype.addPlayer = function(player) {
      this.players[player.id] = player;
      this.order.push(player.id);
      console.log('addPlayer');
      return this.render();
    };

    Game.prototype.getPlayerByIndex = function(idx) {
      return this.players[this.order[idx]];
    };

    Game.prototype.currentPlayer = function() {
      return this.getPlayerByIndex(this.current_player_id);
    };

    Game.prototype.turnsToPlayers = function() {
      var ret, turn, _i, _len, _ref;
      ret = {};
      _ref = this.turns;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        turn = _ref[_i];
        ret[turn.id] = turn.player_id;
      }
      return ret;
    };

    Game.prototype.setScores = function(scoremap, time) {
      var boats, checkpoints, gold, player_id, score, scores, _results;
      _results = [];
      for (player_id in scoremap) {
        scores = scoremap[player_id];
        boats = scores['boat'] || 0;
        checkpoints = scores['checkpoint'] || 0;
        gold = scores['gold'] || 0;
        score = this.computeScore(time, checkpoints, boats, gold);
        _results.push(this.players[player_id].score = score);
      }
      return _results;
    };

    Game.prototype.computeScore = function(time, checkpoints, boats, gold) {
      return gold + checkpoints + boats;
    };

    Game.prototype.recordTurn = function(commands) {
      var turn;
      turn = new Turn(this.next_turn_id, this.currentPlayer().id, commands);
      this.turns.push(turn);
      this.turn_idx = this.latestTurnNumber();
      this.render();
      return turn;
    };

    Game.prototype.getTurnByIndex = function(idx) {
      return this.turns[idx];
    };

    Game.prototype.latestTurnNumber = function() {
      return this.turns.length - 1;
    };

    Game.prototype.isLatestTurn = function() {
      return this.turn_idx === this.turns.length - 1;
    };

    Game.prototype.setTurn = function(turn_num) {
      if (turn_num < 0 || turn_num >= this.turns.length) return;
      this.turn_idx = turn_num;
      console.log('setTurn');
      return this.render();
    };

    Game.prototype.nextTurn = function() {
      if (this.current_player_id >= this.order.length - 1) {
        this.current_player_id = 0;
      } else {
        this.current_player_id++;
      }
      this.next_turn_id = UUID.generate();
      console.log('nextTurn');
      return this.render();
    };

    Game.prototype.computeCommands = function() {
      var command_idx, commands, turn_i, _ref, _ref2;
      if (this.turns.length === 0) return [];
      commands = [];
      for (turn_i = 0, _ref = this.turn_idx; 0 <= _ref ? turn_i <= _ref : turn_i >= _ref; 0 <= _ref ? turn_i++ : turn_i--) {
        for (command_idx = 0, _ref2 = this.turns[turn_i].commands.length; 0 <= _ref2 ? command_idx < _ref2 : command_idx > _ref2; 0 <= _ref2 ? command_idx++ : command_idx--) {
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

    Turn.prototype.__type = 'Turn';

    function Turn(id, player_id, commands, time) {
      this.id = id != null ? id : null;
      this.player_id = player_id;
      this.commands = commands;
      this.time = time != null ? time : null;
      if (this.time === null || !(this.time != null)) this.time = new Date();
      if (!(this.id != null)) this.id = UUID.generate();
      Turn.__super__.constructor.apply(this, arguments);
    }

    Turn.prototype.eachKey = function(key, value) {
      if (key === 'time') return new Date(value);
      return;
    };

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

require.define("/api.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var API, Command, Explosion, GameObject, GameObject2D, LocalAPI, RemoteAPI, Serializable, Square, State, Turns, async, classmap;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; }, __indexOf = Array.prototype.indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (__hasProp.call(this, i) && this[i] === item) return i; } return -1; };

  Turns = require('./turns.coffee');

  GameObject = require('./game_object.coffee').GameObject;

  GameObject2D = require('./game_object_2d.coffee').GameObject2D;

  Explosion = require('./explosion.coffee').Explosion;

  State = require('./state.coffee').State;

  Square = require('./square.coffee').Square;

  Command = require('./command.coffee');

  Serializable = require('./serializable.coffee').Serializable;

  async = require('./lib/async.js');

  classmap = null;

  API = API = (function() {

    function API(username, token) {
      this.username = username;
      this.token = token;
    }

    API.prototype.gameIds = function(cb) {
      return cb(false, []);
    };

    API.prototype.getGames = function(cb) {
      return cb(false, []);
    };

    API.prototype.getGame = function(id, cb) {
      return cb(true, null);
    };

    API.prototype.saveGame = function(game, cb) {
      return cb(true, null);
    };

    return API;

  })();

  LocalAPI = LocalAPI = (function() {

    __extends(LocalAPI, API);

    function LocalAPI(username, token) {
      var _this = this;
      this.username = username;
      this.token = token;
      this.saveGame = __bind(this.saveGame, this);
      this.getGames = __bind(this.getGames, this);
      this.getGame = __bind(this.getGame, this);
      this.gameIds = __bind(this.gameIds, this);
      this.gameIdsKey = __bind(this.gameIdsKey, this);
      this.gamesKey = __bind(this.gamesKey, this);
      this.save = __bind(this.save, this);
      this.load = __bind(this.load, this);
      LocalAPI.__super__.constructor.call(this, this.username, this.token);
      this.getGames(function(err, games) {
        if (err) {
          alert("Couldn't start API");
          return;
        }
        if (!games) {
          _this.save(_this.gamesKey(), {});
          return _this.save(_this.gameIdsKey(), []);
        }
      });
    }

    LocalAPI.prototype.load = function(key) {
      var item;
      item = window.localStorage.getItem(key);
      item = JSON.parse(item);
      Serializable.deserialize(item, classmap);
      return item;
    };

    LocalAPI.prototype.save = function(key, value) {
      return window.localStorage.setItem(key, JSON.stringify(value));
    };

    LocalAPI.prototype.gamesKey = function() {
      return this.username + '!!!games';
    };

    LocalAPI.prototype.gameIdsKey = function() {
      return this.username + '!!!game_ids';
    };

    LocalAPI.prototype.gameIds = function(cb) {
      return cb(false, this.load(this.gameIdsKey()));
    };

    LocalAPI.prototype.getGame = function(id, cb) {
      var _this = this;
      return this.getGames(function(err, games) {
        if (err) return cb(err, null);
        return cb(false, games[id]);
      });
    };

    LocalAPI.prototype.getGames = function(cb) {
      return cb(false, this.load(this.gamesKey()));
    };

    LocalAPI.prototype.saveGame = function(game, cb) {
      var _this = this;
      return async.parallel({
        game_ids: this.gameIds,
        games: this.getGames
      }, function(err, data) {
        var game_ids, games, _ref;
        if (err) return cb(err, null);
        game_ids = data.game_ids;
        games = data.games;
        if (!(_ref = game.id, __indexOf.call(game_ids, _ref) >= 0)) {
          game_ids.push(game.id);
          _this.save(_this.gameIdsKey(), game_ids);
        }
        games[game.id] = game;
        _this.save(_this.gamesKey(), games);
        return cb(false, true);
      });
    };

    return LocalAPI;

  })();

  RemoteAPI = RemoteAPI = (function() {

    __extends(RemoteAPI, API);

    function RemoteAPI(host, username, token) {
      this.host = host;
      this.username = username;
      this.token = token;
      RemoteAPI.__super__.constructor.call(this, this.username, this.token);
    }

    RemoteAPI.prototype.request = function(method, params, callback) {
      var url;
      url = this.host + method + '?' + $.params + '&callback=?';
      return $.getJSON(url, function(data) {
        return callback(data);
      });
    };

    RemoteAPI.prototype.gameIds = function(cb) {
      var url;
      url = this.host + '/gameIds?callback=?';
      return $.getJSON(url, function(data) {
        return cb(data);
      });
    };

    RemoteAPI.prototype.getGames = function(cb) {
      var url;
      url = this.host + '/games?callback=?';
      return $.getJSON(url, function(data) {
        return cb(data);
      });
    };

    RemoteAPI.prototype.getGame = function(id, cb) {
      var url;
      url = this.host + '/games/' + id + '?callback=?';
      return $.getJSON(url, function(data) {
        return cb(data);
      });
    };

    RemoteAPI.prototype.saveGame = function(game, cb) {
      var url;
      url = this.host + '/games/save?callback=?';
      return $.post(url, JSON.stringify(game), (function(data) {
        return cb(data);
      }), 'json');
    };

    return RemoteAPI;

  })();

  classmap = Serializable.buildClassMap(Turns.Game, Turns.Turn, Turns.Player, GameObject, GameObject2D, Explosion, State, Square, Command.Command, Command.MouseCommand, Command.JoinCommand, Command.ExplodeCommand);

  exports.API = API;

  exports.LocalAPI = LocalAPI;

}).call(this);

});

require.define("/lib/async.js", function (require, module, exports, __dirname, __filename) {
    /*global setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root = this,
        previous_async = root.async;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    else {
        root.async = async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    //// cross-browser compatiblity functions ////

    var _forEach = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _forEach(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _forEach(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    var _indexOf = function (arr, item) {
        if (arr.indexOf) {
            return arr.indexOf(item);
        }
        for (var i = 0; i < arr.length; i += 1) {
            if (arr[i] === item) {
                return i;
            }
        }
        return -1;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        async.nextTick = function (fn) {
            setTimeout(fn, 0);
        };
    }
    else {
        async.nextTick = process.nextTick;
    }

    async.forEach = function (arr, iterator, callback) {
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _forEach(arr, function (x) {
            iterator(x, function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed === arr.length) {
                        callback();
                    }
                }
            });
        });
    };

    async.forEachSeries = function (arr, iterator, callback) {
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed === arr.length) {
                        callback();
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };
    
    async.forEachLimit = function (arr, limit, iterator, callback) {
        if (!arr.length || limit <= 0) {
            return callback(); 
        }
        var completed = 0;
        var started = 0;
        var running = 0;
        
        (function replenish () {
          if (completed === arr.length) {
              return callback();
          }
          
          while (running < limit && started < arr.length) {
            iterator(arr[started], function (err) {
              if (err) {
                  callback(err);
                  callback = function () {};
              }
              else {
                  completed += 1;
                  running -= 1;
                  if (completed === arr.length) {
                      callback();
                  }
                  else {
                      replenish();
                  }
              }
            });
            started += 1;
            running += 1;
          }
        })();
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.forEach].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.forEachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (err, v) {
                results[x.index] = v;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);


    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.forEachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.forEach(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.forEach(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        if (!keys.length) {
            return callback(null);
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            _forEach(listeners, function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (_keys(results).length === keys.length) {
                callback(null, results);
            }
        });

        _forEach(keys, function (k) {
            var task = (tasks[k] instanceof Function) ? [tasks[k]]: tasks[k];
            var taskCallback = function (err) {
                if (err) {
                    callback(err);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    taskComplete();
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.waterfall = function (tasks, callback) {
        if (!tasks.length) {
            return callback();
        }
        callback = callback || function () {};
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.nextTick(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    async.parallel = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            async.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.forEach(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.forEachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.queue = function (worker, concurrency) {
        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
                q.tasks.push({data: data, callback: callback});
                if(q.saturated && q.tasks.length == concurrency) q.saturated();
                async.nextTick(q.process);
            },
            process: function () {
                if (workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if(q.empty && q.tasks.length == 0) q.empty();
                    workers += 1;
                    worker(task.data, function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if(q.drain && q.tasks.length + workers == 0) q.drain();
                        q.process();
                    });
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            }
        };
        return q;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _forEach(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                callback.apply(null, memo[key]);
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      }
    };

}());
});

require.define("/client.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var API, MenuBoats, Timeboats, Turns, UUID, async, drawGames, game_canvas, game_context, load, loaded, menu_canvas, menu_context, old_render, old_render_menu, render, render_menu, timestamp, unload;

  Timeboats = require('./timeboats.coffee').Timeboats;

  MenuBoats = require('./menu_boats.coffee').MenuBoats;

  Turns = require('./turns.coffee');

  API = require('./api.coffee');

  UUID = require('./lib/uuid.js');

  async = require('./lib/async.js');

  loaded = false;

  render = false;

  render_menu = true;

  menu_canvas = null;

  menu_context = null;

  game_canvas = null;

  game_context = null;

  timestamp = function() {
    return +new Date();
  };

  drawGames = function(game_ids, games, api) {
    var html;
    html = new EJS({
      element: 'games_template',
      type: '<'
    }).render({
      games: games,
      game_ids: game_ids
    });
    $('#games').html(html);
    return $('#games .game').click(function(e) {
      var id;
      id = $(e.target).attr('data');
      return window.gameClicked(id);
    });
  };

  load = function() {
    var api, dt, frame, frame_num, game, gdt, last, menu_boats, rdt, timeboats;
    var _this = this;
    loaded = true;
    api = new API.LocalAPI('chris', null);
    if (typeof pokki !== "undefined" && pokki !== null) {
      pokki.setPopupClientSize(900, 627);
    }
    menu_boats = new MenuBoats(menu_canvas, menu_context, menu_canvas.width, menu_canvas.height, window.document);
    $("#menu-canvas").fadeIn(1000, function() {
      $("#menu").fadeIn(1000);
      $("#controls_placeholder").fadeIn(1000);
      return $("#instructions_right").fadeIn(1000);
    });
    game = null;
    timeboats = null;
    $('#newgame').click(function() {
      var order, player1, player2, players;
      render = false;
      player1 = new Turns.Player(1, 0);
      player2 = new Turns.Player(2, 1);
      players = {
        1: player1,
        2: player2
      };
      order = [1, 2];
      $("#playbutton").prop("disabled", true);
      game = new Turns.Game(UUID.generate(), players, order);
      timeboats = new Timeboats(game, game_context, game_canvas.width, game_canvas.height, api, window.document);
      timeboats.turnClicked(null);
      render = true;
      render_menu = false;
      $("#menu-canvas").fadeOut(1000);
      $("#controls_placeholder").fadeOut(1000);
      $("#instructions_right").fadeOut(1000);
      return $("#menu").fadeOut(1000, function() {
        render = true;
        render_menu = false;
        $("#buttons").hide();
        $("#controls_background").fadeOut(1000);
        $("#controls").fadeIn(1000);
        $("#game-canvas").fadeIn(1000);
        $("#game_right").fadeIn(1000);
        return $("#background_right").fadeOut(1000);
      });
    });
    $('#loadgame').click(function() {
      $("#buttons button").prop("disabled", true);
      $("#buttons").fadeOut();
      $("#load").fadeIn();
      $('#loading').show();
      return async.parallel({
        game_ids: api.gameIds,
        games: api.getGames
      }, function(err, data) {
        $('#loading').hide();
        if (!err) return drawGames(data.game_ids, data.games, api);
      });
    });
    $('#load .back').click(function() {
      $("#buttons button").prop("disabled", false);
      return $("#load").fadeOut(1000, function() {
        return $("#buttons").fadeIn(1000);
      });
    });
    window.gameClicked = function(id) {
      render = false;
      $('#loading').show();
      return game = api.getGame(id, function(err, game) {
        var _this = this;
        $('#loading').hide();
        if (err) {
          alert("couldn't load game " + id);
          return;
        }
        timeboats = new Timeboats(game, game_context, game_canvas.width, game_canvas.height, api, window.document);
        timeboats.turnClicked(null);
        $("#menu-canvas").fadeOut(1000);
        $("#controls_placeholder").fadeOut(1000);
        $("#instructions_right").fadeOut(1000);
        return $("#menu").fadeOut(1000, function() {
          render = true;
          render_menu = false;
          $("#load").hide();
          $("#controls").fadeIn(1000);
          $("#controls_background").fadeOut(1000);
          $("#game-canvas").fadeIn(1000);
          $("#game_right").fadeIn(1000);
          return $("#background_right").fadeOut(1000);
        });
      });
    };
    window.gameOver = function(game) {
      $("#controls").fadeOut(1000);
      $("#controls_background").fadeIn(1000);
      $("#game_right").fadeOut(1000);
      $("#background_right").fadeIn(1000);
      render_menu = true;
      render = false;
      menu_boats.full_redraw = true;
      return $("#game-canvas").fadeOut(1000, function() {
        timeboats = null;
        $("#menu-canvas").fadeIn(1000);
        $("#instructions_right").fadeIn(1000);
        $("#menu").fadeIn(1000);
        $("#controls_placeholder").fadeIn(1000);
        return $("#gameover").show();
      });
    };
    $('#gameover .back').click(function() {
      $("#buttons button").prop("disabled", false);
      return $("#gameover").fadeOut(1000, function() {
        return $("#buttons").fadeIn(1000);
      });
    });
    $("#back_to_menu").click(function() {
      $("#controls").fadeOut(1000);
      $("#controls_background").fadeIn(1000);
      $("#game_right").fadeOut(1000);
      $("#background_right").fadeIn(1000);
      render_menu = true;
      render = false;
      menu_boats.full_redraw = true;
      return $("#game-canvas").fadeOut(1000, function() {
        timeboats = null;
        $("#menu-canvas").fadeIn(1000);
        $("#instructions_right").fadeIn(1000);
        $("#menu").fadeIn(1000);
        $("#buttons").fadeIn(1000);
        $("#controls_placeholder").fadeIn(1000);
        return $("#buttons button").prop("disabled", false);
      });
    });
    $("#playbutton").click(function() {
      if (!(timeboats != null)) return;
      return timeboats.playClick();
    });
    $("#timeslider").change(function() {
      if (!(timeboats != null)) return;
      return timeboats.sliderDrag($("#timeslider").val());
    });
    window.turnClicked = function(number) {
      if (!(timeboats != null)) return;
      return timeboats.turnClicked(number);
    };
    game_canvas.onmousedown = function(e) {
      if (!(timeboats != null)) return;
      return timeboats.onMouseDown(e);
    };
    game_canvas.onmousemove = function(e) {
      var canoffset, x, y;
      if (!(timeboats != null)) return;
      canoffset = $(game_canvas).offset();
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
      var do_render, now, render_ctx, render_obj;
      do_render = false;
      if (render_menu) {
        do_render = true;
        render_obj = menu_boats;
        render_ctx = menu_context;
      } else if (render) {
        do_render = true;
        render_obj = timeboats;
        render_ctx = game_context;
      }
      if (do_render) {
        frame_num += 1;
        now = timestamp();
        if (!(last != null)) last = now;
        dt = Math.min(1, (now - last) / 1000);
        gdt = gdt + dt;
        while (gdt > render_obj.timestep) {
          gdt = gdt - render_obj.timestep;
          render_obj.update(render_obj.timestep);
        }
        rdt = rdt + dt;
        if (rdt > render_obj.renderstep) {
          rdt = rdt - render_obj.renderstep;
          render_obj.draw();
        }
        render_ctx.fillText("" + Math.floor(1 / dt), 10, 10);
      }
      last = now;
      if (loaded) return requestAnimationFrame(frame);
    };
    return frame();
  };

  unload = function() {
    loaded = false;
    menu_context.clearRect(0, 0, menu_canvas.width, menu_canvas.height);
    return game_context.clearRect(0, 0, game_canvas.width, game_canvas.height);
  };

  if (typeof pokki !== "undefined" && pokki !== null) {
    pokki.addEventListener('popup_unload', function() {
      return unload();
    });
    old_render = false;
    old_render_menu = false;
    pokki.addEventListener('popup_shown', function() {
      if (old_render) render = true;
      if (old_render_menu) return render_menu = true;
    });
    pokki.addEventListener('popup_hiding', function() {
      old_render = render;
      old_render_menu = render_menu;
      render = false;
      return render_menu = false;
    });
  }

  window.onload = function() {
    menu_canvas = $('#menu-canvas')[0];
    menu_context = menu_canvas.getContext('2d');
    game_canvas = $('#game-canvas')[0];
    game_context = game_canvas.getContext('2d');
    return load();
  };

}).call(this);

});
require("/client.coffee");
