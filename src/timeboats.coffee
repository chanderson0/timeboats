State = require('./state.coffee').State
Square = require('./square.coffee').Square
MouseCommand = require('./mouse_command.coffee').MouseCommand
ExplodeCommand = require('./explode_command.coffee').ExplodeCommand
Point = require('./point.coffee').Point
Map = require('./map.coffee').Map

exports.Timeboats = class Timeboats
  constructor: (@context, @width, @height) ->
    @timestep = 1 / 60
    @renderstep = 1 / 60

    @gamestate = "init"

    @frame_history = [new State()]
    @command_history = []
    @frame_num = 0

    @player_id = 1

    @message = 'not recording'

    @map = new Map @width / Map.CELL_SIZE_PX, @height / Map.CELL_SIZE_PX
    @map.generate new Date().getTime()

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
      player = new Square(@player_id, 100, 100, 20)
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
      @frame_num = 0
      @updateSlider(@frame_num)

      $("#playbutton").html "Play"
      $("#addbutton").html "Add New"
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
      for id, object of next_state.objects
        if object.__type == 'Square'
          @map.collideWith object, next_state
          break

      @frame_num++
      if @frame_history.length > @frame_num
        @frame_history[@frame_num] = next_state
      else
        @frame_history.push next_state

      @updateSlider(@frame_num, @frame_history.length - 1)

      # Check there are still players
      if @frame_num > 0
        player_count = 0
        for id, object of next_state.objects
          if object.__type == 'Square' || object.__type == 'Explosion'
            player_count++

        if player_count == 0
          @frame_history.splice @frame_num + 1, @frame_history.length - @frame_num
          @updateSlider(@frame_num, @frame_num)
          @updateState "recording", "paused"

    else if @gamestate == "playing"
      @frame_num++
      @updateSlider(@frame_num)

      if @frame_num >= @frame_history.length
        @updateState "playing", "stopped"

    else if @gamestate == "paused"
      @state = @frame_history[@frame_num]

  draw: ->
    @context.clearRect 0, 0, @width + 1, @height + 1
    @map.draw @context
    @context.fillStyle = "white"
    @context.strokeStyle = "white"
    @frame_history[@frame_num].draw @context
    @context.fillText(@message, 10, 30)

  onMouseDown: (e) =>
    if @gamestate == "recording"
      command = new ExplodeCommand @player_id
      @addCommand command

  onMouseMove: (e) =>
    if @gamestate == "recording"
      command = new MouseCommand @player_id, e[0], e[1]
      @addCommand command
