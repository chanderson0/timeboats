GameObject2D = require('./game_object_2d.coffee').GameObject2D
Point = require('./point.coffee').Point
Explosion = require('./explosion.coffee').Explosion
Map = require('./map.coffee').Map
AssetLoader = require('./asset_loader.coffee').AssetLoader

exports.Square = class Square extends GameObject2D
  __type: 'Square'

  constructor: (@id, @x, @y, @size, @color = 0, @playerId = 0) ->
    super @id, @x, @y, 0, 0, -1.57

    @destx = @x
    @desty = @y
    @radius = (@size / 2) - 5
    @invincibleTime = 1.0

  clone: ->
    sq = new Square @id, @x, @y, @size, @color
    sq.rotation = @rotation
    sq.vx = @vx
    sq.vy = @vy
    sq.destx = @destx
    sq.desty = @desty
    sq.invincibleTime = @invincibleTime
    sq.playerId = @playerId
    return sq

  explode: (state) ->
    if @invincibleTime > 0
      return
    id = Math.floor(Math.random() * 1000000)
    explosion = new Explosion id, @x, @y, 80
    state.addObject id, explosion
    Map.getInstance().collideWith(explosion, state, true);
    state.removeObject @id
    state.addScore @id, 1, 'boat'

  setVel: (vx, vy) ->
    super vx, vy
    if @vx != 0 or @vy != 0
      @rotation = Point.getAngle(@vx, @vy)

  update: (dt, state) ->
    dir = Point.subtract @destx, @desty, @x, @y
    dist = Point.getLength dir.x, dir.y
    if @invincibleTime > 0
      @invincibleTime -= 0.7 * dt
      if Point.getDistance(@x, @y, Map.getInstance().docks[@playerId].x, Map.getInstance().docks[@playerId].y) > 60
        @invincibleTime = 0

    to_move = Point.normalize dir.x, dir.y, Math.sqrt(dist) * dt * 5000
    if dist < 0.5
      to_move = {x: 0, y: 0}
      @setPos @destx, @desty

    @setAcc to_move.x, to_move.y
    @vx *= (0.98 * 60) * dt
    @vy *= (0.98 * 60) * dt

    Map.getInstance().collideWith(@, state, true)

    super dt, state

  draw: (context, options) ->
    if @invincibleTime > 0 and (Math.floor(@invincibleTime * 15) % 2 == 1)
      return
    context.save()
    if options? and options.dim
      context.globalAlpha = 0.5

    context.translate @x, @y
    context.rotate @rotation
    context.drawImage(AssetLoader.getInstance().getAsset("boat" + @color), -@size/2, -@size/2, @size, @size)
    context.restore()

  collide: (state) ->
      @.explode state