GameObject2D = require('./game_object_2d.coffee').GameObject2D
AssetLoader = require('./asset_loader.coffee').AssetLoader
Point = require('./point.coffee').Point

exports.Checkpoint = class Checkpoint extends GameObject2D
  __type: 'Checkpoint'

  constructor: (@id, @x, @y) ->
    super @id, @x, @y
    @frame = 0
    @dt = 0
    @yInitial = @y
    @map = null
    @checked = false

  clone: ->
    c = new Checkpoint(@id, @x, @y)
    c.frame = @frame
    c.dt = @dt
    c.yInitial = @yInitial
    c.map = @map
    c.checked = @checked
    return c

  update: (dt, state) ->
    @dt += dt
    if @dt >= 0.4
      @dt = 0
      @frame++
      @frame %= 2
    if @map?
      @map.setRegionDirty(@x, @y, @x + 43.5, @y + 48)

    @ay = (@yInitial - @y)

    for id, object of state.objects
      if object.__type == 'Square' and Point.getDistance(@x + 21, @y + 24, object.x, object.y) < 20
        object.explode state
        @checked = true

    super dt

  draw: (context) ->
    assetId = ""
    if @checked
      assetId = "checkpoint_checked" + @frame
    else
      assetId = "checkpoint" + @frame
    context.drawImage(AssetLoader.getInstance().getAsset(assetId), @x, @y, 43.5, 48)