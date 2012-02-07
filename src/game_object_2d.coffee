GameObject = require('./game_object.coffee').GameObject
Point = require('./point.coffee').Point

exports.GameObject2D = class GameObject2D extends GameObject
  __type: 'GameObject2D'

  constructor: (@id, @x = 0, @y = 0, @vx = 0, @vy = 0, @rotation = 0, @radius = 0, @ax = 0, @ay = 0) ->
    super @id

  clone: ->
    new GameObject2D @id, @x, @y, @vx, @vy, @rotation, @radius, @ax, @ay

  setPos: (x, y) ->
    @x = x
    @y = y

  setVel: (vx, vy) ->
    @vx = vx
    @vy = vy

  setAcc: (ax, ay) ->
    @ax = ax
    @ay = ay

  update: (dt) ->
    newVel = Point.add(@vx, @vy, @ax * dt, @ay * dt)
    @setVel newVel.x, newVel.y

    newPos = Point.add(@x, @y, @vx * dt, @vy * dt)
    @setPos newPos.x, newPos.y

  collide: (state) ->
    @vx = 0
    @vy = 0