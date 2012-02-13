GameObject2D = require('./game_object_2d.coffee').GameObject2D
AssetLoader = require('./asset_loader.coffee').AssetLoader

exports.Dock = class Dock extends GameObject2D
  __type: 'Dock'

  constructor: (@id, @x, @y) ->
    super @id, @x, @y
    @frame = 0
    @dt = 0
    @alpha = 1
    @radius = 48
    @active = null

  clone: ->
    c = new Dock(@id, @x, @y)
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
    context.drawImage(AssetLoader.getInstance().getAsset("marker" + @frame), @x - 30, @y - 32, 44, 43)
    
    if @active == 'ready'
      context.drawImage(AssetLoader.getInstance().getAsset("getready" + @frame), @x - 15, @y + 28, 30, 24)  
    else if @active == 'go'
      context.drawImage(AssetLoader.getInstance().getAsset("go" + @frame), @x - 15, @y + 23, 30, 24)  

    context.restore()