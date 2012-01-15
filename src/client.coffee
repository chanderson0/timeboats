# Timeboats!
Timeboats = require('./timeboats.coffee').Timeboats

# Helper function.
timestamp = ->
  +new Date()

# Setup.
window.onload = ->
  canvas = $('#game-canvas')[0]
  context = canvas.getContext '2d'

  game = new Timeboats context, canvas.width, canvas.height

  $("#addbutton").prop "disabled", true

  $("#addbutton").click ->
    game.addClick()

  $("#playbutton").click ->
    game.playClick()

  $("#timeslider").change ->
    game.sliderDrag $("#timeslider").val()

  canvas.onmousedown = (e) ->
    game.onMouseDown e
  canvas.onmousemove = (e) ->
    canoffset = $(canvas).offset()
    x = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft - Math.floor(canoffset.left)
    y = event.clientY + document.body.scrollTop + document.documentElement.scrollTop - Math.floor(canoffset.top) + 1
    game.onMouseMove [x, y]

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
    while gdt > game.timestep
      gdt = gdt - game.timestep
      game.update game.timestep
    
    rdt = rdt + dt
    if rdt > game.renderstep
      rdt = rdt - game.renderstep
      game.draw()

    #if Math.random() > 0.9
      context.fillText("" + Math.floor(1/dt), 10, 10)

    last = now
    requestAnimationFrame frame

  frame()
