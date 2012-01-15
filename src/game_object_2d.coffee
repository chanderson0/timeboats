GameObject = require('./game_object.coffee').GameObject
Point = require('./point.coffee').Point

exports.GameObject2D = class GameObject2D extends GameObject
  __type: 'GameObject2D'

  constructor: (@id, @x = 0, @y = 0, @vx = 0, @vy = 0, @rotation = 0) ->
    super @id

  clone: ->
    new GameObject2D @id, @x, @y, @vx, @vy, @rotation

  setPos: (x, y) ->
    @x = x
    @y = y

  setVel: (vx, vy) ->
    @vx = vx
    @vy = vy

    if @vx != 0 or @vy != 0
      @rotation = Point.getAngle(@vx, @vy)
  
  update: (dt) ->
    newPos = Point.add(@x, @y, @vx * dt, @vy * dt)
    @setPos newPos.x, newPos.y