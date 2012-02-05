State = require('./state.coffee').State
Square = require('./square.coffee').Square
Command = require('./command.coffee')
Point = require('./point.coffee').Point
Map = require('./map.coffee').Map
AssetLoader = require('./asset_loader.coffee').AssetLoader

exports.Timeboats = class Timeboats
  constructor: (@game, @context, @width, @height, @api = null, @document = null) ->
    @timestep = 1 / 60
    @renderstep = 1 / 60

    @gamestate = "init"

    @frame_history = [new State()]
    @command_history = []
    @setFrameNum(0)
    @active_commands = []

    if not @game.mapSeed?
      @game.setMap new Date().getTime()

    Map.getInstance().generate @width / Map.CELL_SIZE_PX,
      @height / Map.CELL_SIZE_PX,
      @game.mapSeed

    @full_redraw = false
    if @document?
      @m_canvas = @document.createElement 'canvas'
      @m_canvas.width = @width
      @m_canvas.height = @height
      @m_context = @m_canvas.getContext '2d'
    else
      @m_canvas = null

    AssetLoader.getInstance().load()

    @game.render()

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
      player = new Square(@game.next_turn_id, 100, 100, 48, @game.currentPlayer().color)
      command = new Command.JoinCommand player.id, player
      @addCommand @command_history, command
      @addCommand @active_commands, command

      @gamestate = "recording"

      $("#playbutton").html "Stop"
      $("#playbutton").prop "disabled", true
      $("#addbutton").html "Ready Next"
      $("#addbutton").prop "disabled", true
    else if (oldState == "init" || oldState == "paused") and newState == "rerecording"
      @gamestate = "rerecording"

      # TODO: enforce no stopping

      $("#playbutton").html "Stop"
      $("#playbutton").prop "disabled", true
      $("#addbutton").html "Ready Next"
      $("#addbutton").prop "disabled", true
    else if oldState == "rerecording" and newState == "paused"
      @gamestate = "paused"

      @setFrameNum(0)
      @full_redraw = true

      if @game.turns.length > 0
        $("#playbutton").html "Play"
        $("#playbutton").prop "disabled", false
      $("#addbutton").html "Ready Next"
      $("#addbutton").prop "disabled", false
    else if oldState == "recording" and newState == "paused"
      @game.recordTurn @active_commands
      @active_commands = []
      @game.nextTurn()

      @setFrameNum(0)
      @full_redraw = true

      if @api?
        @api.saveGame @game, (err, worked) ->
          if err or not worked
            alert "Couldn't save game"

      @gamestate = "paused"

      if @game.turns.length > 0
        $("#playbutton").html "Play"
        $("#playbutton").prop "disabled", false
      $("#addbutton").html "Ready Next"
      $("#addbutton").prop "disabled", false
    else if oldState == "paused" and newState == "playing"
      @gamestate = "playing"

      $("#playbutton").html "Pause"
      $("#playbutton").prop "disabled", false
      $("#addbutton").html "Ready Next"
      $("#addbutton").prop "disabled", true
    else if oldState == "paused" and newState == "ready"
      @setFrameNum(0)

      if not @game.isLatestTurn()
        @game.setTurn @game.latestTurnNumber()
        @command_history = @game.computeCommands()

        @frame_history = [@frame_history[@frame_num]]

      @gamestate = "ready"

      $("#playbutton").html "Start"
      $("#playbutton").prop "disabled", false
      $("#addbutton").html "Ready Next"
      $("#addbutton").prop "disabled", true
    else if (oldState == "playing" || oldState == "ready") and newState == "paused"
      @gamestate = "paused"

      $("#playbutton").html "Play"
      $("#addbutton").html "Ready Next"
      $("#addbutton").prop "disabled", false
    else
      console.log "couldn't switch state"

  setFrameNum: (value, updateSlider = true) ->
    frame_not_consecutive = value != @frame_num + 1

    @frame_num = value
    Map.getInstance().setFrame value 
    Map.getInstance().computeTerrainState frame_not_consecutive
    if updateSlider
      @updateSlider value

  updateSlider: (value, max = -1) ->
    $("#timeslider").prop 'value', value

    if max > 0
      $("#timeslider").prop 'max', max

  turnClicked: (number) ->
    if @gamestate == "paused" || @gamestate == "init"
      if number == null
        number = @game.latestTurnNumber()

      @game.setTurn(number)
      @command_history = @game.computeCommands()

      @setFrameNum(0)
      @frame_history = [@frame_history[@frame_num]]

      @updateState "paused", "rerecording"
      @full_redraw = true

  sliderDrag: (value) ->
    if @gamestate == "paused"
      @full_redraw = true
      @setFrameNum(parseInt(value), false)

  addCommand: (buffer, command) ->
    while @frame_num >= buffer.length
      buffer.push []
    buffer[@frame_num].push command

  update: (dt) ->
    Map.getInstance().update dt

    if @gamestate == "recording" || @gamestate == "rerecording"
      # console.log "recording", @frame_num
      Map.getInstance().setFrame(@frame_num + 1, true)

      next_state = @frame_history[@frame_num].clone()
      next_state.setCommands (@command_history[@frame_num] || [])
      next_state.update dt

      @setFrameNum(@frame_num + 1)
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
      @setFrameNum(@frame_num + 1)

      if @frame_num >= @frame_history.length
        @updateState "playing", "paused"
        @setFrameNum(0)

    else if @gamestate == "paused"
      @state = @frame_history[@frame_num]

  draw: ->
    if not @m_canvas?
      @context.clearRect 0, 0, @width + 1, @height + 1
      Map.getInstance().draw @context
      @frame_history[@frame_num].draw @context, active: @game.next_turn_id
    else
      Map.getInstance().draw @m_context, full_redraw: @full_redraw
      @full_redraw = false

      @frame_history[@frame_num].draw @m_context, active: @game.next_turn_id
      @context.drawImage @m_canvas, 0, 0

  onMouseDown: (e) =>
    if @gamestate == "recording"
      command = new Command.ExplodeCommand @game.next_turn_id
      @addCommand @command_history, command
      @addCommand @active_commands, command

  onMouseMove: (e) =>
    if @gamestate == "recording"
      command = new Command.MouseCommand @game.next_turn_id, e[0], e[1]
      @addCommand @command_history, command
      @addCommand @active_commands, command
