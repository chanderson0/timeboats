var Point, Square, State, Timeboats, timestamp;
var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
timestamp = function() {
  return +new Date();
};
window.onload = function() {
  var canvas, context, dt, frame, frame_num, game, gdt, last, rdt;
  canvas = $('#game-canvas')[0];
  context = canvas.getContext('2d');
  game = new Timeboats(context, canvas.width, canvas.height);
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
      game.update();
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
    this.state = new State();
    this.square = new Square(100, 100, 50);
    this.state.addObject(this.square);
    this.destX = 200;
    this.destY = 200;
    this.recording = false;
    this.playback = false;
    this.history = [];
    this.state_num = 0;
    this.message = 'not recording';
  }
  Timeboats.prototype.update = function() {
    if (this.recording) {
      this.history.push(this.state.clone());
    }
    if (this.playback) {
      this.state = this.history[this.state_num++];
      if (this.state_num > this.history.length) {
        this.message = 'done playback';
        this.playback = false;
        this.state = this.old_state;
        return this.history = [];
      }
    } else {
      return this.state.update();
    }
  };
  Timeboats.prototype.draw = function() {
    this.context.clearRect(0, 0, this.width + 1, this.height + 1);
    this.state.draw(this.context);
    return this.context.fillText(this.message, 10, 30);
  };
  Timeboats.prototype.onMouseDown = function(e) {
    if (this.recording) {
      this.message = 'playback';
      this.recording = false;
      this.playback = true;
      this.old_state = this.state;
      return this.state_num = 0;
    } else if (this.playback) {
      this.message = 'cancelled playback';
      this.playback = false;
      this.state = this.old_state;
      return this.history = [];
    } else {
      this.message = 'recording';
      return this.recording = true;
    }
  };
  Timeboats.prototype.onMouseMove = function(e) {
    this.square.destx = e[0];
    return this.square.desty = e[1];
  };
  return Timeboats;
})();
State = (function() {
  function State() {
    this.objects = [];
  }
  State.prototype.clone = function() {
    var object, st, _fn, _i, _len, _ref;
    st = new State();
    _ref = this.objects;
    _fn = function(object) {
      return st.objects.push(object.clone());
    };
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      object = _ref[_i];
      _fn(object);
    }
    return st;
  };
  State.prototype.addObject = function(object) {
    return this.objects.push(object);
  };
  State.prototype.update = function() {
    var object, _i, _len, _ref, _results;
    _ref = this.objects;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      object = _ref[_i];
      _results.push((function(object) {
        return object.update();
      })(object));
    }
    return _results;
  };
  State.prototype.draw = function(context) {
    var object, _i, _len, _ref, _results;
    _ref = this.objects;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      object = _ref[_i];
      _results.push(__bind(function(object) {
        return object.draw(context);
      }, this)(object));
    }
    return _results;
  };
  return State;
})();
Square = (function() {
  function Square(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.rotation = 0;
    this.vx = 0;
    this.vy = 0;
    this.destx = 200;
    this.desty = 200;
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
  Square.prototype.update = function() {
    var dir, dist, to_move;
    dir = Point.subtract(this.destx, this.desty, this.x, this.y);
    dist = Point.getLength(dir.x, dir.y);
    to_move = Point.normalize(dir.x, dir.y, Math.sqrt(dist) / 2);
    if (dist < 0.5) {
      to_move.x = 0;
      to_move.y = 0;
      this.x = this.destx;
      this.y = this.desty;
    }
    this.vx = to_move.x;
    this.vy = to_move.y;
    this.x += this.vx;
    this.y += this.vy;
    if (this.vx !== 0 || this.vy !== 0) {
      return this.rotation = Point.getAngle(this.vx, this.vy);
    }
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