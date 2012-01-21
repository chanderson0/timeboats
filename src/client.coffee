# Timeboats!
Timeboats = require('./timeboats.coffee').Timeboats
Turns = require('./turns.coffee')
API = require('./api.coffee')
UUID = require('./lib/uuid.js')

# Helper function.
timestamp = ->
  +new Date()

drawGames = (game_ids, games) ->
  html = new EJS(element: 'games_template', type: '<').render
    games: games
    game_ids: game_ids
  $('.games').replaceWith html
  $('#games_select').change ->
    console.log 'selected'
    $('#games_select option:selected').each ->
      window.gameClicked $(this).text()

# Setup.
window.onload = ->
  canvas = $('#game-canvas')[0]
  context = canvas.getContext '2d'

  api = new API.LocalAPI 'chris', null

  game = null
  timeboats = null
  render = false

  window.gameClicked = (id) =>
    render = false
    game = api.getGame id
    timeboats = new Timeboats game, context, canvas.width, canvas.height, api
    timeboats.turnClicked null
    render = true
  
  game_ids = api.gameIds()
  games = api.getGames()

  drawGames game_ids, games

  console.log games, game_ids
  if game_ids.length > 0
    console.log "Loading game", game_ids[0]
    game = api.getGame game_ids[0]
    console.log game_ids[0], games, game
    timeboats = new Timeboats game, context, canvas.width, canvas.height, api
    timeboats.turnClicked null
    console.log game, timeboats
    render = true

  $('#newgame').click =>
    render = false
    player1 = new Turns.Player 1, "white"
    player2 = new Turns.Player 2, "red"
    players = {1: player1, 2: player2}
    order = [1, 2]

    $("#playbutton").prop "disabled", true
    
    game = new Turns.Game UUID.generate(), players, order
    timeboats = new Timeboats game, context, canvas.width, canvas.height, api
    timeboats.turnClicked null
    render = true

  $("#addbutton").prop "disabled", true

  $("#addbutton").click ->
    if not timeboats?
      return
    timeboats.addClick()

  $("#playbutton").click ->
    if not timeboats?
      return
    timeboats.playClick()

  $("#timeslider").change ->
    if not timeboats?
      return
    timeboats.sliderDrag $("#timeslider").val()

  window.turnClicked = (number) ->
    if not timeboats?
      return
    timeboats.turnClicked number

  canvas.onmousedown = (e) ->
    if not timeboats?
      return
    timeboats.onMouseDown e

  canvas.onmousemove = (e) ->
    if not timeboats?
      return
    canoffset = $(canvas).offset()
    x = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft - Math.floor(canoffset.left)
    y = event.clientY + document.body.scrollTop + document.documentElement.scrollTop - Math.floor(canoffset.top) + 1
    timeboats.onMouseMove [x, y]

  last = timestamp()
  dt = 0
  gdt = 0
  rdt = 0
  frame_num = 0
  frame = () =>
    if render
      frame_num += 1

      now = timestamp()
      if not last? then last = now
      dt  = Math.min 1, (now - last) / 1000

      gdt = gdt + dt
      while gdt > timeboats.timestep
        gdt = gdt - timeboats.timestep
        timeboats.update timeboats.timestep
      
      rdt = rdt + dt
      if rdt > timeboats.renderstep
        rdt = rdt - timeboats.renderstep
        timeboats.draw()

      context.fillText("" + Math.floor(1/dt), 10, 10)

    last = now
    requestAnimationFrame frame

  frame()
