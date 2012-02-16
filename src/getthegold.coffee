GameObject2D = require('./game_object_2d.coffee').GameObject2D
AssetLoader = require('./asset_loader.coffee').AssetLoader

exports.GetTheGold = class GetTheGold extends GameObject2D
  __type: 'GetTheGold'

  constructor: (@id, @x, @y) ->
    super @id, @x, @y
    @lifespan = @ttl = 3.0
    @vy = -3

  clone: ->
    exp = new GetTheGold @id, @x, @y
    exp.lifespan = @lifespan
    exp.ttl = @ttl
    exp.vy = @vy
    return exp

  update: (dt, state) ->
    @ttl -= dt

    if @ttl < @lifespan * 0.7
      @vy -= 0.5

    super dt, state
    if @ttl <= 0
      state.removeObject @id

  draw: (context) ->
    if (Math.floor(@ttl * 5) % 2 == 0)
      return
    context.save()
    context.globalAlpha = @ttl / @lifespan
    context.drawImage(AssetLoader.getInstance().getAsset("getthegold"), @x - 191, @y - 23, 382, 46)
    context.restore()