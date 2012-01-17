Serializable = require('./serializable.coffee').Serializable
UUID = require('./lib/uuid.js')

exports.Player = class Player extends Serializable
  __type: 'Player'

  constructor: (@id = null, @color = "white") -> 
    if not @id?
      @id = UUID.generate()

    super

exports.Game = class Game extends Serializable
  __type: 'Game'

  constructor: (@id = null, @players = {}, \
                @order = [], @turns = []) ->
    if not @id?
      @id = UUID.generate()

    for id, player of @players
      @renderPlayerTile player, false, false

    @current_player_id = null
    @turn_id = null
    @turn_idx = null
    @nextTurn()

    super
    
  addPlayer: (player) ->
    @players[player.id] = player
    @order.push player.id
    @renderPlayerTile player, false, false

  renderPlayerTile: (player, active = false, update = true) ->
    html = new EJS(element: 'player_template').render
      active: if active then 'active' else ''
      id: player.id
      name: player.color
      score: 0
    if update
      $('#'+player.id).replaceWith html
    else
      $('#player_tiles').append $(html)

  currentPlayer: ->
    @players[@order[@current_player_id]]

  recordTurn: (commands) ->
    turn = new Turn @turn_id, @currentPlayer().id, commands
    @turns.push turn
    @turn_idx = @turns.length - 1
    @renderPlayerTile @currentPlayer(), true, true
    if @turns.length > 1
      @renderTurnTile @turns[@turns.length - 2], @turns.length - 2, false, true
    @renderTurnTile turn, @turn_idx, true, false
  
  latestTurnNumber: ->
    @turns.length - 1

  isLatestTurn: ->
    @turn_idx == @turns.length - 1

  setTurn: (turn_num) ->
    if turn_num < 0 || turn_num >= @turns.length
      return
      
    @renderTurnTile @turns[@turn_idx], @turn_idx, false, true
    @turn_idx = turn_num
    @renderTurnTile @turns[@turn_idx], @turn_idx, true, true

  renderTurnTile: (turn, number, active = false, update = true) ->
    html = new EJS(element: 'turn_template').render
      active: if active then 'active' else ''
      id: turn.id
      player_name: @players[turn.player_id].color
      turn_time: turn.time.toISOString()
      turn_number: number
    if update
      $('#'+turn.id).replaceWith html
    else
      $('#turn_tiles').append $(html)

    # UGH A GLOBAL
    $('#'+turn.id).click ->
      window.turnClicked(number)

  nextTurn: ->
    if @current_player_id == null
      @current_player_id = 0
      @turn_idx = 0
    else if @current_player_id >= @order.length - 1
      @renderPlayerTile @currentPlayer(), false, true
      @current_player_id = 0
    else
      @renderPlayerTile @currentPlayer(), false, true
      @current_player_id++

    @renderPlayerTile @currentPlayer(), true, true
    @turn_id = UUID.generate()

  computeCommands: ->
    commands = []
    for turn_i in [0..@turn_idx]
      for command_idx in [0..@turns[turn_i].commands.length]
        while command_idx >= commands.length
          commands.push []
        commands[command_idx] = commands[command_idx].concat (@turns[turn_i].commands[command_idx] || [])
    commands

exports.Turn = class Turn extends Serializable
  constructor: (@id = null, @player_id, @commands, @time = null) ->
    if not @time?
      @time = new Date()

    if not @id?
      @id = UUID.generate()

    super