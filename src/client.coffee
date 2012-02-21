# Timeboats!
Timeboats = require('./timeboats.coffee').Timeboats
MenuBoats = require('./menu_boats.coffee').MenuBoats
Turns = require('./turns.coffee')
API = require('./api.coffee')
UUID = require('./lib/uuid.js')
async = require('./lib/async.js')
AssetLoader = require('./asset_loader.coffee').AssetLoader

# globals controlling rendering
loaded = false
render = false
render_menu = true

# globals for canvases
menu_canvas = null
menu_context = null
game_canvas = null
game_context = null

# Helper function.
timestamp = ->
  +new Date()

attachHandler = (obj, id) ->
  obj.click (e) ->
    window.gameClicked id

drawGames = (game_ids, games, api) ->
  $('#games').html ''

  for game_id in game_ids.reverse()
    html = new EJS(element: 'games_template', type: '<').render
      id: game_id
      name: games[game_id].name()
      time: games[game_id].latestTurnTime().toISOString()
    obj = $(html).appendTo $('#games') 
    attachHandler obj, game_id

  $('.game_time').timeago()

  # $('#games .game').click (e) ->
  #   id = $(e.target).attr('data')
  #   window.gameClicked id

clearPlayers = ->
  $('#gameover .players').html ''

# Code to flesh out.
drawPlayer = (player, goodScore = 5) ->
  positiveRanks = [ "Captain", "First Mate", "Swordsman", "Bombardier", "Admiral", "Colonel" ]
  negativeRanks = [ "Deck Boy", "Rigging Monkey", "Drunkard", "Ship's Cook", "Seasick", "Davy Jones" ]
  rank = ""
  console.log "goodscore is #{goodScore} and player score is #{player.scores['gold']}"
  if player.scores['gold'] >= goodScore
    rank = positiveRanks[parseInt(Math.random() * positiveRanks.length)]
  else
    rank = negativeRanks[parseInt(Math.random() * negativeRanks.length)]
  console.log "sending rank " + rank
  html = new EJS(element: 'gameover_player_template', type: '<').render
    player: player
    rank: rank
  $('#gameover .players').append html

getRandomNicknames = (numNicknames) ->
  nicks = [ "Ahab", "Englehorn", "Haddock", "Hook", "Long John Silver", "Yellowbeard", "Redbeard", "The Kraken", "Mad Jack", "Billy Bones" ]
  # shuffle
  i = nicks.length
  while i
    j = parseInt(Math.random() * i)
    x = nicks[--i]
    nicks[i] = nicks[j]
    nicks[j] = x

  return nicks.splice(0, numNicknames)

loadTutorial = (mapOptions, seed, context, width, height, messages = []) ->
  player = new Turns.Player 1, 0, 'You'
  players = {1: player}
  order = [1]
  game = new Turns.Game UUID.generate(), players, order
  game.setMap seed
  timeboats = new Timeboats game, context, width, height, null, window.document, {mapOptions:mapOptions,tutorial:mapOptions.numMines == 0}, 20
  timeboats.turnClicked null

  for message in messages
    html = new EJS(element: 'tutorial_message', type: '<').render message: message
    m = $(html).appendTo $("#left")
    m.delay(message.delay).fadeIn(message.fadeIn) if message.fadeIn? and message.delay?
    m.css 'top', message.top
    m.css 'left', message.left
    m.css 'width', message.width if message.width?

  $("#menu-canvas").fadeOut 1000
  $("#controls_placeholder").fadeOut 1000
  $("#instructions_right").fadeOut 1000
  $("#menu").fadeOut 1000, =>
    $("#buttons").hide()
    $("#controls_background").fadeOut 1000
    $("#controls").fadeIn 1000
    $("#game-canvas").fadeIn 1000
    $("#game_right").fadeIn 1000
    $("#background_right").fadeOut 1000

  timeboats

clearTutorial = (hard = false) ->
  if not hard
    $('#left .message').fadeOut 1000, ->
      $(this).remove()
  else
    $('#left .message').remove()

