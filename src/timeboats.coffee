State = require('./state.coffee').State
Square = require('./square.coffee').Square
Command = require('./command.coffee')
Point = require('./point.coffee').Point
Map = require('./map.coffee').Map
AssetLoader = require('./asset_loader.coffee').AssetLoader
Dock = require('./dock.coffee').Dock

exports.Timeboats = class Timeboats
  constructor: (@game, @context, @width, @height, @api = null, @document = null, options = {}, @max_time = 10) ->
    @timestep = 1 / 60
    @renderstep = 1 / 60

    @gamestate = "init"
    @placeholder = null

    @frame_history = []
    @command_history = []
    @setFrameNum(0)
    @active_commands = []

    @tutorial = if options.tutorial? then options.tutorial else false

    if not @game.mapSeed?
      @game.setMap new Date().getTime()
    console.log @game.mapSeed

    initialState = new State()

    Map.getInstance().generate @width / Map.CELL_SIZE_PX,
      @height / Map.CELL_SIZE_PX,
      @game.mapSeed,
      @game.players,
      options.mapOptions || {}

    for checkpoint in Map.getInstance().checkpoints
      initialState.addObject(checkpoint.id, checkpoint)

    for mine in Map.getInstance().mines
      initialState.addObject(mine.id, mine)
    Map.getInstance().mines = []

    @frame_history.push initialState

    @full_redraw = true
    if @document?
      @game_canvas = @document.createElement 'canvas'
      @game_canvas.width = @width
      @game_canvas.height = @height
      @game_context = @game_canvas.getContext '2d'

      @map_canvas = @document.createElement 'canvas'
      @map_canvas.width = @width
      @map_canvas.height = @height
      @map_context = @map_canvas.getContext '2d'
    else
      @m_canvas = null

    AssetLoader.getInstance().load()

    gamePlayer = @game.currentPlayer()
    startDock = Map.getInstance().docks[gamePlayer.id]
    startDock.active = 'ready'
    @time = 0

    @game.render()

  playClick: ->
    if @gamestate == "paused"
      @updateState "paused", "playing"
    else if @gamestate == "playing"
      @updateState "playing", "paused"

  addClick: ->
    @updateState @gamestate, "ready"

  updateState: (oldState, newState) ->
    console.log oldState, '->', newState

    if (oldState == "init" || oldState == "ready") and newState == "recording"
      @placeholder = null

      gamePlayer = @game.currentPlayer()
      startDock = Map.getInstance().docks[gamePlayer.id]
      player = new Square(@game.next_turn_id, startDock.x, startDock.y, 32, gamePlayer.color, gamePlayer.id)
      command = new Command.JoinCommand player.id, player
      @addCommand @command_history, command
      @addCommand @active_commands, command

      startDock.active = null

      @gamestate = "recording"

      $("#playbutton").html "Stop"
      $("#playbutton").prop "disabled", true
      $("#timeslider").prop "disabled", true
    else if (oldState == "init" || oldState == "paused") and newState == "rerecording"
      @gamestate = "rerecording"

      # TODO: enforce no stopping

      gamePlayer = @game.currentPlayer()
      startDock = Map.getInstance().docks[gamePlayer.id]
      startDock.active = 'ready'

      $("#playbutton").html "Stop"
      $("#playbutton").prop "disabled", true
      $("#timeslider").prop "disabled", false
      $("#slider span").hide()
    else if (oldState == "rerecording" or oldState == "recording" or oldState == "playing") \
         and (newState == "rerewinding" or newState == "rewinding" or newState == "playrewinding")
      @rewindTime = 0
      @frame_num_start = @frame_num
      @gamestate = newState
    else if oldState == "rerewinding" and newState == "paused"
      @gamestate = "paused"

      @setFrameNum(0)
      @full_redraw = true

      gamePlayer = @game.currentPlayer()
      startDock = Map.getInstance().docks[gamePlayer.id]
      startDock.active = 'ready'

      if @game.turns.length > 0
        $("#playbutton").html "Play"
        $("#playbutton").prop "disabled", false
        $("#slider span").show()
      $("#timeslider").prop "disabled", false
    else if oldState == "rewinding" and newState == "paused"
      @game.recordTurn @active_commands
      @active_commands = []
      @game.nextTurn()

      # This should probably be somewhere else
      state = @frame_history[@frame_history.length - 1]
      turn_map = @game.turnsToPlayers()
      scores = state.playerScores turn_map
      @game.setScores scores
      @game.render()

      if @api?
        @api.saveGame @game, (err, worked) ->
          if err or not worked
            alert "Couldn't save game"

      @gamestate = "paused"

      if @frame_history[@frame_history.length - 1].gameover
        @updateState @gamestate, "gameover"
        return

      gamePlayer = @game.currentPlayer()
      startDock = Map.getInstance().docks[gamePlayer.id]
      startDock.active = 'ready'

      @setFrameNum(0)

      if @game.turns.length > 0
        $("#playbutton").html "Play"
        $("#playbutton").prop "disabled", false
        $("#slider span").show()
      $("#timeslider").prop "disabled", false
    else if oldState == "paused" and newState == "playing"
      @gamestate = "playing"

      gamePlayer = @game.currentPlayer()
      startDock = Map.getInstance().docks[gamePlayer.id]
      startDock.active = 'ready'

      $("#playbutton").html "Pause"
      $("#playbutton").prop "disabled", false
      $("#timeslider").prop "disabled", true
      $("#slider span").show()
    else if oldState == "paused" and newState == "ready"
      @setFrameNum(0)
      @time = 0

      if not @game.isLatestTurn()
        @game.setTurn @game.latestTurnNumber()
        @command_history = @game.computeCommands()
        @frame_history = [@frame_history[0]]

      gamePlayer = @game.currentPlayer()
      startDock = Map.getInstance().docks[gamePlayer.id]
      startDock.active = 'go'

      @gamestate = "ready"

      $("#playbutton").html "Start"
      $("#playbutton").prop "disabled", true
      $("#timeslider").prop "disabled", true
      $("#slider span").hide()
    else if (oldState == "playing" || oldState == "ready" || oldState == "playrewinding") and newState == "paused"
      @gamestate = "paused"

      gamePlayer = @game.currentPlayer()
      startDock = Map.getInstance().docks[gamePlayer.id]
      startDock.active = 'ready'

      $("#playbutton").html "Play"
      $("#playbutton").prop "disabled", false
      $("#timeslider").prop "disabled", false
      $("#slider span").show()
    else if newState == "gameover"
      @gamestate = "gameover"

      $("#playbutton").html "Play"
      $("#playbutton").prop "disabled", true
      $("#timeslider").prop "disabled", true
      $("#slider span").hide()

      window.gameOver @game
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
      @time += dt
      Map.getInstance().setFrame(@frame_num + 1, true)

      next_state = @frame_history[@frame_num].clone @time
      next_state.setCommands (@command_history[@frame_num] || [])
      if @tutorial
        next_state.update dt, tutorial: true
      else 
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
        command_count = next_state.commands.length

        if next_state.gameover
          @frames_no_commands++
        else
          @frames_no_commands = 0

        for id, object of next_state.objects
          if object.__type == 'Square' || object.__type == 'Explosion'
            player_count++
          if object.__type == 'Mine'
            Map.getInstance().collideWith(object, next_state)

        if player_count == 0 or @time > @max_time or @frames_no_commands > 50
          @frame_history.splice @frame_num + 1,
            @frame_history.length - @frame_num
          @updateSlider(@frame_num, @frame_num)
          if @gamestate == "rerecording"
            @updateState @gamestate, "rerewinding"
          else if @gamestate == "recording"
            @updateState @gamestate, "rewinding"
      else
        @frames_no_commands = 0

    else if @gamestate == "playing"
      @setFrameNum(@frame_num + 1)

      if @frame_num >= @frame_history.length
        @setFrameNum @frame_history.length - 1
        @updateState "playing", "playrewinding"

    else if @gamestate == "paused"
      @state = @frame_history[@frame_num]

    else if @gamestate == "rewinding" || @gamestate == "rerewinding" || @gamestate == "playrewinding"
      @rewindTime += dt

      t = @rewindTime
      b = @frame_num_start
      c = -@frame_num_start
      d = @frame_history[@frame_num_start].time / 2

      # quadratic easing. i have literally no idea
      # how or why this works
      val = 0
      t /= d / 2
      if t < 1
        val = c / 2 * t * t + b
      else
        t--
        val = -c / 2 * (t * (t - 2) - 1) + b

      val = Math.floor val
      @frame_num = val

      if @frame_num <= 0 || @frame_num > @frame_history.length - 1
        @setFrameNum 0
        @updateState @gamestate, "paused"
        return

      Map.getInstance().setFrame @frame_num, false
      @state = @frame_history[@frame_num]
      @updateSlider(@frame_num)

  drawHUD: (context) ->

    time = @max_time - @frame_history[@frame_num].time
    time = 0 if not time? or time < 0
    $('#time').html time.toFixed 2

  draw: ->
    Map.getInstance().draw @map_context, full_redraw: @full_redraw
    @full_redraw = false

    @game_context.clearRect 0, 0, @width, @height
    Map.getInstance().drawNonTerrain @game_context
    @frame_history[@frame_num].draw @game_context, active: @game.next_turn_id

    @drawHUD @game_context

    @context.drawImage @map_canvas, 0, 0
    @context.drawImage @game_canvas, 0, 0

  onMouseDown: (e) =>
    if @gamestate == "recording"
      command = new Command.ExplodeCommand @game.next_turn_id
      @addCommand @command_history, command
      @addCommand @active_commands, command
    else if @gamestate == "ready"
      gamePlayer = @game.currentPlayer()
      startDock = Map.getInstance().docks[gamePlayer.id]
      if startDock.containsPoint e.offsetX, e.offsetY
        @updateState @gamestate, "recording"
    else if @gamestate == "paused"
      gamePlayer = @game.currentPlayer()
      startDock = Map.getInstance().docks[gamePlayer.id]
      if startDock.containsPoint e.offsetX, e.offsetY
        @updateState @gamestate, "ready"

  onMouseMove: (e) =>
    $('#game-canvas')[0].style.cursor = 'default'
    if @gamestate == "recording"
      command = new Command.MouseCommand @game.next_turn_id, e[0], e[1]
      @addCommand @command_history, command
      @addCommand @active_commands, command
    else if @document? and (@gamestate == "init" or @gamestate == "ready" or @gamestate == "paused")
      gamePlayer = @game.currentPlayer()
      startDock = Map.getInstance().docks[gamePlayer.id]
      if startDock.containsPoint e[0], e[1]
        $('#game-canvas')[0].style.cursor = 'pointer'
      else
        $('#game-canvas')[0].style.cursor = 'default'


