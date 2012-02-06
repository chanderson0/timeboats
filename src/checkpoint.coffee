GameObject2D = require('./game_object_2d.coffee').GameObject2D
AssetLoader = require('./asset_loader.coffee').AssetLoader

exports.Checkpoint = class Checkpoint extends GameObject2D
  __type: 'Checkpoint'

  constructor: (@id, @x, @y) ->
    super @id, @x, @y
    @frame = 0
    @dt = 0
    @yInitial = @y
    @y += 2

  clone: ->
    c = new Checkpoint(@id, @x, @y)
    c.frame = @frame
    c.dt = @dt
    return c

  update: (dt) ->
    @dt += dt
    if @dt >= 0.4
      @dt = 0
      @frame++
      @frame %= 2

    @ay = (@yInitial - @y) * 0.8
    super dt

  draw: (context) ->
    context.drawImage(AssetLoader.getInstance().getAsset("checkpoint" + @frame), @x, @y, 43.5, 48)