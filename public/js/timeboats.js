var Command, GameObject, GameObject2D, MouseCommand, Point, Serializable, Square, State, Timeboats, timestamp;
var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __slice = Array.prototype.slice, __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
  for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
  function ctor() { this.constructor = child; }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor;
  child.__super__ = parent.prototype;
  return child;
};
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
Timeboats = (function() {
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
    if (max == null) {
      max = -1;
    }
    $("#timeslider").prop('value', value);
    if (max > 0) {
      return $("#timeslider").prop('max', max);
    }
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
Serializable = (function() {
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
        _results.push(typeof value === 'object' ? this.deserialize(value, prototypes) : void 0);
      }
      return _results;
    }
  };
  return Serializable;
})();
GameObject = (function() {
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
GameObject2D = (function() {
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
State = (function() {
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
    _ref = this.commands;
    _fn = __bind(function(command) {
      return command.apply(this);
    }, this);
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
Command = (function() {
  __extends(Command, Serializable);
  Command.prototype.__type = 'Command';
  function Command(id) {
    this.id = id;
    Command.__super__.constructor.apply(this, arguments);
  }
  Command.prototype.apply = function(state) {};
  return Command;
})();
MouseCommand = (function() {
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
Square = (function() {
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
Point = (function() {
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
    if (length == null) {
      length = 1;
    }
    current = this.getLength(x, y);
    scale = current !== 0 ? length / current : 0;
    return {
      x: x * scale,
      y: y * scale
    };
  };
  return Point;
})();