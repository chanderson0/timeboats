GameObject2D = require('./game_object_2d.coffee').GameObject2D
AssetLoader = require('./asset_loader.coffee').AssetLoader

exports.Dock = class Dock extends GameObject2D
  __type: 'Dock'

  constructor: (@id, @x, @y, @color) ->
    super @id, @x, @y
    @frame = 0
    @dt = 0
    @alpha = 1
    @radius = 48
    @active = null

  clone: ->
    c = new Dock(@id, @x, @y, @color)
    c.frame = @frame
    c.dt = @dt
    c.alpha = @alpha
    return c

  update: (dt, state) ->
    @dt += dt
    if @dt >= 0.4
      @dt = 0
      if @active?
        @frame++
        @frame %= 2
    if @alpha > 0.5
      @alpha -= 0.25 * dt

    super dt

  draw: (context) ->
    context.save()
    #context.globalAlpha = @alpha

    context.drawImage(AssetLoader.getInstance().getAsset("dock"), @x - 38, @y - 23, 76, 46)
    if (@frame == 0)
      context.drawImage(AssetLoader.getInstance().getAsset("marker" + @color), @x - 12, @y - 32, 24, 12)
      context.drawImage(AssetLoader.getInstance().getAsset("marker_shadow"), @x - 28, @y, 26, 11)
    else
      context.drawImage(AssetLoader.getInstance().getAsset("marker" + @color), @x - 12, @y - 26, 24, 12)
      context.drawImage(AssetLoader.getInstance().getAsset("marker_shadow"), @x - 26, @y - 4, 26, 11)

    if @active == 'ready'
      context.drawImage(AssetLoader.getInstance().getAsset("getready" + @frame), @x - 15, @y + 28, 30, 24)
    else if @active == 'go'
      context.drawImage(AssetLoader.getInstance().getAsset("go" + @frame), @x - 15, @y + 23, 30, 24)

    context.restore()