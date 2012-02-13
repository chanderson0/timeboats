# Timeboats!
Timeboats = require('./timeboats.coffee').Timeboats
MenuBoats = require('./menu_boats.coffee').MenuBoats
Turns = require('./turns.coffee')
API = require('./api.coffee')
UUID = require('./lib/uuid.js')
async = require('./lib/async.js')

# Helper function.
timestamp = ->
  +new Date()

drawGames = (game_ids, games, api) ->
  html = new EJS(element: 'games_template', type: '<').render
    games: games
    game_ids: game_ids
  $('#games').html html

  $('#games .game').click (e) ->
    id = $(e.target).attr('data')
    window.gameClicked id

# Setup.
window.onload = ->
  menu_canvas = $('#menu-canvas')[0]
  menu_context = menu_canvas.getContext '2d'

  game_canvas = $('#game-canvas')[0]
  game_context = game_canvas.getContext '2d'

  api = new API.LocalAPI 'chris', null

  menu_boats = new MenuBoats menu_canvas, menu_context, menu_canvas.width, menu_canvas.height, window.document
  render_menu = true
  $("#menu-canvas").fadeIn()
  $("#menu").fadeIn()

  game = null
  timeboats = null
  render = false

  $('#newgame').click =>
    render = false
    player1 = new Turns.Player 1, 0
    player2 = new Turns.Player 2, 1
    players = {1: player1, 2: player2}
    order = [1, 2]

    $("#playbutton").prop "disabled", true

    game = new Turns.Game UUID.generate(), players, order
    timeboats = new Timeboats game, game_context, game_canvas.width, game_canvas.height, api, window.document
    timeboats.turnClicked null

    render = true
    render_menu = false

    $("#menu-canvas").fadeOut 1000
    $("#menu").fadeOut 1000, =>
      render = true
      render_menu = false
      $("#buttons").hide()
      $("#controls").fadeIn 1000
      $("#game-canvas").fadeIn 1000

  $('#loadgame').click =>
    $("#buttons button").prop "disabled", true
    $("#buttons").fadeOut()
    $("#load").fadeIn()

    $('#loading').show()

    async.parallel {
      game_ids: api.gameIds
      games: api.getGames
    },
    (err, data) ->
      $('#loading').hide()
      if not err
        drawGames data.game_ids, data.games, api

  $('#load .back').click =>
    $("#buttons button").prop "disabled", false
    $("#load").fadeOut 1000, ->
      $("#buttons").fadeIn 1000
    
  window.gameClicked = (id) =>
    render = false
    $('#loading').show()
    game = api.getGame id, (err, game) ->
      $('#loading').hide()
      if err
        alert "couldn't load game " + id
        return

      timeboats = new Timeboats game, game_context, game_canvas.width, game_canvas.height, api, window.document
      timeboats.turnClicked null

      $("#menu-canvas").fadeOut 1000
      $("#menu").fadeOut 1000, =>
        render = true
        render_menu = false
        $("#load").hide()
        $("#controls").fadeIn 1000
        $("#game-canvas").fadeIn 1000

  window.gameOver = (game) =>
    $("#controls").fadeOut 1000
    render_menu = true
    render = false
    menu_boats.full_redraw = true
    $("#game-canvas").fadeOut 1000, =>
      timeboats = null
      $("#menu-canvas").fadeIn 1000
      $("#menu").fadeIn 1000
      $("#gameover").show()

   $('#gameover .back').click =>
    $("#buttons button").prop "disabled", false
    $("#gameover").fadeOut 1000, ->
      $("#buttons").fadeIn 1000

  $("#playbutton").click =>
    return if not timeboats?
    timeboats.playClick()

  $("#timeslider").change =>
    return if not timeboats?
    timeboats.sliderDrag $("#timeslider").val()

  window.turnClicked = (number) =>
    if not timeboats?
      return
    timeboats.turnClicked number

  game_canvas.onmousedown = (e) =>
    if not timeboats?
      return
    timeboats.onMouseDown e

  game_canvas.onmousemove = (e) =>
    if not timeboats?
      return
    canoffset = $(game_canvas).offset()
    x = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft - Math.floor(canoffset.left)
    y = event.clientY + document.body.scrollTop + document.documentElement.scrollTop - Math.floor(canoffset.top) + 1
    timeboats.onMouseMove [x, y]

  last = timestamp()
  dt = 0
  gdt = 0
  rdt = 0
  frame_num = 0
  frame = () =>
    do_render = false
    if render_menu
      do_render = true
      render_obj = menu_boats
      render_ctx = menu_context
    else if render
      do_render = true
      render_obj = timeboats
      render_ctx = game_context

    if do_render
      frame_num += 1

      now = timestamp()
      if not last? then last = now
      dt  = Math.min 1, (now - last) / 1000

      gdt = gdt + dt
      while gdt > render_obj.timestep
        gdt = gdt - render_obj.timestep
        render_obj.update render_obj.timestep

      rdt = rdt + dt
      if rdt > render_obj.renderstep
        rdt = rdt - render_obj.renderstep
        render_obj.draw()

      render_ctx.fillText("" + Math.floor(1/dt), 10, 10)

    last = now
    requestAnimationFrame frame

  frame()
