Serializable = require('./serializable.coffee').Serializable
UUID = require('./lib/uuid.js')
Map = require('./map.coffee').Map

exports.Player = class Player extends Serializable
  __type: 'Player'

  constructor: (@id = null, @color = 0, @nickname = null) ->
    if not @id?
      @id = UUID.generate()
    if not @nickname?
      @nickname = ("" + @id).substring(0, 10)
      
    @scores = {}

    super

class GameRenderer
  @render: (game) ->
    # Clear all
    $('#turn_tiles').html ''
    $('#player_tiles').html ''

    # Render players
    if game.order.length > 0
      for player_idx in [0...game.order.length]
        player = game.getPlayerByIndex player_idx
        @renderPlayerTile player, false, false
      @renderPlayerTile game.currentPlayer(), true, true

    # Render moves
    if game.turns.length > 0
      console.log game.turns
      for turn_idx in [0...game.turns.length]
        turn = game.getTurnByIndex turn_idx
        @renderTurnTile turn, turn_idx, game, false, false
      active_turn = game.getTurnByIndex game.turn_idx
      @renderTurnTile active_turn, game.turn_idx, game, true, true

  @renderTurnTile: (turn, number, game, active = false, update = true) ->
    html = new EJS(element: 'turn_template').render
      active: if active then 'active' else ''
      id: turn.id
      player_name: game.players[turn.player_id].color
      turn_time: turn.time.toISOString()
      turn_number: number
    if update
      $('#'+turn.id).replaceWith html
    else
      $('#turn_tiles').append $(html)

    # UGH A GLOBAL
    $('#'+turn.id).click ->
      window.turnClicked(number)

  @renderPlayerTile: (player, active = false, update = true) ->
    html = new EJS(element: 'player_template').render
      active: if active then 'active' else ''
      id: player.id
      name: player.color
      score: player.score
    if update
      $('#'+player.id).replaceWith html
    else
      $('#player_tiles').append $(html)

exports.Game = class Game extends Serializable
  __type: 'Game'

  # players: map<player-id -> Turns.Player>
  # order: list<player-id>
  constructor: (@id = null, @players = {}, @order = [], @turns = []) ->
    if not @id?
      @id = UUID.generate()

    @next_turn_id = UUID.generate()
    @current_player_id = 0
    @turn_idx = 0
    console.log 'constructor'

    super

  afterDeserialize: ->
    @next_turn_id = UUID.generate()
    console.log 'afterDeserialize'

  render: =>
    GameRenderer.render this

  setMap: (seed) ->
    @mapSeed = seed

  addPlayer: (player) ->
    @players[player.id] = player
    @order.push player.id
    console.log 'addPlayer'
    @render()

  getPlayerByIndex: (idx) ->
    @players[@order[idx]]

  currentPlayer: ->
    @getPlayerByIndex @current_player_id

  turnsToPlayers: ->
    ret = {}
    for turn in @turns
      ret[turn.id] = turn.player_id
    ret

  setScores: (scoremap) ->
    for player_id, scores of scoremap
      @players[player_id].scores = scores

  recordTurn: (commands) ->
    turn = new Turn @next_turn_id, @currentPlayer().id, commands
    @turns.push turn
    @turn_idx = @latestTurnNumber()
    @render()
    return turn

  getTurnByIndex: (idx) ->
    @turns[idx]

  latestTurnNumber: ->
    @turns.length - 1

  isLatestTurn: ->
    @turn_idx == @turns.length - 1

  setTurn: (turn_num) ->
    if turn_num < 0 || turn_num >= @turns.length
      return
    @turn_idx = turn_num
    console.log 'setTurn'
    @render()

  nextTurn: ->
    if @current_player_id >= @order.length - 1 # Restart turn order
      @current_player_id = 0
    else
      @current_player_id++

    @next_turn_id = UUID.generate()
    console.log 'nextTurn'
    @render()

  computeCommands: ->
    return [] if @turns.length == 0

    commands = []
    for turn_i in [0..@turn_idx]
      for command_idx in [0...@turns[turn_i].commands.length]
        while command_idx >= commands.length
          commands.push []
        commands[command_idx] = commands[command_idx].concat \
          (@turns[turn_i].commands[command_idx] || [])
    commands

exports.Turn = class Turn extends Serializable
  __type: 'Turn'

  constructor: (@id = null, @player_id, @commands, @time = null) ->
    if @time == null or not @time?
      @time = new Date()

    if not @id?
      @id = UUID.generate()

    super

  eachKey: (key, value) ->
    if key == 'time'
      return new Date(value)
    undefined
