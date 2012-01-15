GameObject2D = require('./game_object_2d.coffee').GameObject2D
Point = require('./point.coffee').Point

exports.Square = class Square extends GameObject2D
  __type: 'Square'

  constructor: (@x, @y, @size) ->
    super @x, @y

    @destx = @x
    @desty = @y

  clone: ->
    sq = new Square @x, @y, @size
    sq.rotation = @rotation
    sq.vx = @vx
    sq.vy = @vy
    sq.destx = @destx
    sq.desty = @desty
    return sq

  update: (dt) ->
    dir = Point.subtract @destx, @desty, @x, @y
    dist = Point.getLength dir.x, dir.y

    to_move = Point.normalize dir.x, dir.y, Math.sqrt(dist) * dt * 1000
    if dist < 0.5
      to_move = {x: 0, y: 0}
      @setPos @destx, @desty

    @setVel to_move.x, to_move.y
    super dt

  draw: (context) ->
    context.save()
    context.translate @x, @y
    context.rotate @rotation
    context.fillRect -@size/2, -@size/2, @size, @size
    context.restore()