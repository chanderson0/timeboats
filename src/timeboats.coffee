# Timeboats!

timestamp = ->
  +new Date()

# Setting up Paper.js
# "paper" is a global
window.onload = ->
  canvas = $('#game-canvas')[0]
  context = canvas.getContext '2d'

  game = new Timeboats context, canvas.width, canvas.height

  canvas.onmousedown = (e) ->
    game.onMouseDown e
  canvas.onmousemove = (e) ->
    canoffset = $(canvas).offset()
    x = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft - Math.floor(canoffset.left)
    y = event.clientY + document.body.scrollTop + document.documentElement.scrollTop - Math.floor(canoffset.top) + 1
    game.onMouseMove [x, y]

  last = timestamp()
  dt = 0
  gdt = 0
  rdt = 0
  frame_num = 0
  frame = ->
    frame_num += 1

    now = timestamp()
    dt  = Math.min 1, (now - last) / 1000
    
    gdt = gdt + dt
    while gdt > game.timestep
      gdt = gdt - game.timestep
      game.update()
    
    rdt = rdt + dt
    if rdt > game.renderstep
      rdt = rdt - game.renderstep
      game.draw()

    #if Math.random() > 0.9
      context.fillText("" + Math.floor(1/dt), 10, 10)

    last = now
    requestAnimationFrame frame

  frame()

class Timeboats
  constructor: (@context, @width, @height) ->
    @timestep = 1 / 60
    @renderstep = 1 / 60

    @state = new State()
    @square = new Square(100, 100, 50)
    @state.addObject @square

    @destX = 200
    @destY = 200

    @recording = false
    @playback = false
    @history = []
    @state_num = 0

    @message = 'not recording'

  update: ->
    if @recording
      @history.push @state.clone()

    if @playback
      @state = @history[@state_num++]
      if @state_num > @history.length
        @message = 'done playback'
        @playback = false
        @state = @old_state
        @history = []
    else
      @state.update()

  draw: ->
    @context.clearRect 0, 0, @width + 1, @height + 1

    @state.draw @context

    @context.fillText(@message, 10, 30)

  onMouseDown: (e) =>
    if @recording
      @message = 'playback'
      @recording = false
      @playback = true
      @old_state = @state
      @state_num = 0
    else if @playback
      @message = 'cancelled playback'
      @playback = false
      @state = @old_state
      @history = []
    else
      @message = 'recording'
      @recording = true

  onMouseMove: (e) =>
    @square.destx = e[0]
    @square.desty = e[1]

class State
  constructor: ->
    @objects = []

  clone: ->
    st = new State()
    for object in @objects
      do (object) ->
        st.objects.push object.clone()
    return st
  
  addObject: (object) ->
    @objects.push object
  
  update: ->
    for object in @objects
      do (object) ->
        object.update()

  draw: (context) ->
    for object in @objects
      do (object) =>
        object.draw context


class Square
  constructor: (@x, @y, @size) ->
    @rotation = 0
    @vx = 0
    @vy = 0
    @destx = 200
    @desty = 200

  clone: ->
    sq = new Square @x, @y, @size
    sq.rotation = @rotation
    sq.vx = @vx
    sq.vy = @vy
    sq.destx = @destx
    sq.desty = @desty
    return sq

  update: ->
    dir = Point.subtract @destx, @desty, @x, @y
    dist = Point.getLength dir.x, dir.y

    to_move = Point.normalize dir.x, dir.y, Math.sqrt(dist) / 2
    if dist < 0.5
      to_move.x = 0
      to_move.y = 0
      @x = @destx
      @y = @desty

    @vx = to_move.x
    @vy = to_move.y

    @x += @vx
    @y += @vy

    if @vx != 0 or @vy != 0
        @rotation = Point.getAngle(@vx, @vy)

  draw: (context) ->
    context.save()
    context.translate @x, @y
    context.rotate @rotation
    context.fillRect -@size/2, -@size/2, @size, @size
    context.restore()

class Point
  @getAngleDeg: (x, y) ->
    return @getAngle(x, y) * 180 / Math.PI

  @getAngle: (x, y) ->
    return Math.atan2(y, x)
  
  @add: (x1, y1, x2, y2) ->
    return { x: x1 + x2, y: y1 + y2 }

  @subtract: (x1, y1, x2, y2) ->
    return { x: x1 - x2, y: y1 - y2 }
  
  @getDistance: (x1, y1, x2, y2) ->
    x = x1 - x2
    y = y1 - y2
    return Math.sqrt(x * x + y * y)

  @getLength: (x, y) ->
    Math.sqrt(x * x + y * y)

  @normalize: (x, y, length = 1) ->
    current = @getLength x, y
    scale = if current != 0 then length / current else 0
    return { x: x * scale, y: y * scale }
