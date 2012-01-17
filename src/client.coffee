# Timeboats!
Timeboats = require('./timeboats.coffee').Timeboats
Turns = require('./turns.coffee')

# Helper function.
timestamp = ->
  +new Date()

# Setup.
window.onload = ->
  canvas = $('#game-canvas')[0]
  context = canvas.getContext '2d'

  player1 = new Turns.Player 1, "white"
  player2 = new Turns.Player 2, "red"
  players = {1: player1, 2: player2}
  order = [1, 2]

  game = new Turns.Game 1, players, order

  timeboats = new Timeboats game, context, canvas.width, canvas.height

  $("#addbutton").prop "disabled", true

  $("#addbutton").click ->
    timeboats.addClick()

  $("#playbutton").click ->
    timeboats.playClick()

  $("#timeslider").change ->
    timeboats.sliderDrag $("#timeslider").val()

  window.turnClicked = (number) ->
    timeboats.turnClicked number

  canvas.onmousedown = (e) ->
    timeboats.onMouseDown e
  canvas.onmousemove = (e) ->
    canoffset = $(canvas).offset()
    x = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft - Math.floor(canoffset.left)
    y = event.clientY + document.body.scrollTop + document.documentElement.scrollTop - Math.floor(canoffset.top) + 1
    timeboats.onMouseMove [x, y]

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
    while gdt > timeboats.timestep
      gdt = gdt - timeboats.timestep
      timeboats.update timeboats.timestep
    
    rdt = rdt + dt
    if rdt > timeboats.renderstep
      rdt = rdt - timeboats.renderstep
      timeboats.draw()

    #if Math.random() > 0.9
      context.fillText("" + Math.floor(1/dt), 10, 10)

    last = now
    requestAnimationFrame frame

  frame()
