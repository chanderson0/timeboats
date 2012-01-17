GameObject2D = require('./game_object_2d.coffee').GameObject2D
Point = require('./point.coffee').Point
Explosion = require('./explosion.coffee').Explosion
Map = require('./map.coffee').Map

exports.Square = class Square extends GameObject2D
  __type: 'Square'

  constructor: (@id, @x, @y, @size, @fill = "white") ->
    super @id, @x, @y

    @destx = @x
    @desty = @y
    @radius = @size / 2

  clone: ->
    sq = new Square @id, @x, @y, @size, @fill
    sq.rotation = @rotation
    sq.vx = @vx
    sq.vy = @vy
    sq.destx = @destx
    sq.desty = @desty
    return sq

  explode: (state) ->
    id = Math.floor(Math.random() * 1000000)
    explosion = new Explosion id, @x, @y, 50
    state.addObject id, explosion
    state.removeObject @id

  update: (dt, state) ->
    dir = Point.subtract @destx, @desty, @x, @y
    dist = Point.getLength dir.x, dir.y

    to_move = Point.normalize dir.x, dir.y, Math.sqrt(dist) * dt * 1000
    if dist < 0.5
      to_move = {x: 0, y: 0}
      @setPos @destx, @desty

    @setVel to_move.x, to_move.y

    Map.getInstance().collideWith(@, state, true)

    super dt, state

  draw: (context, options) ->
    context.save()
    if options? and options.dim
      context.globalAlpha = 0.5
      
    context.fillStyle = @fill
    context.translate @x, @y
    context.rotate @rotation
    context.fillRect -@size/2, -@size/2, @size, @size
    context.restore()

  collide: (state) ->
      @.explode state