load = ->
  loaded = true
  tutorial = 0

  $('#loading').fadeIn 1000
  AssetLoader.getInstance().load ->
    $('#loading').stop true
    $('#loading').hide()

  api = new API.LocalAPI 'timeboats', null

  if pokki?
    pokki.setPopupClientSize 900, 627

  menu_boats = new MenuBoats menu_canvas, menu_context, menu_canvas.width, menu_canvas.height, window.document
  $("#menu-canvas").fadeIn 1000, ->
    $("#menu").fadeIn 1000
    $("#controls_placeholder").fadeIn 1000
    $("#instructions_right").fadeIn 1000

  game = null
  timeboats = null

  startGame = (n) ->
    render = false
    nicknames = getRandomNicknames(n)
    players = {}
    order = []
    for i in [0...n]
      player = new Turns.Player i+1, i, nicknames[i]
      players[i+1] = player
      order.push i+1

    $("#playbutton").prop "disabled", true

    game = new Turns.Game UUID.generate(), players, order
    timeboats = new Timeboats game, game_context, game_canvas.width, game_canvas.height, api, window.document
    timeboats.turnClicked null

    render = true
    render_menu = false

    $("#menu-canvas").fadeOut 1000
    $("#controls_placeholder").fadeOut 1000
    $("#instructions_right").fadeOut 1000
    $("#menu").fadeOut 1000, =>
      render = true
      render_menu = false
      $("#buttons").hide()
      $("#controls_background").fadeOut 1000
      $("#controls").fadeIn 1000
      $("#game-canvas").fadeIn 1000
      $("#game_right").fadeIn 1000
      $("#background_right").fadeOut 1000

  $('#newgame1p').click =>
    startGame 1

  $('#newgame2p').click =>
    startGame 2

  $('#newgame3p').click =>
    startGame 3

  $('#newgame4p').click =>
    startGame 4

  $('#loadgame').click =>
    $("#buttons button").prop "disabled", true
    $("#buttons").fadeOut()
    $("#load").fadeIn()

    $('#loading').fadeIn()

    async.parallel {
      game_ids: api.gameIds
      games: api.getGames
    },
    (err, data) ->
      $('#loading').stop true
      $('#loading').hide()
      if not err
        drawGames data.game_ids, data.games, api

  $('#tutorial').click =>
    $("#buttons button").prop "disabled", true
    $("#buttons").fadeOut 1000, =>
      tutorial = 1
      timeboats = loadTutorial {numMines: 0, numCheckpoints: 1},
        25401329367224805,
        game_context,
        game_canvas.width,
        game_canvas.height,
        [
          {
            text: 'Click yer dock to get ready! Then click it again to sail!'
            left: '125px'
            top: '460px'
            width: '150px'
            fadeIn: 1000
            delay: 1500
          },
          {
            text: 'Steer toward the checkpoint!'
            left: '45px'
            top: '220px'
            width: '150px'
            fadeIn: 1000
            delay: 2750
          }
        ]
      render = true
      render_menu = false

  $('#load .back').click =>
    $("#buttons button").prop "disabled", false
    $("#load").fadeOut 200, ->
      $("#buttons").fadeIn 200

  window.gameClicked = (id) =>
    render = false
    $('#loading').fadeIn()
    console.log id

    game = api.getGame id, (err, game) ->
      $('#loading').stop true
      $('#loading').hide()
      if err
        alert "couldn't load game " + id
        return

      timeboats = new Timeboats game, game_context, game_canvas.width, game_canvas.height, api, window.document
      timeboats.turnClicked null

      $("#menu-canvas").fadeOut 1000
      $("#controls_placeholder").fadeOut 1000
      $("#instructions_right").fadeOut 1000
      $("#menu").fadeOut 1000, =>
        render = true
        render_menu = false
        $("#load").hide()
        $("#controls").fadeIn 1000
        $("#controls_background").fadeOut 1000
        $("#game-canvas").fadeIn 1000
        $("#game_right").fadeIn 1000
        $("#background_right").fadeOut 1000

  # Called when timeboats.coffee decides the game is over.
  # Needs to remove the menu and display the gameover screen.
  window.gameOver = (game) =>
    $("#controls").fadeOut 1000
    $("#controls_background").fadeIn 1000

    if tutorial == 1
      tutorial = 2
      clearTutorial()
      $("#game-canvas").fadeOut 1000, =>
        timeboats = loadTutorial {numMines: 0, numCheckpoints: 2},
          1329373618445,
          game_context,
          game_canvas.width,
          game_canvas.height,
          [
            {
              text: 'Click the dock to sail!'
              left: '210px'
              top: '120px'
              width: '200px'
              fadeIn: 1000
              delay: 1250
            },
            {
              text: "You'll need more than one ship this time."
              left: '370px'
              top: '370px'
              width: '300px'
              fadeIn: 1000
              delay: 2500
            },
            {
              text: "Mind yer clickin! Can make ships 'splode their surroundins."
              left: '6px'
              top: '470px'
              width: '300px'
              fadeIn: 1000
              delay: 4000
            }
          ]
        $("#game-canvas").fadeIn 1000
      return
    else if tutorial == 2
      tutorial = 3
      clearTutorial()
      $("#game-canvas").fadeOut 1000, =>
        timeboats = loadTutorial {numMines: 2, numCheckpoints: 1},
          1329373618428,
          game_context,
          game_canvas.width,
          game_canvas.height,
          [
            {
              text: 'Stay away from the mines to stay afloat!'
              left: '45px'
              top: '350px'
              width: '150px'
              fadeIn: 1000
              delay: 1250
            },
            {
              text: 'If ye hit all the checkpoints, the mines turn to gold!'
              left: '530px'
              top: '120px'
              width: '150px'
              fadeIn: 1000
              delay: 2000
            },
            {
              text: 'You love gold! Collect the gold.'
              left: '390px'
              top: '320px'
              width: '150px'
              fadeIn: 1000
              delay: 2900
            }
          ]
        $("#game-canvas").fadeIn 1000
      return
    else if tutorial == 3
      tutorial = 0
      clearTutorial()
      render_menu = true
      render = false
      menu_boats.full_redraw = true
      $("#game-canvas").fadeOut 1000, =>
        timeboats = null
        $("#menu-canvas").fadeIn 1000
        $("#instructions_right").fadeIn 1000
        $("#menu").fadeIn 1000
        $("#buttons").fadeIn 1000
        $("#controls_placeholder").fadeIn 1000
        $("#buttons button").prop "disabled", false

      return

    render_menu = true
    render = false
    menu_boats.full_redraw = true
    $("#game-canvas").fadeOut 1000, =>
      timeboats = null
      $("#menu-canvas").fadeIn 1000
      $("#menu").fadeIn 1000
      $("#controls_placeholder").fadeIn 1000
      $("#gameover").show()

    # Wire up the back button. This whole ordeal is hacky as
    # all get out. works sort of.
    $('#gameover .back').click =>
      $("#buttons button").prop "disabled", false
      $("#game_right").fadeOut 1000
      $("#gameover").fadeOut 1000, ->
        $("#buttons").fadeIn 1000
        $("#instructions_right").fadeIn 1000
        $("#background_right").fadeIn 1000

    # TODO: flesh out this code here and in drawPlayer()
    maxScore = 0
    tieScore = -1
    isTie = true
    bestPlayer = null
    goodScore = 10 / game.order.length
    for player_id in game.order
      player = game.players[player_id]
      if not player.scores['gold']?
        player.scores['gold'] = 0
      if player.scores['gold'] > maxScore
        maxScore = player.scores['gold']
        bestPlayer = player
      if tieScore < 0
        tieScore = player.scores['gold']
      else if player.scores['gold'] != tieScore
        isTie = false
      drawPlayer player, goodScore
    if isTie
      $("#gameover .winner").append "We'll call it a draw, mates."
    else
      $("#gameover .winner").append "#{bestPlayer.nickname} is the victor!"

  $("#back_to_menu").click =>
    clearTutorial(true)
    $("#controls").fadeOut 1000
    $("#controls_background").fadeIn 1000
    $("#game_right").fadeOut 1000
    $("#background_right").fadeIn 1000
    render_menu = true
    render = false
    menu_boats.full_redraw = true
    $("#game-canvas").fadeOut 1000, =>
      timeboats = null
      $("#menu-canvas").fadeIn 1000
      $("#instructions_right").fadeIn 1000
      $("#menu").fadeIn 1000
      $("#buttons").fadeIn 1000
      $("#controls_placeholder").fadeIn 1000
      $("#gameover .winner").html ''
      $("#gameover .players").html ''
      $("#buttons button").prop "disabled", false

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

      # render_ctx.fillText("" + Math.floor(1/dt), 10, 10)

    last = now

    if loaded
      requestAnimationFrame frame

  frame()

unload = ->
  loaded = false
  menu_context.clearRect 0, 0, menu_canvas.width, menu_canvas.height
  game_context.clearRect 0, 0, game_canvas.width, game_canvas.height

# Setup.
if pokki?
  pokki.addEventListener 'popup_unload', ->
    unload()

  old_render = false
  old_render_menu = false

  pokki.addEventListener 'popup_shown', ->
    if old_render
      render = true
    if old_render_menu
      render_menu = true

  pokki.addEventListener 'popup_hiding', ->
    old_render = render
    old_render_menu = render_menu
    render = false
    render_menu = false

  # pokki.addEventListener 'popup_hidden', ->
  #   old_render = render
  #   old_render_menu = render_menu
  #   render = false
  #   render_menu = false

window.onload = ->
  menu_canvas = $('#menu-canvas')[0]
  menu_context = menu_canvas.getContext '2d'
  game_canvas = $('#game-canvas')[0]
  game_context = game_canvas.getContext '2d'

  if pokki?
    console.log "loaded"
    $("#minimize").click ->
      pokki.closePopup()
  else
    if not $.browser.webkit
      $("#sorry").show()

    $("#minimize").hide()

  load()


