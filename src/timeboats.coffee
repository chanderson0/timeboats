State = require('./state.coffee').State
Square = require('./square.coffee').Square
Command = require('./command.coffee')
Point = require('./point.coffee').Point
Map = require('./map.coffee').Map

exports.Timeboats = class Timeboats
  constructor: (@game, @context, @width, @height) ->
    @timestep = 1 / 60
    @renderstep = 1 / 60

    @gamestate = "init"

    @frame_history = [new State()]
    @command_history = []
    @frame_num = 0

    @active_commands = []

    Map.getInstance().generate @width / Map.CELL_SIZE_PX, 
      @height / Map.CELL_SIZE_PX, 
      new Date().getTime()

  playClick: ->
    if @gamestate == "init" || @gamestate == "ready"
      @updateState "init", "recording"
    else if @gamestate == "recording"
      @updateState "recording", "paused"
    else if @gamestate == "paused"
      @updateState "paused", "playing"
    else if @gamestate == "playing"
      @updateState "playing", "paused"

  addClick: ->
    @updateState @gamestate, "ready"

  updateState: (oldState, newState) ->
    console.log oldState, '->', newState

    if (oldState == "init" || oldState == "ready") and newState == "recording"
      player = new Square(@game.turn_id, 100, 100, 20, @game.currentPlayer().color)
      command = new Command.JoinCommand player.id, player
      @addCommand @command_history, command
      @addCommand @active_commands, command

      @gamestate = "recording"

      $("#playbutton").html "Stop"
      $("#playbutton").prop "disabled", true
      $("#addbutton").html "Ready Next"
      $("#addbutton").prop "disabled", true
    else if oldState == "paused" and newState == "rerecording"
      @gamestate = "rerecording"

      # TODO: enforce no stopping

      $("#playbutton").html "Stop"
      $("#playbutton").prop "disabled", true
      $("#addbutton").html "Ready Next"
      $("#addbutton").prop "disabled", true
    else if oldState == "rerecording" and newState == "paused"
      @gamestate = "paused"

      @frame_num = 0
      @updateSlider(@frame_num)

      $("#playbutton").html "Play"
      $("#playbutton").prop "disabled", false
      $("#addbutton").html "Ready Next"
      $("#addbutton").prop "disabled", false
    else if oldState == "recording" and newState == "paused"
      @game.recordTurn @active_commands
      @active_commands = []
      @game.nextTurn()

      @frame_num = 0
      @gamestate = "paused"
      @updateSlider(@frame_num)

      $("#playbutton").html "Play"
      $("#playbutton").prop "disabled", false
      $("#addbutton").html "Ready Next"
      $("#addbutton").prop "disabled", false
    else if oldState == "paused" and newState == "playing"
      @gamestate = "playing"

      $("#playbutton").html "Pause"
      $("#addbutton").html "Ready Next"
      $("#addbutton").prop "disabled", true
    else if oldState == "paused" and newState == "ready"
      if not @game.isLatestTurn()
        @game.setTurn @game.latestTurnNumber()
        @command_history = @game.computeCommands()

        @frame_num = 0   
        @frame_history = [@frame_history[@frame_num]]

      @gamestate = "ready"
      @frame_num = 0
      @updateSlider(@frame_num)

      $("#playbutton").html "Start"
      $("#addbutton").html "Ready Next"
      $("#addbutton").prop "disabled", true
    else if (oldState == "playing" || oldState == "ready") and newState == "paused"
      @gamestate = "paused"

      $("#playbutton").html "Play"
      $("#addbutton").html "Ready Next"
      $("#addbutton").prop "disabled", false
    else
      console.log "couldn't switch state"

  updateSlider: (value, max = -1) ->
    $("#timeslider").prop 'value', value

    if max > 0
      $("#timeslider").prop 'max', max

  turnClicked: (number) ->
    if @gamestate == "paused" 
      @game.setTurn(number)
      @command_history = @game.computeCommands()

      @frame_num = 0   
      @frame_history = [@frame_history[@frame_num]]
      @updateSlider(@frame_num)

      @updateState "paused", "rerecording"

  sliderDrag: (value) ->
    if @gamestate == "paused"
      @frame_num = value
    else
      @updateState @gamestate, "paused"

  addCommand: (buffer, command) ->
    while @frame_num >= buffer.length
      buffer.push []
    buffer[@frame_num].push command

  update: (dt) ->
    Map.getInstance().update dt

    if @gamestate == "recording" || @gamestate == "rerecording"
      next_state = @frame_history[@frame_num].clone()
      next_state.setCommands (@command_history[@frame_num] || [])
      next_state.update dt

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
          @frame_history.splice @frame_num + 1, 
            @frame_history.length - @frame_num
          @updateSlider(@frame_num, @frame_num)
          @updateState @gamestate, "paused"

    else if @gamestate == "playing"
      @frame_num++
      @updateSlider(@frame_num)

      if @frame_num >= @frame_history.length
        @updateState "playing", "paused"
        @frame_num = 0
        @updateSlider(@frame_num)

    else if @gamestate == "paused"
      @state = @frame_history[@frame_num]

  draw: ->
    @context.clearRect 0, 0, @width + 1, @height + 1
    Map.getInstance().draw @context
    @frame_history[@frame_num].draw @context, active: @game.turn_id

  onMouseDown: (e) =>
    if @gamestate == "recording"
      command = new Command.ExplodeCommand @game.turn_id
      @addCommand @command_history, command
      @addCommand @active_commands, command

  onMouseMove: (e) =>
    if @gamestate == "recording"
      command = new Command.MouseCommand @game.turn_id, e[0], e[1]
      @addCommand @command_history, command
      @addCommand @active_commands, command
