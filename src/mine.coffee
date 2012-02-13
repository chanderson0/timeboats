GameObject2D = require('./game_object_2d.coffee').GameObject2D
AssetLoader = require('./asset_loader.coffee').AssetLoader
Point = require('./point.coffee').Point
Random = require('./random.coffee').Random

exports.Mine = class Mine extends GameObject2D
  __type: 'Mine'

  constructor: (@id, @x, @y) ->
    super @id, @x, @y
    @frame = 0
    @dt = new Random(@x + @y).nextf()
    @radius = 15
    @isGold = false

  clone: ->
    c = new Mine(@id, @x, @y)
    c.frame = @frame
    c.dt = @dt
    c.isGold = @isGold
    return c

  update: (dt, state) ->
    @dt += dt
    if @dt >= 0.4
      @dt = 0
      @frame++
      @frame %= 2

    for id, object of state.objects
      if object.__type == 'Square' and Point.getDistance(@x + 16, @y + 16, object.x, object.y) < @radius
        if not @isGold
          object.explode state
        else
          state.addScore object.id, 1, 'gold'
        state.removeObject @id

        # Detect end game
        gold = 0
        for id, object of state.objects
          if object.__type == 'Mine'
            gold++
            break
        
        if gold == 0
          state.gameover = true

        break

    super dt

  draw: (context) ->
    if @isGold
      context.drawImage(AssetLoader.getInstance().getAsset("gold"), @x - 5, @y - 3, 37,27)
    else
      context.drawImage(AssetLoader.getInstance().getAsset("mine" + @frame), @x, @y, 31, 31)