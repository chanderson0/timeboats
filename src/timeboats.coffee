# Timeboats!

timestamp = ->
  +new Date()

# Setting up Paper.js
# "paper" is a global
window.onload = ->
  canvas = $('#game-canvas')[0]
  context = canvas.getContext '2d'

  game = new Timeboats context, canvas.width, canvas.height

  $("#addbutton").prop "disabled", true

  $("#addbutton").click ->
    game.addClick()

  $("#playbutton").click ->
    game.playClick()

  $("#timeslider").change ->
    game.sliderDrag $("#timeslider").val()

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
      game.update game.timestep
    
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
  constructor: (@context, @width, @height, @slider) ->
    @timestep = 1 / 60
    @renderstep = 1 / 60

    @gamestate = "init"
    
    @frame_history = [new State()]
    @command_history = []
    @frame_num = 0

    @player_id = 1

    @message = 'not recording'

  playClick: ->
    if @gamestate == "init"
      @updateState "init", "recording"
    else if @gamestate == "recording"
      @updateState "recording", "paused"
    else if @gamestate == "paused"
      @updateState "paused", "playing"
    else if @gamestate == "playing"
      @updateState "playing", "paused"
    else if @gamestate == "stopped"
      @updateState "stopped", "playing"

  addClick: ->
    if @gamestate != "stopped"
      @updateState @gamestate, "stopped"
    else
      @updateState @gamestate, "recording"

  updateState: (oldState, newState) ->
    console.log oldState, '->', newState
    if newState == "recording"
      @player_id++
      player = new Square(100, 100, 50)
      @frame_history[@frame_num].addObject @player_id, player
      @gamestate = "recording"
      $("#playbutton").html "Stop"
      $("#addbutton").html "Rewind"
      $("#addbutton").prop "disabled", true
    else if oldState == "recording" and newState == "paused"
      @frame_num = 0
      @gamestate = "paused"
      @updateSlider(@frame_num)
      $("#playbutton").html "Play"
      $("#addbutton").html "Rewind"
      $("#addbutton").prop "disabled", false
    else if newState == "playing"
      @gamestate = "playing"
      $("#playbutton").html "Pause"
      $("#addbutton").html "Rewind"
    else if newState == "paused"
      @gamestate = "paused"
      $("#playbutton").html "Play"
      $("#addbutton").html "Rewind"
    else if newState == "stopped"
      @gamestate = "stopped"
      @message = "Done playback."
      $("#playbutton").html "Play"
      $("#addbutton").html "Add New"
      @frame_num = 0
      @updateSlider(@frame_num)
    else
      console.log "couldn't switch state"

  updateSlider: (value, max = -1) ->
    $("#timeslider").prop 'value', value

    if max > 0
      $("#timeslider").prop 'max', max

  sliderDrag: (value) ->
    if @gamestate == "paused" 
      @frame_num = value
    else
      @updateState @gamestate, "paused"

  addCommand: (command) ->
    while @frame_num >= @command_history.length
      @command_history.push []
    
    @command_history[@frame_num].push command

  update: (dt) ->
    if @gamestate == "recording"
      next_state = @frame_history[@frame_num].clone()
      next_state.setCommands (@command_history[@frame_num] || [])
      next_state.update dt

      @frame_num++
      if @frame_history.length > @frame_num
        @frame_history[@frame_num] = next_state
      else
        @frame_history.push next_state
      
      @updateSlider(@frame_num, @frame_history.length - 1)
    else if @gamestate == "playing"
      @frame_num++
      @updateSlider(@frame_num)

      if @frame_num >= @frame_history.length
        @updateState "playing", "stopped"

    else if @gamestate == "paused"
      @state = @frame_history[@frame_num]

  draw: ->
    @context.clearRect 0, 0, @width + 1, @height + 1
    @frame_history[@frame_num].draw @context
    @context.fillText(@message, 10, 30)

  onMouseDown: (e) =>

  onMouseMove: (e) =>
    if @gamestate == "recording"
      command = new MouseCommand @player_id, e[0], e[1]
      @addCommand command

class Serializable
  __type = 'Serializable'

  constructor: ->
    @__type = @__type

  @buildMap: (maps...) ->
    res = {}
    for id, map of maps
      for key, val of map
        res[key] = val
    res

  @deserialize: (object, prototypes) ->
    if object? and typeof object == 'object'
      if object.__type?
        object.__proto__ = prototypes[object.__type].prototype
      
      for key, value of object
        if typeof value == 'object'
          @deserialize(value, prototypes)

class GameObject extends Serializable
  __type: 'GameObject'

  constructor: () ->
    super

  clone: ->
    new GameObject()

  draw: (context) ->

  update: (dt) ->
    # Override me!

  leave: (callback) ->
    callback()

class GameObject2D extends GameObject
  __type: 'GameObject2D'

  constructor: (@x = 0, @y = 0, @vx = 0, @vy = 0, @rotation = 0) ->
    super @state

  clone: ->
    new GameObject2D @x, @y, @vx, @vy, @rotation

  setPos: (x, y) ->
    @x = x
    @y = y

  setVel: (vx, vy) ->
    @vx = vx
    @vy = vy

    if @vx != 0 or @vy != 0
      @rotation = Point.getAngle(@vx, @vy)
  
  update: (dt) ->
    newPos = Point.add(@x, @y, @vx * dt, @vy * dt)
    @setPos newPos.x, newPos.y

class State extends Serializable
  __type: 'State'

  constructor: ->
    @objects = {}
    @commands = []

  clone: ->
    st = new State()

    for id, object of @objects
      st.objects[id] = object.clone()

    return st
  
  setCommands: (commands) ->
    @commands = commands

  addObject: (id, object) ->
    @objects[id] = object

  getObject: (id) ->
    @objects[id]

  removeObject: (id) ->
    @objects[id].leave () ->
      delete @objects[id]

  update: (dt) ->
    for command in @commands
      do (command) =>
        command.apply this
    for id, object of @objects
      object.update dt

    true

  draw: (context) ->
    for id, object of @objects
      object.draw context

    true


class Command extends Serializable
  __type: 'Command'

  constructor: (@id) ->
    super
    # Override me!

  apply: (state) ->
    # Override me!

class MouseCommand extends Command
  __type: 'MouseCommand'

  constructor: (@id, @destx, @desty) ->
    super @id

  apply: (state) ->
    obj = state.getObject @id
    if obj?
      obj.destx = @destx
      obj.desty = @desty

class Square extends GameObject2D
  __type: 'Square'

  constructor: (@x, @y, @size) ->
    super @x, @y

    @destx = @x
    @desty = @y

  clone: ->
    sq = new Square @x, @y, @size
    sq.rotation = @rotation
    sq.vx = @vx
    sq.vy = @vy
    sq.destx = @destx
    sq.desty = @desty
    return sq

  update: (dt) ->
    dir = Point.subtract @destx, @desty, @x, @y
    dist = Point.getLength dir.x, dir.y

    to_move = Point.normalize dir.x, dir.y, Math.sqrt(dist) * dt * 1000
    if dist < 0.5
      to_move = {x: 0, y: 0}
      @setPos @destx, @desty

    @setVel to_move.x, to_move.y
    super dt

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
